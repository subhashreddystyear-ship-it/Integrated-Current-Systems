const assert = require('node:assert/strict');
const { once } = require('node:events');
const fs = require('node:fs/promises');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const { after, test } = require('node:test');

const root = path.resolve(__dirname, '..');
let temporaryDirectory;
let serverProcess;
let baseUrl;

async function availablePort() {
  const probe = net.createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const { port } = probe.address();
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

async function startServer() {
  temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'equipment-share-'));
  const port = await availablePort();
  baseUrl = `http://127.0.0.1:${port}`;
  serverProcess = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), DATABASE_PATH: path.join(temporaryDirectory, 'test.sqlite') },
    stdio: ['ignore', 'ignore', 'pipe']
  });
  let serverErrors = '';
  serverProcess.stderr.on('data', (chunk) => { serverErrors += chunk.toString(); });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (serverProcess.exitCode !== null) throw new Error(`Server exited early: ${serverErrors}`);
    try {
      const response = await fetch(`${baseUrl}/api/auth/me`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not start: ${serverErrors}`);
}

async function apiRequest(route, { cookie, method = 'GET', body } = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch {}
  return { response, data, text };
}

async function register(name, email) {
  const { response, data } = await apiRequest('/api/auth/register', {
    method: 'POST',
    body: { name, email, password: 'equipment-test-password' }
  });
  assert.equal(response.status, 201, JSON.stringify(data));
  return response.headers.get('set-cookie').split(';', 1)[0];
}

function listingPayload(overrides = {}) {
  const availableFrom = new Date(Date.now() + 60_000);
  const availableUntil = new Date(availableFrom.getTime() + 3 * 60 * 60_000);
  return {
    name: 'Community water pump',
    category: 'Daily use',
    description: 'Portable irrigation pump with intake hose.',
    condition: 'Good',
    price: 120,
    price_unit: 'hour',
    available_from: availableFrom.toISOString(),
    available_until: availableUntil.toISOString(),
    owner_phone: '+91 9876543210',
    locality: 'Ramakuppam',
    latitude: 13.083,
    longitude: 80.2707,
    photos: ['data:image/jpeg;base64,/9j/2Q=='],
    ...overrides
  };
}

async function createListing(cookie, overrides) {
  return apiRequest('/api/equipment/listings', {
    cookie,
    method: 'POST',
    body: listingPayload(overrides)
  });
}

after(async () => {
  if (serverProcess && serverProcess.exitCode === null) {
    const exited = once(serverProcess, 'exit');
    serverProcess.kill();
    await exited;
  }
  if (temporaryDirectory) await fs.rm(temporaryDirectory, { recursive: true, force: true });
});

test('equipment sharing preserves existing app features and enforces rental rules', async () => {
  await startServer();
  const owner = await register('Listing Owner', 'owner@equipment.test');
  const renter = await register('Nearby Farmer', 'renter@equipment.test');
  const otherRenter = await register('Second Farmer', 'other@equipment.test');
  const outsider = await register('Unrelated User', 'outsider@equipment.test');

  const posted = await createListing(owner);
  assert.equal(posted.response.status, 201, JSON.stringify(posted.data));
  const listingId = posted.data.listing.id;
  assert.equal(posted.data.listing.status, 'Available');
  assert.ok(posted.data.listing.owner_id > 0);
  const missingCoordinates = await createListing(owner, { latitude: '', longitude: '' });
  assert.equal(missingCoordinates.response.status, 400);

  const far = await createListing(owner, { name: 'Far generator', latitude: 13.11 });
  assert.equal(far.response.status, 201, JSON.stringify(far.data));
  const nearby = await apiRequest('/api/equipment/listings?lat=13.0827&lng=80.2707&radius=1', { cookie: renter });
  assert.equal(nearby.response.status, 200, JSON.stringify(nearby.data));
  assert.deepEqual(nearby.data.listings.map((listing) => listing.id), [listingId]);
  assert.ok(nearby.data.listings[0].distance_km < 1);
  assert.equal(Object.hasOwn(nearby.data.listings[0], 'owner_phone'), false);
  const wider = await apiRequest('/api/equipment/listings?lat=13.0827&lng=80.2707&radius=5', { cookie: renter });
  assert.equal(wider.data.listings.length, 2);

  const listing = posted.data.listing;
  const startsAt = new Date(Date.now() + 90 * 60_000).toISOString();
  const endsAt = new Date(Date.now() + 120 * 60_000).toISOString();
  const bookingBody = { listing_id: listingId, starts_at: startsAt, ends_at: endsAt };
  const selfBooking = await apiRequest('/api/equipment/bookings', { cookie: owner, method: 'POST', body: bookingBody });
  assert.equal(selfBooking.response.status, 403);
  const booking = await apiRequest('/api/equipment/bookings', { cookie: renter, method: 'POST', body: bookingBody });
  assert.equal(booking.response.status, 201, JSON.stringify(booking.data));
  const overlapping = await apiRequest('/api/equipment/bookings', { cookie: otherRenter, method: 'POST', body: bookingBody });
  assert.equal(overlapping.response.status, 409);
  const filteredSlot = await apiRequest(`/api/equipment/listings?lat=13.083&lng=80.2707&radius=1&from=${encodeURIComponent(startsAt)}&until=${encodeURIComponent(endsAt)}`, { cookie: otherRenter });
  assert.equal(filteredSlot.data.listings.find((item) => item.id === listingId).slot_available, false);

  const unauthorized = await apiRequest(`/api/equipment/bookings/${booking.data.booking_id}`, {
    cookie: outsider, method: 'PATCH', body: { action: 'confirm' }
  });
  assert.equal(unauthorized.response.status, 403);
  const accepted = await apiRequest(`/api/equipment/bookings/${booking.data.booking_id}`, {
    cookie: owner, method: 'PATCH', body: { action: 'confirm' }
  });
  assert.equal(accepted.response.status, 200, JSON.stringify(accepted.data));
  const renterHistory = await apiRequest('/api/equipment/bookings', { cookie: renter });
  const confirmedBooking = renterHistory.data.bookings.find((item) => item.id === booking.data.booking_id);
  assert.equal(confirmedBooking.status, 'confirmed');
  assert.equal(confirmedBooking.owner_phone, '+91 9876543210');
  const renterNotifications = await apiRequest('/api/equipment/notifications', { cookie: renter });
  const ownerNotifications = await apiRequest('/api/equipment/notifications', { cookie: owner });
  assert.ok(renterNotifications.data.notifications.some((item) => item.message.includes('accepted')));
  assert.ok(ownerNotifications.data.notifications.some((item) => item.message.includes('accepted')));

  const database = new DatabaseSync(path.join(temporaryDirectory, 'test.sqlite'));
  const expiredAt = new Date(Date.now() - 60_000).toISOString();
  const expiredFrom = new Date(Date.now() - 120_000).toISOString();
  try {
    database.prepare(`UPDATE equipment_listings SET available_from = ?, available_until = ? WHERE id = ?`)
      .run(expiredFrom, expiredAt, listingId);
    database.prepare(`UPDATE equipment_availability_slots SET starts_at = ?, ends_at = ? WHERE listing_id = ?`)
      .run(expiredFrom, expiredAt, listingId);
  } finally {
    database.close();
  }
  const myListings = await apiRequest('/api/equipment/my-listings', { cookie: owner });
  assert.equal(myListings.data.listings.find((item) => item.id === listingId).status, 'Expired');
  const bookingAfterExpiry = await apiRequest('/api/equipment/bookings', { cookie: renter });
  assert.equal(bookingAfterExpiry.data.bookings.find((item) => item.id === booking.data.booking_id).status, 'confirmed');
  const expiredBooking = await apiRequest('/api/equipment/bookings', {
    cookie: otherRenter, method: 'POST', body: bookingBody
  });
  assert.equal(expiredBooking.response.status, 409);

  const reopened = await createListing(owner, {
    available_from: new Date(Date.now() + 4 * 60 * 60_000).toISOString(),
    available_until: new Date(Date.now() + 6 * 60 * 60_000).toISOString()
  });
  assert.equal(reopened.response.status, 201, JSON.stringify(reopened.data));
  assert.notEqual(reopened.data.listing.id, listingId);
  assert.equal(reopened.data.listing.status, 'Available');

  const soon = Date.now() + 60_000;
  const shortLived = await createListing(owner, {
    name: 'Short window attachment',
    available_from: new Date(soon).toISOString(),
    available_until: new Date(soon + 120_000).toISOString()
  });
  assert.equal(shortLived.response.status, 201, JSON.stringify(shortLived.data));
  const expireSoon = new Date(Date.now() + 900).toISOString();
  const pastStart = new Date(Date.now() - 60_000).toISOString();
  const expiryDatabase = new DatabaseSync(path.join(temporaryDirectory, 'test.sqlite'));
  try {
    expiryDatabase.prepare(`UPDATE equipment_listings SET available_from = ?, available_until = ? WHERE id = ?`)
      .run(pastStart, expireSoon, shortLived.data.listing.id);
    expiryDatabase.prepare(`UPDATE equipment_availability_slots SET starts_at = ?, ends_at = ? WHERE listing_id = ?`)
      .run(pastStart, expireSoon, shortLived.data.listing.id);
  } finally {
    expiryDatabase.close();
  }
  await new Promise((resolve) => setTimeout(resolve, 16_000));
  const afterNaturalExpiry = await apiRequest('/api/equipment/my-listings', { cookie: owner });
  assert.equal(afterNaturalExpiry.data.listings.find((item) => item.id === shortLived.data.listing.id).status, 'Expired');
  const expiredNearby = await apiRequest('/api/equipment/listings?lat=13.083&lng=80.2707&radius=1', { cookie: renter });
  assert.ok(!expiredNearby.data.listings.some((item) => item.id === shortLived.data.listing.id));

  const legacyListings = await apiRequest('/api/land/listings?limit=1');
  assert.equal(legacyListings.response.status, 200);
  assert.equal(legacyListings.data.listings.length, 1);
  for (const page of ['/rural-dashboard.html', '/marketplace.html', '/equipment.html']) {
    const response = await fetch(`${baseUrl}${page}`);
    assert.equal(response.status, 200, `${page} should remain available`);
  }
});