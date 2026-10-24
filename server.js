const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const {
  createSession,
  getSessionUser,
  hashPassword,
  normalizeEmail,
  parseCookies,
  sessionCookie,
  verifyPassword
} = require('./auth');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATABASE_PATH = process.env.DATABASE_PATH || path.join(ROOT, 'rural-dashboard.sqlite');

// ===============================
// DATABASE
// ===============================

const db = new DatabaseSync(DATABASE_PATH);

db.exec('PRAGMA journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    role TEXT NOT NULL
      CHECK (role IN ('Village Officer', 'Admin'))
      DEFAULT 'Village Officer',
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL
      REFERENCES users(id)
      ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS villages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    assigned_officer_id INTEGER
      REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS village_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    village_id INTEGER NOT NULL
      REFERENCES villages(id)
      ON DELETE CASCADE,
    asset_type TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'online'
  );

  CREATE TABLE IF NOT EXISTS problems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    village_id INTEGER NOT NULL
      REFERENCES villages(id)
      ON DELETE CASCADE,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_by INTEGER NOT NULL
      REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS land_listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    state TEXT NOT NULL,
    district TEXT NOT NULL,
    location TEXT NOT NULL,
    exact_location TEXT NOT NULL DEFAULT '',
    area REAL NOT NULL,
    area_unit TEXT NOT NULL DEFAULT 'acre',
    price REAL NOT NULL,
    land_type TEXT NOT NULL,
    road_access TEXT NOT NULL,
    road_width TEXT NOT NULL DEFAULT '',
    water_availability TEXT NOT NULL,
    electricity_availability TEXT NOT NULL,
    ownership_status TEXT NOT NULL,
    sale_type TEXT NOT NULL CHECK (sale_type IN ('sale', 'exchange')),
    exchange_location TEXT NOT NULL DEFAULT '',
    exchange_area TEXT NOT NULL DEFAULT '',
    exchange_conditions TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL,
    survey_number TEXT NOT NULL DEFAULT '',
    nearby_facilities TEXT NOT NULL DEFAULT '',
    distance_main_road TEXT NOT NULL DEFAULT '',
    distance_town TEXT NOT NULL DEFAULT '',
    development_status TEXT NOT NULL DEFAULT '',
    owner_name TEXT NOT NULL,
    owner_email TEXT NOT NULL,
    owner_phone TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS land_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id INTEGER NOT NULL REFERENCES land_listings(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS favorites (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    listing_id INTEGER NOT NULL REFERENCES land_listings(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, listing_id)
  );

  CREATE TABLE IF NOT EXISTS exchange_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id INTEGER NOT NULL REFERENCES land_listings(id) ON DELETE CASCADE,
    requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    contact TEXT NOT NULL,
    land_location TEXT NOT NULL,
    land_area TEXT NOT NULL,
    land_value REAL NOT NULL,
    photos TEXT NOT NULL DEFAULT '[]',
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id INTEGER NOT NULL REFERENCES land_listings(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_type TEXT NOT NULL DEFAULT 'contact',
    subject TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS equipment_listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    condition TEXT NOT NULL,
    price REAL NOT NULL CHECK (price > 0),
    price_unit TEXT NOT NULL CHECK (price_unit IN ('hour', 'day')),
    available_from TEXT NOT NULL,
    available_until TEXT NOT NULL,
    owner_phone TEXT NOT NULL DEFAULT '',
    locality TEXT NOT NULL,
    latitude REAL NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude REAL NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    photos TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'Available'
      CHECK (status IN ('Available', 'Booked', 'In Use', 'Expired')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (available_until > available_from)
  );

  CREATE TABLE IF NOT EXISTS equipment_bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id INTEGER NOT NULL REFERENCES equipment_listings(id) ON DELETE RESTRICT,
    renter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    total_price REAL NOT NULL CHECK (total_price >= 0),
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled', 'completed')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (ends_at > starts_at)
  );

  CREATE TABLE IF NOT EXISTS equipment_availability_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id INTEGER NOT NULL REFERENCES equipment_listings(id) ON DELETE CASCADE,
    starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    CHECK (ends_at > starts_at)
  );

  CREATE TABLE IF NOT EXISTS equipment_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    booking_id INTEGER REFERENCES equipment_bookings(id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    read_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS land_listings_location_idx
    ON land_listings(state, district, location);
  CREATE INDEX IF NOT EXISTS land_listings_price_idx
    ON land_listings(price);
  CREATE INDEX IF NOT EXISTS land_listings_created_idx
    ON land_listings(created_at);
  CREATE INDEX IF NOT EXISTS equipment_listings_window_idx
    ON equipment_listings(status, available_until);
  CREATE INDEX IF NOT EXISTS equipment_listings_owner_idx
    ON equipment_listings(owner_id, created_at);
  CREATE INDEX IF NOT EXISTS equipment_bookings_window_idx
    ON equipment_bookings(listing_id, status, starts_at, ends_at);
  CREATE INDEX IF NOT EXISTS equipment_availability_slots_window_idx
    ON equipment_availability_slots(listing_id, starts_at, ends_at);
  CREATE INDEX IF NOT EXISTS equipment_bookings_renter_idx
    ON equipment_bookings(renter_id, created_at);
  CREATE INDEX IF NOT EXISTS equipment_notifications_user_idx
    ON equipment_notifications(user_id, read_at, created_at);
`);

function syncEquipmentStatuses() {
  const now = new Date().toISOString();
  db.prepare(`UPDATE equipment_listings
    SET status = 'Expired'
    WHERE status <> 'Expired' AND available_until <= ?`).run(now);

  const activeListings = db.prepare(`SELECT id FROM equipment_listings
    WHERE status <> 'Expired' AND available_until > ?`).all(now);
  const setStatus = db.prepare('UPDATE equipment_listings SET status = ? WHERE id = ?');
  const activeBookingQuery = db.prepare(`SELECT starts_at, ends_at FROM equipment_bookings
    WHERE listing_id = ? AND status = 'confirmed' AND ends_at > ?
    ORDER BY starts_at`);

  for (const listing of activeListings) {
    const bookings = activeBookingQuery.all(listing.id, now);
    const inUse = bookings.some((booking) => booking.starts_at <= now && booking.ends_at > now);
    const booked = bookings.some((booking) => booking.starts_at > now);
    setStatus.run(inUse ? 'In Use' : booked ? 'Booked' : 'Available', listing.id);
  }
}

syncEquipmentStatuses();
const equipmentStatusTimer = setInterval(syncEquipmentStatuses, 15_000);
equipmentStatusTimer.unref();

const regionsForSeed = [
    { state: 'Andhra Pradesh', districts: ['Chittoor', 'Annamayya', 'Tirupati', 'Nellore', 'Prakasam'], places: [['Palamaner', 'Kuppam'], ['Madanapalle', 'Rayachoti'], ['Srikalahasti', 'Puttur'], ['Kavali', 'Venkatagiri'], ['Markapur', 'Ongole']] },
    { state: 'Telangana', districts: ['Rangareddy', 'Medchal-Malkajgiri', 'Warangal', 'Nalgonda', 'Karimnagar'], places: [['Shankarpally', 'Chevella'], ['Medchal', 'Ghatkesar'], ['Parkal', 'Narsampet'], ['Miryalaguda', 'Devarakonda'], ['Huzurabad', 'Jammikunta']] },
    { state: 'Karnataka', districts: ['Bengaluru Rural', 'Mysuru', 'Mandya', 'Tumakuru', 'Hassan'], places: [['Devanahalli', 'Doddaballapura'], ['Nanjangud', 'Hunsur'], ['Srirangapatna', 'Malavalli'], ['Kunigal', 'Tiptur'], ['Channarayapatna', 'Holenarasipura']] },
    { state: 'Tamil Nadu', districts: ['Coimbatore', 'Madurai', 'Tiruvallur', 'Salem', 'Erode'], places: [['Pollachi', 'Mettupalayam'], ['Usilampatti', 'Melur'], ['Ponneri', 'Tiruttani'], ['Attur', 'Mettur'], ['Gobichettipalayam', 'Bhavani']] },
    { state: 'Kerala', districts: ['Palakkad', 'Thrissur', 'Ernakulam', 'Wayanad', 'Kozhikode'], places: [['Ottapalam', 'Mannarkkad'], ['Chalakudy', 'Irinjalakuda'], ['Perumbavoor', 'Muvattupuzha'], ['Sulthan Bathery', 'Mananthavady'], ['Koyilandy', 'Thamarassery']] }
];

function seedLandListings() {
  const count = db.prepare('SELECT COUNT(*) AS count FROM land_listings').get().count;
  if (count) return;
  const titles = ['Orchard-ready farmland', 'Elevated residential plot', 'Irrigated agricultural land', 'Quiet countryside parcel', 'Roadside investment plot', 'River-belt farm land', 'Developing township plot', 'Fenced coconut grove', 'Open-view hill-side land', 'Fertile multi-crop parcel'];
  const landTypes = ['Agricultural', 'Residential', 'Farm land', 'Commercial', 'Plantation'];
  const roads = ['Paved road', 'Village road', 'Seasonal road', 'Highway frontage'];
  const water = ['Borewell', 'Open well', 'Canal nearby', 'Rain-fed', 'Borewell and open well'];
  const ownership = ['Clear title', 'Patta available', 'Registered deed', 'Documents verified'];
  const facilities = ['School, bus stop, weekly market', 'Primary health centre, grocery shops', 'Temple, school and local market', 'Bus stop, bank and fuel station', 'College, clinic and market'];
  const sellers = ['Srinivas Reddy', 'Lakshmi Narayan', 'Ramesh Gowda', 'Meenakshi Nair', 'Venkatesh Rao', 'Anitha Kumar', 'Prakash Shetty', 'Suresh Babu', 'Geetha Menon', 'Ravi Teja'];
  const photos = [
    'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80&sat=-12',
    'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=85&hue=18',
    'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=85&hue=42',
    'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1200&q=80&sat=-20',
    'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=85&hue=65',
    'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1200&q=85&hue=12'
  ];
  const insertListing = db.prepare(`
    INSERT INTO land_listings (
      title, state, district, location, exact_location, area, area_unit, price,
      land_type, road_access, road_width, water_availability,
      electricity_availability, ownership_status, sale_type, exchange_location,
      exchange_area, exchange_conditions, description, survey_number,
      nearby_facilities, distance_main_road, distance_town, development_status,
      owner_name, owner_email, owner_phone, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'acre', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertImage = db.prepare('INSERT INTO land_images (listing_id, image_url, position) VALUES (?, ?, ?)');

  db.exec('BEGIN');
  try {
    for (let index = 0; index < 100; index += 1) {
      const regionIndex = index % regionsForSeed.length;
      const region = regionsForSeed[regionIndex];
      const districtIndex = Math.floor(index / regionsForSeed.length) % region.districts.length;
      const district = region.districts[districtIndex];
      const location = region.places[districtIndex][Math.floor(index / (regionsForSeed.length * region.districts.length)) % 2];
      const area = Number((0.35 + ((index * 17) % 120) / 10).toFixed(2));
      const price = 425000 + ((index * 137500) % 16500000);
      const saleType = index % 4 === 0 || index % 11 === 0 ? 'exchange' : 'sale';
      const createdAt = new Date(Date.now() - (index % 90) * 86400000).toISOString();
      const listingId = Number(insertListing.run(
        `${titles[index % titles.length]} near ${location} · ${district} ${index + 1}`,
        region.state,
        district,
        location,
        `${location} outskirts, ${district}`,
        area,
        price,
        landTypes[index % landTypes.length],
        roads[index % roads.length],
        `${12 + (index % 4) * 6} ft`,
        water[index % water.length],
        index % 5 === 1 ? 'Not connected' : 'Available',
        ownership[index % ownership.length],
        saleType,
        saleType === 'exchange' ? `${regionsForSeed[(regionIndex + 1) % regionsForSeed.length].state}, preferably near a district town` : '',
        saleType === 'exchange' ? `${Math.max(0.5, Number((area * (0.8 + (index % 5) / 10)).toFixed(2)))} acres` : '',
        saleType === 'exchange' ? 'Open to fair-value offers; clear ownership documents required.' : '',
        `${area} acres of ${landTypes[index % landTypes.length].toLowerCase()} in ${location}. ${water[index % water.length]} access and ${roads[index % roads.length].toLowerCase()}. Suitable for cultivation, a weekend retreat or a long-term land investment. ${facilities[index % facilities.length]}. Site visit can be arranged with the owner.`,
        `SUR-${district.slice(0, 3).toUpperCase()}-${String(1100 + index * 7)}`,
        facilities[index % facilities.length],
        `${1 + (index % 12)} km`,
        `${4 + (index % 29)} km`,
        index % 3 === 0 ? 'Fenced, levelled and ready to build' : index % 3 === 1 ? 'Cultivated; boundary stones in place' : 'Open land with natural tree cover',
        sellers[index % sellers.length],
        `owner${index + 1}@example.com`,
        `+91 98${String(10000000 + index * 7919).slice(0, 8)}`,
        createdAt
      ).lastInsertRowid);

      for (let position = 0; position < 3; position += 1) {
        insertImage.run(listingId, photos[(index + position) % photos.length], position);
      }
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

seedLandListings();

function syncSampleLocations() {
  const sampleListings = db.prepare(`SELECT id, state, district, location, title, description
    FROM land_listings WHERE owner_id IS NULL AND owner_email LIKE 'owner%@example.com' ORDER BY id`).all();
  const locationCounts = new Map();
  const update = db.prepare('UPDATE land_listings SET location = ?, exact_location = ?, title = ?, description = ? WHERE id = ?');
  for (const listing of sampleListings) {
    const region = regionsForSeed.find((item) => item.state === listing.state);
    const districtIndex = region?.districts.indexOf(listing.district) ?? -1;
    if (districtIndex < 0) continue;
    const key = `${listing.state}:${listing.district}`;
    const count = locationCounts.get(key) || 0;
    locationCounts.set(key, count + 1);
    const location = region.places[districtIndex][count % 2];
    const title = listing.title.replace(/ near .* · /, ` near ${location} · `);
    const description = listing.description.split(listing.location).join(location);
    update.run(location, `${location} outskirts, ${listing.district}`, title, description, listing.id);
  }
}

syncSampleLocations();

// ===============================
// RESPONSE HELPERS
// ===============================

function sendJson(response, status, body, headers = {}) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...headers
  });

  response.end(JSON.stringify(body));
}

function sendError(response, status, message) {
  sendJson(response, status, {
    error: message
  });
}

// ===============================
// READ JSON REQUEST
// ===============================

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';

    request.on('data', (chunk) => {
      body += chunk;

      if (body.length > 1e7) {
        request.destroy();
        reject(new Error('Request body too large.'));
      }
    });

    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON.'));
      }
    });

    request.on('error', reject);
  });
}

// ===============================
// AUTHORIZATION
// ===============================

function requireUser(request, response, roles = []) {
  const cookies = parseCookies(
    request.headers.cookie || ''
  );

  const user = getSessionUser(
    db,
    cookies.session
  );

  if (!user) {
    sendError(
      response,
      401,
      'Your session is missing or expired.'
    );

    return null;
  }

  if (
    roles.length &&
    !roles.includes(user.role)
  ) {
    sendError(
      response,
      403,
      'You do not have permission to perform this action.'
    );

    return null;
  }

  return user;
}

const equipmentCategories = ['Agriculture', 'Construction', 'Daily use', 'Other'];
const equipmentConditions = ['New', 'Good', 'Fair', 'Needs repair'];

function haversineKm(latitudeA, longitudeA, latitudeB, longitudeB) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const latitudeDelta = radians(latitudeB - latitudeA);
  const longitudeDelta = radians(longitudeB - longitudeA);
  const distance = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(latitudeA)) * Math.cos(radians(latitudeB)) *
    Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(distance), Math.sqrt(1 - distance));
}

function validEquipmentPhotos(photos) {
  return Array.isArray(photos) && photos.length > 0 && photos.length <= 5 &&
    photos.every((photo) => typeof photo === 'string' && photo.length <= 1_500_000 &&
      (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(photo) ||
        /^https:\/\//.test(photo)));
}

function recordEquipmentNotification(userId, bookingId, message) {
  db.prepare(`INSERT INTO equipment_notifications (user_id, booking_id, message)
    VALUES (?, ?, ?)`).run(userId, bookingId, message);
}

function notifyBookingParticipants(booking, message) {
  const ownerId = Number(booking.owner_id);
  const renterId = Number(booking.renter_id);
  recordEquipmentNotification(ownerId, booking.id, message);
  if (renterId !== ownerId) recordEquipmentNotification(renterId, booking.id, message);
}

function validCoordinate(value, minimum, maximum) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return false;
  const coordinate = Number(value);
  return Number.isFinite(coordinate) && coordinate >= minimum && coordinate <= maximum;
}

// ===============================
// API ROUTES
// ===============================

async function handleApi(request, response, url) {

  // --------------------------------
  // CHECK CURRENT LOGIN
  // --------------------------------

  if (
    request.method === 'GET' &&
    url.pathname === '/api/auth/me'
  ) {
    const cookies = parseCookies(
      request.headers.cookie || ''
    );

    const user = getSessionUser(
      db,
      cookies.session
    );

    return sendJson(response, 200, {
      user
    });
  }

  // --------------------------------
  // REGISTER
  // --------------------------------

  if (
    request.method === 'POST' &&
    url.pathname === '/api/auth/register'
  ) {
    try {
      const {
        name,
        email,
        password,
        role
      } = await readJson(request);

      const normalizedEmail =
        normalizeEmail(email);

      if (
        !name?.trim() ||
        !normalizedEmail ||
        !password ||
        password.length < 8
      ) {
        return sendError(
          response,
          400,
          'Name, valid email, and a password of at least 8 characters are required.'
        );
      }

      const selectedRole =
        role === 'Admin'
          ? 'Admin'
          : 'Village Officer';

      const passwordHash =
        await hashPassword(password);

      const result = db.prepare(`
        INSERT INTO users
        (name, email, role, password_hash)
        VALUES (?, ?, ?, ?)
      `).run(
        name.trim(),
        normalizedEmail,
        selectedRole,
        passwordHash
      );

      const session = createSession(
        db,
        result.lastInsertRowid
      );

      return sendJson(
        response,
        201,
        {
          user: {
            id: result.lastInsertRowid,
            name: name.trim(),
            email: normalizedEmail,
            role: selectedRole
          }
        },
        {
          'Set-Cookie':
            sessionCookie(session.token)
        }
      );

    } catch (error) {

      if (
        error.code ===
          'SQLITE_CONSTRAINT_UNIQUE' ||
        /UNIQUE constraint failed/i.test(
          error.message || ''
        )
      ) {
        return sendError(
          response,
          409,
          'An account with that email already exists.'
        );
      }

      console.error(error);

      return sendError(
        response,
        500,
        'Unable to create the account.'
      );
    }
  }

  // --------------------------------
  // LOGIN
  // --------------------------------

  if (
    request.method === 'POST' &&
    url.pathname === '/api/auth/login'
  ) {
    try {
      const {
        email,
        password
      } = await readJson(request);

      const normalizedEmail =
        normalizeEmail(email);

      if (!normalizedEmail || !password) {
        return sendError(
          response,
          400,
          'Email and password are required.'
        );
      }

      const user = db.prepare(`
        SELECT
          id,
          name,
          email,
          role,
          password_hash
        FROM users
        WHERE email = ?
      `).get(normalizedEmail);

      if (
        !user ||
        !(await verifyPassword(
          password,
          user.password_hash
        ))
      ) {
        return sendError(
          response,
          401,
          'Invalid email or password.'
        );
      }

      const session = createSession(
        db,
        user.id
      );

      delete user.password_hash;

      return sendJson(
        response,
        200,
        {
          user
        },
        {
          'Set-Cookie':
            sessionCookie(session.token)
        }
      );

    } catch (error) {

      console.error(error);

      return sendError(
        response,
        500,
        'Unable to sign in.'
      );
    }
  }

  // --------------------------------
  // LOGOUT
  // --------------------------------

  if (
    request.method === 'POST' &&
    url.pathname === '/api/auth/logout'
  ) {
    const cookies = parseCookies(
      request.headers.cookie || ''
    );

    const token = cookies.session;

    if (token) {
      db.prepare(
        'DELETE FROM sessions WHERE token = ?'
      ).run(token);
    }

    return sendJson(
      response,
      200,
      { ok: true },
      {
        'Set-Cookie':
          sessionCookie('', 0)
      }
    );
  }

  // --------------------------------
  // GET ALL USERS - ADMIN
  // --------------------------------

  if (
    request.method === 'GET' &&
    url.pathname === '/api/admin/users'
  ) {
    const user = requireUser(
      request,
      response,
      ['Admin']
    );

    if (!user) return true;

    const users = db.prepare(`
      SELECT
        id,
        name,
        email,
        role,
        created_at
      FROM users
      ORDER BY name
    `).all();

    return sendJson(response, 200, {
      users
    });
  }

  // --------------------------------
  // UPDATE USER ROLE - ADMIN
  // --------------------------------

  const adminUserMatch =
    url.pathname.match(
      /^\/api\/admin\/users\/(\d+)$/
    );

  if (
    request.method === 'PATCH' &&
    adminUserMatch
  ) {
    const user = requireUser(
      request,
      response,
      ['Admin']
    );

    if (!user) return true;

    const userId =
      Number(adminUserMatch[1]);

    const { role } =
      await readJson(request);

    if (
      !['Admin', 'Village Officer']
        .includes(role)
    ) {
      return sendError(
        response,
        400,
        'Invalid role.'
      );
    }

    db.prepare(`
      UPDATE users
      SET role = ?
      WHERE id = ?
    `).run(role, userId);

    return sendJson(response, 200, {
      ok: true
    });
  }

  // --------------------------------
  // GET VILLAGES
  // --------------------------------

  if (
    request.method === 'GET' &&
    url.pathname === '/api/villages'
  ) {
    const user =
      requireUser(request, response);

    if (!user) return true;

    const villages =
      user.role === 'Admin'
        ? db.prepare(`
            SELECT
              id,
              name,
              assigned_officer_id
            FROM villages
            ORDER BY name
          `).all()
        : db.prepare(`
            SELECT
              id,
              name,
              assigned_officer_id
            FROM villages
            WHERE assigned_officer_id = ?
            ORDER BY name
          `).all(user.id);

    return sendJson(response, 200, {
      villages
    });
  }

  // --------------------------------
  // CREATE VILLAGE - ADMIN
  // --------------------------------

  if (
    request.method === 'POST' &&
    url.pathname === '/api/villages'
  ) {
    const user =
      requireUser(
        request,
        response,
        ['Admin']
      );

    if (!user) return true;

    const {
      name,
      assignedOfficerId = null
    } = await readJson(request);

    if (!name?.trim()) {
      return sendError(
        response,
        400,
        'Village name is required.'
      );
    }

    const result = db.prepare(`
      INSERT INTO villages
      (name, assigned_officer_id)
      VALUES (?, ?)
    `).run(
      name.trim(),
      assignedOfficerId || null
    );

    return sendJson(
      response,
      201,
      {
        id: result.lastInsertRowid,
        name: name.trim(),
        assignedOfficerId
      }
    );
  }

  // --------------------------------
  // VILLAGE ASSETS / PROBLEMS
  // --------------------------------

  const villageMatch =
    url.pathname.match(
      /^\/api\/villages\/(\d+)\/(assets|problems)$/
    );

  if (
    villageMatch &&
    ['GET', 'POST'].includes(request.method)
  ) {
    const user =
      requireUser(request, response);

    if (!user) return true;

    const villageId =
      Number(villageMatch[1]);

    const type =
      villageMatch[2];

    const village = db.prepare(`
      SELECT
        id,
        name,
        assigned_officer_id
      FROM villages
      WHERE id = ?
    `).get(villageId);

    if (
      !village ||
      (
        user.role !== 'Admin' &&
        village.assigned_officer_id !== user.id
      )
    ) {
      return sendError(
        response,
        403,
        'You do not have access to this village.'
      );
    }

    // ASSETS
    if (type === 'assets') {

      if (request.method === 'GET') {
        const assets = db.prepare(`
          SELECT
            id,
            asset_type,
            name,
            status
          FROM village_assets
          WHERE village_id = ?
        `).all(villageId);

        return sendJson(response, 200, {
          assets
        });
      }

      const {
        assetType,
        name,
        status = 'online'
      } = await readJson(request);

      if (
        !assetType ||
        !name?.trim()
      ) {
        return sendError(
          response,
          400,
          'Asset type and name are required.'
        );
      }

      const result = db.prepare(`
        INSERT INTO village_assets
        (village_id, asset_type, name, status)
        VALUES (?, ?, ?, ?)
      `).run(
        villageId,
        assetType,
        name.trim(),
        status
      );

      return sendJson(
        response,
        201,
        {
          id: result.lastInsertRowid
        }
      );
    }

    // PROBLEMS
    if (request.method === 'GET') {
      const problems = db.prepare(`
        SELECT
          id,
          description,
          status,
          created_by
        FROM problems
        WHERE village_id = ?
        ORDER BY id DESC
      `).all(villageId);

      return sendJson(response, 200, {
        problems
      });
    }

    const {
      description
    } = await readJson(request);

    if (!description?.trim()) {
      return sendError(
        response,
        400,
        'Problem description is required.'
      );
    }

    const result = db.prepare(`
      INSERT INTO problems
      (village_id, description, created_by)
      VALUES (?, ?, ?)
    `).run(
      villageId,
      description.trim(),
      user.id
    );

    return sendJson(
      response,
      201,
      {
        id: result.lastInsertRowid
      }
    );
  }

  const listingPath = url.pathname.match(/^\/api\/land\/listings\/(\d+)$/);
  const favoritePath = url.pathname.match(/^\/api\/land\/favorites\/(\d+)$/);
  const nestedListingPath = url.pathname.match(/^\/api\/land\/listings\/(\d+)\/(exchange-requests|messages)$/);

  function currentUser() {
    return getSessionUser(db, parseCookies(request.headers.cookie || '').session);
  }

  function listingWithImages(listing, user) {
    const images = db.prepare('SELECT image_url FROM land_images WHERE listing_id = ? ORDER BY position, id').all(listing.id);
    return {
      ...listing,
      images: images.map((image) => image.image_url),
      is_favorite: user ? Boolean(db.prepare('SELECT 1 FROM favorites WHERE user_id = ? AND listing_id = ?').get(user.id, listing.id)) : false
    };
  }

  function validImages(images) {
    return Array.isArray(images) ? images.slice(0, 5).filter((image) =>
      typeof image === 'string' &&
      image.length <= 2500000 &&
      (/^data:image\/(jpeg|png|webp);base64,/.test(image) || /^https:\/\//.test(image))
    ) : [];
  }

  if (request.method === 'GET' && url.pathname === '/api/land/listings') {
    const params = url.searchParams;
    const where = [];
    const values = [];
    const exactFilters = [
      ['state', 'state'], ['district', 'district'], ['landType', 'land_type'],
      ['saleType', 'sale_type'], ['roadAccess', 'road_access'],
      ['waterAvailability', 'water_availability'],
      ['electricityAvailability', 'electricity_availability']
    ];
    exactFilters.forEach(([parameter, column]) => {
      if (params.get(parameter)) {
        where.push(`${column} = ?`);
        values.push(params.get(parameter));
      }
    });
    if (params.get('location')) {
      where.push('(location LIKE ? OR district LIKE ?)');
      values.push(`%${params.get('location')}%`, `%${params.get('location')}%`);
    }
    if (params.get('search')) {
      where.push('(title LIKE ? OR description LIKE ? OR location LIKE ? OR district LIKE ?)');
      const search = `%${params.get('search')}%`;
      values.push(search, search, search, search);
    }
    [['minPrice', 'price', '>='], ['maxPrice', 'price', '<='], ['minArea', 'area', '>='], ['maxArea', 'area', '<=']].forEach(([parameter, column, operator]) => {
      const value = Number(params.get(parameter));
      if (params.has(parameter) && Number.isFinite(value)) {
        where.push(`${column} ${operator} ?`);
        values.push(value);
      }
    });

    const orderBy = {
      newest: 'created_at DESC, id DESC',
      price_asc: 'price ASC, id DESC',
      price_desc: 'price DESC, id DESC',
      area_asc: 'area ASC, id DESC',
      area_desc: 'area DESC, id DESC'
    }[params.get('sort')] || 'created_at DESC, id DESC';
    const page = Math.max(1, Number(params.get('page')) || 1);
    const limit = Math.min(48, Math.max(1, Number(params.get('limit')) || 24));
    const condition = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = db.prepare(`SELECT COUNT(*) AS count FROM land_listings ${condition}`).get(...values).count;
    const rows = db.prepare(`SELECT * FROM land_listings ${condition} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
      .all(...values, limit, (page - 1) * limit);
    const user = currentUser();
    return sendJson(response, 200, {
      listings: rows.map((listing) => listingWithImages(listing, user)),
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  }

  if (request.method === 'GET' && url.pathname === '/api/land/my/listings') {
    const user = requireUser(request, response);
    if (!user) return true;
    const listings = db.prepare('SELECT * FROM land_listings WHERE owner_id = ? ORDER BY created_at DESC').all(user.id);
    return sendJson(response, 200, { listings: listings.map((listing) => listingWithImages(listing, user)) });
  }

  if (request.method === 'GET' && url.pathname === '/api/land/listings/filters') {
    const rows = db.prepare('SELECT DISTINCT state, district, land_type, road_access, water_availability, electricity_availability FROM land_listings ORDER BY state, district').all();
    return sendJson(response, 200, { options: rows });
  }

  if (request.method === 'GET' && listingPath) {
    const listing = db.prepare('SELECT * FROM land_listings WHERE id = ?').get(Number(listingPath[1]));
    if (!listing) return sendError(response, 404, 'Listing not found.');
    return sendJson(response, 200, { listing: listingWithImages(listing, currentUser()) });
  }

  if (request.method === 'POST' && url.pathname === '/api/land/listings') {
    const user = requireUser(request, response);
    if (!user) return true;
    const body = await readJson(request);
    const required = ['title', 'state', 'district', 'location', 'land_type', 'road_access', 'water_availability', 'electricity_availability', 'ownership_status', 'description'];
    if (required.some((field) => !String(body[field] || '').trim()) || !(Number(body.area) > 0) || !(Number(body.price) > 0)) {
      return sendError(response, 400, 'Add a title, location, positive area and price, and the required property details.');
    }
    const saleType = body.sale_type === 'exchange' ? 'exchange' : 'sale';
    const values = [
      body.title.trim(), body.state, body.district, body.location, body.exact_location || '',
      Number(body.area), body.area_unit || 'acre', Number(body.price), body.land_type,
      body.road_access, body.road_width || '', body.water_availability,
      body.electricity_availability, body.ownership_status, saleType,
      body.exchange_location || '', body.exchange_area || '', body.exchange_conditions || '',
      body.description.trim(), body.survey_number || '', body.nearby_facilities || '',
      body.distance_main_road || '', body.distance_town || '', body.development_status || '',
      user.id, (body.owner_name || user.name).trim(), user.email,
      body.owner_phone || '', new Date().toISOString()
    ];
    const inserted = db.prepare(`INSERT INTO land_listings (
      title, state, district, location, exact_location, area, area_unit, price,
      land_type, road_access, road_width, water_availability, electricity_availability,
      ownership_status, sale_type, exchange_location, exchange_area, exchange_conditions,
      description, survey_number, nearby_facilities, distance_main_road, distance_town,
      development_status, owner_id, owner_name, owner_email, owner_phone, created_at
    ) VALUES (${values.map(() => '?').join(', ')})`).run(...values);
    const listingId = Number(inserted.lastInsertRowid);
    const insertImage = db.prepare('INSERT INTO land_images (listing_id, image_url, position) VALUES (?, ?, ?)');
    validImages(body.photos).forEach((image, index) => insertImage.run(listingId, image, index));
    const listing = db.prepare('SELECT * FROM land_listings WHERE id = ?').get(listingId);
    return sendJson(response, 201, { listing: listingWithImages(listing, user) });
  }

  if (listingPath && ['PATCH', 'DELETE'].includes(request.method)) {
    const user = requireUser(request, response);
    if (!user) return true;
    const listingId = Number(listingPath[1]);
    const listing = db.prepare('SELECT * FROM land_listings WHERE id = ?').get(listingId);
    if (!listing) return sendError(response, 404, 'Listing not found.');
    if (listing.owner_id !== user.id) return sendError(response, 403, 'Only the listing owner can change this property.');
    if (request.method === 'DELETE') {
      db.prepare('DELETE FROM land_listings WHERE id = ?').run(listingId);
      return sendJson(response, 200, { ok: true });
    }
    const body = await readJson(request);
    const fields = {
      title: 'title', state: 'state', district: 'district', location: 'location',
      exact_location: 'exact_location', area: 'area', area_unit: 'area_unit', price: 'price',
      land_type: 'land_type', road_access: 'road_access', road_width: 'road_width',
      water_availability: 'water_availability', electricity_availability: 'electricity_availability',
      ownership_status: 'ownership_status', sale_type: 'sale_type', exchange_location: 'exchange_location',
      exchange_area: 'exchange_area', exchange_conditions: 'exchange_conditions', description: 'description',
      survey_number: 'survey_number', nearby_facilities: 'nearby_facilities',
      distance_main_road: 'distance_main_road', distance_town: 'distance_town',
      development_status: 'development_status', owner_name: 'owner_name', owner_phone: 'owner_phone'
    };
    const updates = Object.entries(fields).filter(([key]) => Object.hasOwn(body, key));
    if (updates.length) {
      const set = updates.map(([, column]) => `${column} = ?`).join(', ');
      db.prepare(`UPDATE land_listings SET ${set}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .run(...updates.map(([key]) => body[key]), listingId);
    }
    if (Array.isArray(body.photos)) {
      db.prepare('DELETE FROM land_images WHERE listing_id = ?').run(listingId);
      const insertImage = db.prepare('INSERT INTO land_images (listing_id, image_url, position) VALUES (?, ?, ?)');
      validImages(body.photos).forEach((image, index) => insertImage.run(listingId, image, index));
    }
    return sendJson(response, 200, { listing: listingWithImages(db.prepare('SELECT * FROM land_listings WHERE id = ?').get(listingId), user) });
  }

  if (favoritePath && ['POST', 'DELETE'].includes(request.method)) {
    const user = requireUser(request, response);
    if (!user) return true;
    const listingId = Number(favoritePath[1]);
    if (!db.prepare('SELECT 1 FROM land_listings WHERE id = ?').get(listingId)) return sendError(response, 404, 'Listing not found.');
    if (request.method === 'POST') {
      db.prepare('INSERT OR IGNORE INTO favorites (user_id, listing_id) VALUES (?, ?)').run(user.id, listingId);
    } else {
      db.prepare('DELETE FROM favorites WHERE user_id = ? AND listing_id = ?').run(user.id, listingId);
    }
    return sendJson(response, 200, { favorited: request.method === 'POST' });
  }

  if (request.method === 'GET' && url.pathname === '/api/land/favorites') {
    const user = requireUser(request, response);
    if (!user) return true;
    const listings = db.prepare('SELECT l.* FROM land_listings l JOIN favorites f ON f.listing_id = l.id WHERE f.user_id = ? ORDER BY f.created_at DESC').all(user.id);
    return sendJson(response, 200, { listings: listings.map((listing) => listingWithImages(listing, user)) });
  }

  if (request.method === 'POST' && nestedListingPath?.[2] === 'exchange-requests') {
    const user = requireUser(request, response);
    if (!user) return true;
    const body = await readJson(request);
    if (!body.user_name?.trim() || !body.contact?.trim() || !body.land_location?.trim() || !body.land_area?.trim() || !(Number(body.land_value) > 0) || !body.message?.trim()) {
      return sendError(response, 400, 'Complete your contact details, land details, estimated value and message.');
    }
    const images = validImages(body.photos);
    const result = db.prepare(`INSERT INTO exchange_requests (
      listing_id, requester_id, user_name, contact, land_location, land_area,
      land_value, photos, message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      Number(nestedListingPath[1]), user.id, body.user_name.trim(), body.contact.trim(),
      body.land_location.trim(), body.land_area.trim(), Number(body.land_value),
      JSON.stringify(images), body.message.trim()
    );
    return sendJson(response, 201, { id: Number(result.lastInsertRowid) });
  }

  if (request.method === 'GET' && url.pathname === '/api/land/exchange-requests') {
    const user = requireUser(request, response);
    if (!user) return true;
    const requests = db.prepare(`SELECT r.*, l.title AS listing_title, l.owner_id
      FROM exchange_requests r JOIN land_listings l ON l.id = r.listing_id
      WHERE r.requester_id = ? OR l.owner_id = ? ORDER BY r.created_at DESC`).all(user.id, user.id);
    return sendJson(response, 200, { requests: requests.map((item) => ({ ...item, photos: JSON.parse(item.photos) })) });
  }

  if (request.method === 'POST' && nestedListingPath?.[2] === 'messages') {
    const user = requireUser(request, response);
    if (!user) return true;
    const body = await readJson(request);
    if (!body.body?.trim()) return sendError(response, 400, 'Write a message to the owner.');
    const result = db.prepare('INSERT INTO messages (listing_id, sender_id, message_type, subject, body) VALUES (?, ?, ?, ?, ?)')
      .run(Number(nestedListingPath[1]), user.id, body.message_type || 'contact', body.subject || '', body.body.trim());
    return sendJson(response, 201, { id: Number(result.lastInsertRowid) });
  }

  if (request.method === 'GET' && url.pathname === '/api/land/messages') {
    const user = requireUser(request, response);
    if (!user) return true;
    const messages = db.prepare(`SELECT m.*, l.title AS listing_title, l.owner_id, sender.name AS sender_name
      FROM messages m JOIN land_listings l ON l.id = m.listing_id
      JOIN users sender ON sender.id = m.sender_id
      WHERE m.sender_id = ? OR l.owner_id = ? ORDER BY m.created_at DESC`).all(user.id, user.id);
    return sendJson(response, 200, { messages });
  }

  if (request.method === 'GET' && url.pathname === '/api/equipment/listings') {
    const user = requireUser(request, response);
    if (!user) return true;
    syncEquipmentStatuses();

    const latitude = url.searchParams.get('lat');
    const longitude = url.searchParams.get('lng');
    const radius = Number(url.searchParams.get('radius') || 10);
    if (!validCoordinate(latitude, -90, 90) || !validCoordinate(longitude, -180, 180) ||
      ![1, 5, 10, 20].includes(radius)) {
      return sendError(response, 400, 'Provide valid coordinates and a radius of 1, 5, 10 or 20 km.');
    }

    const category = url.searchParams.get('category');
    const maxPrice = url.searchParams.get('maxPrice');
    if (category && !equipmentCategories.includes(category)) {
      return sendError(response, 400, 'Choose a valid equipment category.');
    }
    if (maxPrice && (!Number.isFinite(Number(maxPrice)) || Number(maxPrice) <= 0)) {
      return sendError(response, 400, 'Maximum price must be a positive number.');
    }

    const requestedFrom = url.searchParams.get('from');
    const requestedUntil = url.searchParams.get('until');
    const hasRequestedSlot = Boolean(requestedFrom || requestedUntil);
    const requestedFromMs = Date.parse(requestedFrom || '');
    const requestedUntilMs = Date.parse(requestedUntil || '');
    if (hasRequestedSlot && (!requestedFrom || !requestedUntil || !Number.isFinite(requestedFromMs) ||
      !Number.isFinite(requestedUntilMs) || requestedFromMs >= requestedUntilMs)) {
      return sendError(response, 400, 'Provide a valid start and end time for availability filtering.');
    }

    const where = ['listing.available_until > ?', "listing.status <> 'Expired'"];
    const values = [new Date().toISOString()];
    if (category) {
      where.push('listing.category = ?');
      values.push(category);
    }
    if (maxPrice) {
      where.push('listing.price <= ?');
      values.push(Number(maxPrice));
    }
    const rows = db.prepare(`SELECT listing.*, owner.name AS owner_name
      FROM equipment_listings listing JOIN users owner ON owner.id = listing.owner_id
      WHERE ${where.join(' AND ')} ORDER BY listing.created_at DESC LIMIT 1000`).all(...values);
    const centerLat = Number(latitude);
    const centerLng = Number(longitude);
    const overlapQuery = db.prepare(`SELECT 1 FROM equipment_bookings
      WHERE listing_id = ? AND status IN ('pending', 'confirmed')
        AND starts_at < ? AND ends_at > ? LIMIT 1`);
    const slotQuery = db.prepare(`SELECT 1 FROM equipment_availability_slots
      WHERE listing_id = ? AND starts_at <= ? AND ends_at >= ? LIMIT 1`);
    const listings = rows.map((listing) => {
      const distanceKm = haversineKm(centerLat, centerLng, listing.latitude, listing.longitude);
      const inSlot = !hasRequestedSlot || Boolean(
        slotQuery.get(listing.id, requestedFrom, requestedUntil) &&
        !overlapQuery.get(listing.id, requestedUntil, requestedFrom)
      );
      return {
        id: listing.id,
        owner_id: listing.owner_id,
        owner_name: listing.owner_name,
        name: listing.name,
        category: listing.category,
        description: listing.description,
        condition: listing.condition,
        price: listing.price,
        price_unit: listing.price_unit,
        available_from: listing.available_from,
        available_until: listing.available_until,
        locality: listing.locality,
        latitude: listing.latitude,
        longitude: listing.longitude,
        photos: JSON.parse(listing.photos),
        status: listing.status,
        distance_km: Number(distanceKm.toFixed(2)),
        slot_available: inSlot && listing.owner_id !== user.id
      };
    }).filter((listing) => listing.distance_km <= radius)
      .sort((first, second) => first.distance_km - second.distance_km);
    return sendJson(response, 200, { listings, radius_km: radius });
  }

  if (request.method === 'GET' && url.pathname === '/api/equipment/my-listings') {
    const user = requireUser(request, response);
    if (!user) return true;
    syncEquipmentStatuses();
    const listings = db.prepare(`SELECT * FROM equipment_listings
      WHERE owner_id = ? ORDER BY created_at DESC, id DESC`).all(user.id)
      .map((listing) => ({ ...listing, photos: JSON.parse(listing.photos) }));
    return sendJson(response, 200, { listings });
  }

  if (request.method === 'POST' && url.pathname === '/api/equipment/listings') {
    const user = requireUser(request, response);
    if (!user) return true;
    const body = await readJson(request);
    const name = String(body.name || '').trim();
    const description = String(body.description || '').trim();
    const locality = String(body.locality || '').trim();
    const phone = String(body.owner_phone || '').trim();
    const price = Number(body.price);
    const availableFromMs = Date.parse(body.available_from || '');
    const availableUntilMs = Date.parse(body.available_until || '');
    const timeZoneSuffix = (value) => typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(value);

    if (!name || name.length > 120 || !description || description.length > 2000 || !locality || locality.length > 160 ||
      !equipmentCategories.includes(body.category) || !equipmentConditions.includes(body.condition) ||
      !Number.isFinite(price) || price <= 0 || price > 10_000_000 || !['hour', 'day'].includes(body.price_unit) ||
      !timeZoneSuffix(body.available_from) || !timeZoneSuffix(body.available_until) ||
      !Number.isFinite(availableFromMs) || !Number.isFinite(availableUntilMs) ||
      availableFromMs <= Date.now() || availableUntilMs <= availableFromMs ||
      availableUntilMs - availableFromMs > 366 * 24 * 60 * 60 * 1000 ||
      !validCoordinate(body.latitude, -90, 90) || !validCoordinate(body.longitude, -180, 180) ||
      phone.length > 30 || (phone && !/^[+()\d .-]{5,30}$/.test(phone)) || !validEquipmentPhotos(body.photos)) {
      return sendError(response, 400, 'Check the item details, price, photos, contact number, coordinates and future availability window.');
    }

    const from = new Date(availableFromMs).toISOString();
    const until = new Date(availableUntilMs).toISOString();
    db.exec('BEGIN IMMEDIATE');
    let listingId;
    try {
      const inserted = db.prepare(`INSERT INTO equipment_listings (
        owner_id, name, category, description, condition, price, price_unit,
        available_from, available_until, owner_phone, locality, latitude, longitude, photos
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        user.id, name, body.category, description, body.condition, price, body.price_unit,
        from, until, phone, locality, Number(body.latitude), Number(body.longitude), JSON.stringify(body.photos)
      );
      listingId = Number(inserted.lastInsertRowid);
      db.prepare(`INSERT INTO equipment_availability_slots (listing_id, starts_at, ends_at)
        VALUES (?, ?, ?)`).run(listingId, from, until);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    const listing = db.prepare('SELECT * FROM equipment_listings WHERE id = ?').get(listingId);
    return sendJson(response, 201, { listing: { ...listing, photos: JSON.parse(listing.photos) } });
  }

  if (request.method === 'POST' && url.pathname === '/api/equipment/bookings') {
    const user = requireUser(request, response);
    if (!user) return true;
    const body = await readJson(request);
    const listingId = Number(body.listing_id);
    const startsMs = Date.parse(body.starts_at || '');
    const endsMs = Date.parse(body.ends_at || '');
    const hasTimeZone = (value) => typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(value);
    if (!Number.isSafeInteger(listingId) || listingId < 1 || !hasTimeZone(body.starts_at) || !hasTimeZone(body.ends_at) ||
      !Number.isFinite(startsMs) || !Number.isFinite(endsMs) || startsMs <= Date.now() || endsMs <= startsMs) {
      return sendError(response, 400, 'Choose a valid future booking time.');
    }
    const startsAt = new Date(startsMs).toISOString();
    const endsAt = new Date(endsMs).toISOString();
    db.exec('BEGIN IMMEDIATE');
    let bookingId;
    try {
      syncEquipmentStatuses();
      const listing = db.prepare('SELECT * FROM equipment_listings WHERE id = ?').get(listingId);
      if (!listing || listing.available_until <= new Date().toISOString() || listing.status === 'Expired') {
        db.exec('ROLLBACK');
        return sendError(response, 409, 'This listing has expired and cannot be booked.');
      }
      if (listing.owner_id === user.id) {
        db.exec('ROLLBACK');
        return sendError(response, 403, 'You cannot book your own equipment.');
      }
      const slot = db.prepare(`SELECT 1 FROM equipment_availability_slots
        WHERE listing_id = ? AND starts_at <= ? AND ends_at >= ? LIMIT 1`).get(listingId, startsAt, endsAt);
      if (!slot) {
        db.exec('ROLLBACK');
        return sendError(response, 409, 'The requested time is outside the owner availability window.');
      }
      const overlap = db.prepare(`SELECT 1 FROM equipment_bookings
        WHERE listing_id = ? AND status IN ('pending', 'confirmed')
          AND starts_at < ? AND ends_at > ? LIMIT 1`).get(listingId, endsAt, startsAt);
      if (overlap) {
        db.exec('ROLLBACK');
        return sendError(response, 409, 'That equipment already has a pending or confirmed booking during this time.');
      }
      const duration = (endsMs - startsMs) / (listing.price_unit === 'hour' ? 3_600_000 : 86_400_000);
      const totalPrice = Math.round(listing.price * duration * 100) / 100;
      const inserted = db.prepare(`INSERT INTO equipment_bookings (
        listing_id, renter_id, starts_at, ends_at, total_price
      ) VALUES (?, ?, ?, ?, ?)`).run(listingId, user.id, startsAt, endsAt, totalPrice);
      bookingId = Number(inserted.lastInsertRowid);
      recordEquipmentNotification(listing.owner_id, bookingId, `${user.name} requested ${listing.name}.`);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    return sendJson(response, 201, { booking_id: bookingId, status: 'pending' });
  }

  if (request.method === 'GET' && url.pathname === '/api/equipment/bookings') {
    const user = requireUser(request, response);
    if (!user) return true;
    syncEquipmentStatuses();
    const bookings = db.prepare(`SELECT booking.*, listing.name AS equipment_name,
      listing.category, listing.locality, listing.owner_id, listing.owner_phone,
      listing.photos, owner.name AS owner_name, renter.name AS renter_name
      FROM equipment_bookings booking
      JOIN equipment_listings listing ON listing.id = booking.listing_id
      JOIN users owner ON owner.id = listing.owner_id
      JOIN users renter ON renter.id = booking.renter_id
      WHERE booking.renter_id = ? OR listing.owner_id = ?
      ORDER BY booking.created_at DESC, booking.id DESC`).all(user.id, user.id)
      .map((booking) => ({
        ...booking,
        photos: JSON.parse(booking.photos),
        is_owner: booking.owner_id === user.id,
        owner_phone: booking.status === 'confirmed' || booking.status === 'completed' ? booking.owner_phone : ''
      }));
    return sendJson(response, 200, { bookings });
  }

  const equipmentBookingMatch = url.pathname.match(/^\/api\/equipment\/bookings\/(\d+)$/);
  if (equipmentBookingMatch && request.method === 'PATCH') {
    const user = requireUser(request, response);
    if (!user) return true;
    const body = await readJson(request);
    const action = body.action;
    if (!['confirm', 'reject', 'cancel', 'complete'].includes(action)) {
      return sendError(response, 400, 'Choose a valid booking action.');
    }
    const bookingId = Number(equipmentBookingMatch[1]);
    const booking = db.prepare(`SELECT booking.*, listing.owner_id, listing.name AS equipment_name,
      listing.available_until, renter.name AS renter_name
      FROM equipment_bookings booking
      JOIN equipment_listings listing ON listing.id = booking.listing_id
      JOIN users renter ON renter.id = booking.renter_id WHERE booking.id = ?`).get(bookingId);
    if (!booking) return sendError(response, 404, 'Booking not found.');
    const isOwner = booking.owner_id === user.id;
    const isRenter = booking.renter_id === user.id;
    if (!isOwner && !isRenter) return sendError(response, 403, 'You are not part of this booking.');
    if (['confirm', 'reject', 'complete'].includes(action) && !isOwner) {
      return sendError(response, 403, 'Only the equipment owner can perform this action.');
    }
    if (action === 'cancel' && !['pending', 'confirmed'].includes(booking.status)) {
      return sendError(response, 409, 'This booking can no longer be cancelled.');
    }
    if (action === 'confirm' && booking.status !== 'pending') {
      return sendError(response, 409, 'Only pending requests can be confirmed.');
    }
    if (action === 'reject' && booking.status !== 'pending') {
      return sendError(response, 409, 'Only pending requests can be rejected.');
    }
    if (action === 'complete' && (booking.status !== 'confirmed' || Date.parse(booking.ends_at) > Date.now())) {
      return sendError(response, 409, 'A confirmed rental can be completed after its return time.');
    }

    db.exec('BEGIN IMMEDIATE');
    try {
      if (action === 'confirm') {
        const now = new Date().toISOString();
        const listing = db.prepare('SELECT status, available_until FROM equipment_listings WHERE id = ?').get(booking.listing_id);
        if (!listing || listing.status === 'Expired' || listing.available_until <= now || booking.ends_at > listing.available_until) {
          db.exec('ROLLBACK');
          return sendError(response, 409, 'This listing or its requested time has expired.');
        }
        const overlap = db.prepare(`SELECT 1 FROM equipment_bookings
          WHERE listing_id = ? AND id <> ? AND status IN ('pending', 'confirmed')
            AND starts_at < ? AND ends_at > ? LIMIT 1`).get(
          booking.listing_id, booking.id, booking.ends_at, booking.starts_at
        );
        if (overlap) {
          db.exec('ROLLBACK');
          return sendError(response, 409, 'Another request overlaps this time. Resolve it before confirming.');
        }
      }
      const nextStatus = {
        confirm: 'confirmed', reject: 'rejected', cancel: 'cancelled', complete: 'completed'
      }[action];
      db.prepare('UPDATE equipment_bookings SET status = ?, updated_at = ? WHERE id = ?')
        .run(nextStatus, new Date().toISOString(), booking.id);
      const descriptions = {
        confirm: `${booking.equipment_name} booking accepted.`,
        reject: `${booking.equipment_name} booking request rejected.`,
        cancel: `${booking.equipment_name} booking cancelled.`,
        complete: `${booking.equipment_name} rental completed.`
      };
      notifyBookingParticipants(booking, descriptions[action]);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    syncEquipmentStatuses();
    return sendJson(response, 200, { booking_id: booking.id, status: {
      confirm: 'confirmed', reject: 'rejected', cancel: 'cancelled', complete: 'completed'
    }[action] });
  }

  if (request.method === 'GET' && url.pathname === '/api/equipment/notifications') {
    const user = requireUser(request, response);
    if (!user) return true;
    const notifications = db.prepare(`SELECT id, booking_id, message, read_at, created_at
      FROM equipment_notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 100`).all(user.id);
    return sendJson(response, 200, { notifications });
  }

  const equipmentNotificationMatch = url.pathname.match(/^\/api\/equipment\/notifications\/(\d+)$/);
  if (equipmentNotificationMatch && request.method === 'PATCH') {
    const user = requireUser(request, response);
    if (!user) return true;
    const result = db.prepare(`UPDATE equipment_notifications SET read_at = ?
      WHERE id = ? AND user_id = ? AND read_at IS NULL`)
      .run(new Date().toISOString(), Number(equipmentNotificationMatch[1]), user.id);
    if (!result.changes) return sendError(response, 404, 'Notification not found.');
    return sendJson(response, 200, { ok: true });
  }

  return false;
}

// ===============================
// STATIC FILE SERVER
// ===============================

function serveStatic(
  request,
  response,
  url
) {
  const requested =
    url.pathname === '/'
      ? '/rural-dashboard.html'
      : url.pathname;

  const filePath = path.resolve(
    ROOT,
    `.${requested}`
  );

  if (
    !filePath.startsWith(ROOT) ||
    !fs.existsSync(filePath) ||
    fs.statSync(filePath).isDirectory()
  ) {
    return sendError(
      response,
      404,
      'Not found.'
    );
  }

  const extension =
    path.extname(filePath);

  const types = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json'
  };

  response.writeHead(200, {
    'Content-Type':
      `${types[extension] || 'application/octet-stream'}; charset=utf-8`
  });

  fs.createReadStream(filePath)
    .pipe(response);
}

// ===============================
// HTTP SERVER
// ===============================

const server =
  http.createServer(
    async (request, response) => {

      const url = new URL(
        request.url,
        `http://${request.headers.host || 'localhost'}`
      );

      try {

        if (
          url.pathname.startsWith('/api/')
        ) {
          const handled =
            await handleApi(
              request,
              response,
              url
            );

          if (
            !handled &&
            !response.writableEnded
          ) {
            sendError(
              response,
              404,
              'API route not found.'
            );
          }

          return;
        }

        serveStatic(
          request,
          response,
          url
        );

      } catch (error) {

        console.error(error);

        if (!response.writableEnded) {
          sendError(
            response,
            500,
            'Unexpected server error.'
          );
        }
      }
    }
  );

// ===============================
// START SERVER
// ===============================

server.listen(
  PORT,
  () => {
    console.log(
      `Rural Technology Dashboard running at http://localhost:${PORT}`
    );
  }
);
