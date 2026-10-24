const state = {
  user: null,
  center: null,
  listings: [],
  map: null,
  markerLayer: null,
  selectedListing: null,
  photos: [],
  activeView: 'discover',
  toastTimer: null
};

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const imageFallback = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260"><rect width="400" height="260" fill="#e5ebe0"/><path d="M0 180 95 100l84 52 83-74 138 104v78H0Z" fill="#8aaa7a"/><path d="M0 210q94-45 190 0t210-9v59H0Z" fill="#507655"/></svg>')}`;

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function localDateTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Time unavailable';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function localInputValue(date) {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return adjusted.toISOString().slice(0, 16);
}

function inputToIso(value) {
  return value ? new Date(value).toISOString() : '';
}

function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('visible');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => element.classList.remove('visible'), 3000);
}

function setLocationStatus(message, isError = false) {
  const status = $('#locationStatus');
  status.textContent = message;
  status.dataset.state = isError ? 'error' : 'ready';
}

function validCoordinates(latitude, longitude) {
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
    Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}

async function setLocation(latitude, longitude, label = 'Selected map coordinates') {
  if (!validCoordinates(latitude, longitude)) {
    setLocationStatus('Enter valid latitude and longitude coordinates.', true);
    return;
  }
  state.center = { latitude, longitude, label };
  $('#searchLatitude').value = latitude.toFixed(6);
  $('#searchLongitude').value = longitude.toFixed(6);
  setLocationStatus(`Showing equipment near ${label}.`);
  await loadNearby();
}

function locateUser() {
  if (!navigator.geolocation) {
    setLocationStatus('Location is not available in this browser. Enter coordinates or search for a place.', true);
    return;
  }
  setLocationStatus('Requesting your location…');
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => setLocation(coords.latitude, coords.longitude, 'your current location'),
    () => setLocationStatus('Location access was unavailable. Enter coordinates or search for a place instead.', true),
    { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 }
  );
}

async function searchPlace() {
  const query = $('#placeSearch').value.trim();
  if (!query) return setLocationStatus('Enter a village, town or place name first.', true);
  setLocationStatus('Looking up the selected place…');
  try {
    const params = new URLSearchParams({ q: query, format: 'jsonv2', limit: '1' });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) throw new Error('Place lookup is temporarily unavailable. Enter coordinates instead.');
    const results = await response.json();
    if (!results.length) throw new Error('No matching place was found. Try a nearby town or coordinates.');
    const result = results[0];
    await setLocation(Number(result.lat), Number(result.lon), result.display_name.split(',').slice(0, 2).join(','));
  } catch (error) {
    setLocationStatus(error.message, true);
  }
}

function ensureMap() {
  if (!state.center || !window.L) return;
  const radius = Number(new FormData($('#searchFilters')).get('radius') || 5);
  const zoom = ({ 1: 15, 5: 13, 10: 12, 20: 11 })[radius] || 13;
  if (!state.map) {
    state.map = L.map('equipmentMap', { scrollWheelZoom: false }).setView(
      [state.center.latitude, state.center.longitude], zoom
    );
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(state.map);
    state.markerLayer = L.layerGroup().addTo(state.map);
  } else {
    state.map.setView([state.center.latitude, state.center.longitude], zoom);
    state.map.invalidateSize();
  }
  state.markerLayer.clearLayers();
  L.circleMarker([state.center.latitude, state.center.longitude], {
    radius: 7, color: '#fff', weight: 2, fillColor: '#c86535', fillOpacity: 1
  }).bindPopup('Search center').addTo(state.markerLayer);
  state.listings.forEach((listing, index) => {
    const icon = L.divIcon({
      className: '',
      html: `<div class="map-marker"><span>${index + 1}</span></div>`,
      iconSize: [28, 34],
      iconAnchor: [14, 32]
    });
    const marker = L.marker([listing.latitude, listing.longitude], { icon });
    marker.bindPopup(`<strong>${escapeHtml(listing.name)}</strong><br>${currency.format(listing.price)} / ${escapeHtml(listing.price_unit)}<br>${listing.distance_km} km away`);
    marker.addTo(state.markerLayer);
    listing.marker = marker;
  });
}

function requestedSlotParams() {
  const form = new FormData($('#searchFilters'));
  const from = String(form.get('from') || '');
  const until = String(form.get('until') || '');
  if (Boolean(from) !== Boolean(until)) throw new Error('Choose both an availability start and end time.');
  if (from && new Date(from) >= new Date(until)) throw new Error('Availability end must be after its start.');
  return { from: from ? inputToIso(from) : '', until: until ? inputToIso(until) : '' };
}

async function loadNearby() {
  if (!state.center) return;
  const container = $('#nearbyListings');
  container.innerHTML = '<p class="empty-state">Finding equipment near this location…</p>';
  try {
    const filters = new FormData($('#searchFilters'));
    const slot = requestedSlotParams();
    const params = new URLSearchParams({
      lat: String(state.center.latitude),
      lng: String(state.center.longitude),
      radius: String(filters.get('radius') || 5)
    });
    ['category', 'maxPrice'].forEach((name) => {
      const value = String(filters.get(name) || '').trim();
      if (value) params.set(name, value);
    });
    if (slot.from) {
      params.set('from', slot.from);
      params.set('until', slot.until);
    }
    const result = await api(`/api/equipment/listings?${params}`);
    state.listings = result.listings;
    renderNearby();
    ensureMap();
    $('#mapResultCount').textContent = `${state.listings.length} within ${result.radius_km} km`;
    $('#resultCount').textContent = `${state.listings.length} item${state.listings.length === 1 ? '' : 's'}`;
    setLocationStatus(`Showing actual map locations within ${result.radius_km} km of ${state.center.label}.`);
  } catch (error) {
    container.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`;
    setLocationStatus(error.message, true);
  }
}

function renderNearby() {
  const container = $('#nearbyListings');
  if (!state.listings.length) {
    container.innerHTML = '<p class="empty-state">No equipment matches this area and time. Try widening the radius or changing your filters.</p>';
    return;
  }
  container.innerHTML = state.listings.map((listing, index) => `
    <article class="equipment-card" id="nearby-${listing.id}" style="animation-delay:${Math.min(index, 8) * 20}ms">
      <img src="${escapeHtml(listing.photos[0] || imageFallback)}" alt="${escapeHtml(listing.name)}" loading="lazy" onerror="this.onerror=null;this.src='${imageFallback}'">
      <div class="equipment-card-body">
        <div class="card-topline"><span>${escapeHtml(listing.category)} · ${listing.distance_km} km</span><span class="status-label ${escapeHtml(listing.status.toLowerCase().replaceAll(' ', '-'))}">${escapeHtml(listing.status)}</span></div>
        <h3>${escapeHtml(listing.name)}</h3>
        <p class="card-locality">${escapeHtml(listing.locality)} · ${escapeHtml(listing.condition)}</p>
        <p class="card-window">${localDateTime(listing.available_from)} – ${localDateTime(listing.available_until)}</p>
        <p class="card-owner">Owner: ${escapeHtml(listing.owner_name)}</p>
        <div class="card-footer"><strong class="card-price">${currency.format(listing.price)} / ${escapeHtml(listing.price_unit)}</strong>
          <div class="card-actions"><button type="button" data-map-listing="${listing.id}">View map</button><button type="button" data-book-listing="${listing.id}" ${listing.slot_available ? '' : 'disabled'}>Book now</button></div>
        </div>
      </div>
    </article>`).join('');
}

async function compressImage(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1100 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  let quality = 0.78;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrl.length > 1_450_000 && quality > 0.4) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  if (dataUrl.length > 1_500_000) throw new Error(`${file.name} is too large after compression.`);
  return dataUrl;
}

async function loadPhotos(files) {
  if (files.length > 5) throw new Error('Choose up to five photos.');
  const accepted = [...files].every((file) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type));
  if (!accepted) throw new Error('Photos must be JPG, PNG or WebP images.');
  state.photos = await Promise.all([...files].map(compressImage));
  $('#photoPreview').innerHTML = state.photos.map((photo, index) => `<img src="${photo}" alt="Equipment photo ${index + 1}">`).join('');
}

async function createListing(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = $('#postStatus');
  status.textContent = '';
  status.dataset.state = '';
  try {
    if (!state.photos.length) throw new Error('Add at least one equipment photo.');
    const values = Object.fromEntries(new FormData(form));
    const payload = {
      ...values,
      price: Number(values.price),
      latitude: Number(values.latitude),
      longitude: Number(values.longitude),
      available_from: inputToIso(values.available_from),
      available_until: inputToIso(values.available_until),
      photos: state.photos
    };
    await api('/api/equipment/listings', { method: 'POST', body: JSON.stringify(payload) });
    form.reset();
    state.photos = [];
    $('#photoPreview').innerHTML = '';
    status.textContent = 'Equipment posted. It is now visible to nearby signed-in users.';
    toast('Equipment listing published.');
    showView('listings');
  } catch (error) {
    status.textContent = error.message;
    status.dataset.state = 'error';
  }
}

function statusMarkup(status) {
  return `<span class="status-label ${escapeHtml(status.toLowerCase())}">${escapeHtml(status)}</span>`;
}

async function loadMyListings() {
  const container = $('#myListings');
  container.innerHTML = '<p class="empty-state">Loading your equipment…</p>';
  try {
    const { listings } = await api('/api/equipment/my-listings');
    container.innerHTML = listings.length ? listings.map((listing) => `
      <article class="owner-listing">
        <img src="${escapeHtml(listing.photos[0] || imageFallback)}" alt="${escapeHtml(listing.name)}" loading="lazy" onerror="this.onerror=null;this.src='${imageFallback}'">
        <div class="owner-listing-body">${statusMarkup(listing.status)}<h3>${escapeHtml(listing.name)}</h3>
          <p>${escapeHtml(listing.category)} · ${escapeHtml(listing.condition)} · ${currency.format(listing.price)} / ${escapeHtml(listing.price_unit)}</p>
          <p>${escapeHtml(listing.locality)} · ${localDateTime(listing.available_from)} – ${localDateTime(listing.available_until)}</p>
          <p>${escapeHtml(listing.description)}</p>
        </div>
      </article>`).join('') : '<p class="empty-state">You have not posted any equipment yet.</p>';
  } catch (error) {
    container.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`;
  }
}

function renderBooking(booking) {
  const contact = booking.owner_phone ? `<p>Owner contact: ${escapeHtml(booking.owner_phone)}</p>` : '';
  const role = booking.is_owner ? `Requested by ${escapeHtml(booking.renter_name)}` : `Owner: ${escapeHtml(booking.owner_name)}`;
  let actions = '';
  if (booking.is_owner && booking.status === 'pending') {
    actions = `<button class="accept-action" type="button" data-booking-action="confirm" data-booking-id="${booking.id}">Accept</button><button type="button" data-booking-action="reject" data-booking-id="${booking.id}">Reject</button>`;
  } else if (booking.is_owner && booking.status === 'confirmed' && Date.parse(booking.ends_at) <= Date.now()) {
    actions = `<button class="accept-action" type="button" data-booking-action="complete" data-booking-id="${booking.id}">Mark complete</button>`;
  } else if (['pending', 'confirmed'].includes(booking.status)) {
    actions = `<button type="button" data-booking-action="cancel" data-booking-id="${booking.id}">Cancel booking</button>`;
  }
  return `<article class="booking-item"><div><h3>${escapeHtml(booking.equipment_name)} ${statusMarkup(booking.status)}</h3>
    <p>${role} · ${escapeHtml(booking.locality)}</p>
    <p>${localDateTime(booking.starts_at)} – ${localDateTime(booking.ends_at)} · Total ${currency.format(booking.total_price)}</p>
    ${contact}</div>${actions ? `<div class="booking-item-actions">${actions}</div>` : ''}</article>`;
}

async function loadBookings() {
  try {
    const { bookings } = await api('/api/equipment/bookings');
    const active = bookings.filter((booking) => ['pending', 'confirmed'].includes(booking.status));
    const requests = bookings.filter((booking) => booking.is_owner && booking.status === 'pending');
    const history = bookings.filter((booking) => ['rejected', 'cancelled', 'completed'].includes(booking.status));
    $('#myBookings').innerHTML = active.filter((booking) => !booking.is_owner).map(renderBooking).join('') || '<p class="empty-state">You have no active bookings.</p>';
    $('#bookingRequests').innerHTML = requests.map(renderBooking).join('') || '<p class="empty-state">No booking requests need a decision.</p>';
    $('#bookingHistory').innerHTML = history.map(renderBooking).join('') || '<p class="empty-state">Completed and past bookings will appear here.</p>';
  } catch (error) {
    ['#myBookings', '#bookingRequests', '#bookingHistory'].forEach((selector) => {
      $(selector).innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`;
    });
  }
}

async function loadNotifications() {
  const container = $('#notifications');
  try {
    const { notifications } = await api('/api/equipment/notifications');
    const unread = notifications.filter((item) => !item.read_at).length;
    $('#notificationCount').hidden = unread === 0;
    $('#notificationCount').textContent = String(unread);
    container.innerHTML = notifications.length ? notifications.map((item) => `
      <article class="notification-item"><div><p>${escapeHtml(item.message)}</p><p>${localDateTime(item.created_at)}${item.read_at ? ' · Read' : ' · New'}</p></div>
      ${item.read_at ? '' : `<button type="button" data-read-notification="${item.id}">Mark read</button>`}</article>`).join('') : '<p class="empty-state">No notifications yet.</p>';
  } catch (error) {
    container.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`;
  }
}

const viewTitles = {
  discover: 'Equipment around you', post: 'Post equipment', listings: 'My listings',
  bookings: 'My bookings', requests: 'Booking requests', history: 'Booking history', notifications: 'Notifications'
};

async function showView(view) {
  if (!Object.hasOwn(viewTitles, view)) return;
  state.activeView = view;
  $$('.share-tab').forEach((tab) => {
    const active = tab.dataset.view === view;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  $$('[data-panel]').forEach((panel) => { panel.hidden = panel.dataset.panel !== view; });
  $('#viewTitle').textContent = viewTitles[view];
  if (view === 'discover') {
    if (state.map) setTimeout(() => state.map.invalidateSize(), 0);
    if (state.center) await loadNearby();
  }
  if (view === 'listings') await loadMyListings();
  if (['bookings', 'requests', 'history'].includes(view)) await loadBookings();
  if (view === 'notifications') await loadNotifications();
}

function openBooking(listingId) {
  const listing = state.listings.find((item) => item.id === listingId);
  if (!listing) return;
  state.selectedListing = listing;
  const form = $('#bookingForm');
  const now = Date.now() + 10 * 60_000;
  const starts = Math.max(now, Date.parse(listing.available_from));
  const unitMs = listing.price_unit === 'hour' ? 60 * 60_000 : 24 * 60 * 60_000;
  const ends = Math.min(starts + unitMs, Date.parse(listing.available_until));
  $('#bookingItemName').textContent = listing.name;
  $('#bookingWindow').textContent = `Available ${localDateTime(listing.available_from)} through ${localDateTime(listing.available_until)}. Owner: ${listing.owner_name}.`;
  form.elements.listing_id.value = String(listing.id);
  form.elements.starts_at.min = localInputValue(new Date(Math.max(now, Date.parse(listing.available_from))));
  form.elements.ends_at.max = localInputValue(new Date(Date.parse(listing.available_until)));
  form.elements.starts_at.value = localInputValue(new Date(starts));
  form.elements.ends_at.value = localInputValue(new Date(ends));
  $('#bookingStatus').textContent = ends <= starts ? 'No future time remains in this listing.' : '';
  updateBookingEstimate();
  const dialog = $('#bookingDialog');
  if (!dialog.open) dialog.showModal();
}

function updateBookingEstimate() {
  if (!state.selectedListing) return;
  const startsAt = new Date($('#bookingForm').elements.starts_at.value).getTime();
  const endsAt = new Date($('#bookingForm').elements.ends_at.value).getTime();
  const unitMs = state.selectedListing.price_unit === 'hour' ? 60 * 60_000 : 24 * 60 * 60_000;
  const total = Number.isFinite(startsAt) && Number.isFinite(endsAt) && endsAt > startsAt
    ? state.selectedListing.price * (endsAt - startsAt) / unitMs : 0;
  $('#bookingPrice').textContent = `Estimated total: ${currency.format(total)}`;
}

async function submitBooking(event) {
  event.preventDefault();
  const form = event.currentTarget;
  $('#bookingStatus').textContent = '';
  try {
    const payload = {
      listing_id: Number(form.elements.listing_id.value),
      starts_at: inputToIso(form.elements.starts_at.value),
      ends_at: inputToIso(form.elements.ends_at.value)
    };
    await api('/api/equipment/bookings', { method: 'POST', body: JSON.stringify(payload) });
    $('#bookingDialog').close();
    toast('Booking request sent to the owner.');
    await showView('bookings');
  } catch (error) {
    $('#bookingStatus').textContent = error.message;
    $('#bookingStatus').dataset.state = 'error';
  }
}

async function bookingAction(button) {
  const { bookingAction: action, bookingId } = button.dataset;
  if (action === 'cancel' && !window.confirm('Cancel this booking request?')) return;
  try {
    await api(`/api/equipment/bookings/${bookingId}`, {
      method: 'PATCH', body: JSON.stringify({ action })
    });
    toast({ confirm: 'Booking accepted.', reject: 'Request rejected.', cancel: 'Booking cancelled.', complete: 'Rental marked complete.' }[action]);
    await loadBookings();
    await loadNotifications();
  } catch (error) {
    toast(error.message);
  }
}

function requestLocationForListing() {
  if (!navigator.geolocation) return toast('Location is unavailable. Enter the item coordinates manually.');
  navigator.geolocation.getCurrentPosition(({ coords }) => {
    $('#equipmentForm [name="latitude"]').value = coords.latitude.toFixed(6);
    $('#equipmentForm [name="longitude"]').value = coords.longitude.toFixed(6);
    toast('Item coordinates added.');
  }, () => toast('Location access was unavailable. Enter coordinates manually.'), {
    enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000
  });
}

async function initialize() {
  state.user = await window.requireAuth();
  if (!state.user) return;
  $('#signedInName').textContent = state.user.name;
  $('#searchFilters').addEventListener('submit', (event) => {
    event.preventDefault();
    if (!state.center) return setLocationStatus('Choose a location before applying filters.', true);
    loadNearby();
  });
  $('#applyCoordinates').addEventListener('click', () => {
    const latitude = Number($('#searchLatitude').value);
    const longitude = Number($('#searchLongitude').value);
    if (!validCoordinates(latitude, longitude)) return setLocationStatus('Enter valid latitude and longitude coordinates.', true);
    setLocation(latitude, longitude, 'the selected coordinates');
  });
  $('#useGps').addEventListener('click', locateUser);
  $('#searchPlace').addEventListener('click', searchPlace);
  $('#placeSearch').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); searchPlace(); }
  });
  $('#equipmentForm').addEventListener('submit', createListing);
  $('#equipmentPhotos').addEventListener('change', async (event) => {
    try {
      await loadPhotos(event.currentTarget.files);
      $('#postStatus').textContent = `${state.photos.length} photo${state.photos.length === 1 ? '' : 's'} ready.`;
      $('#postStatus').dataset.state = '';
    } catch (error) {
      state.photos = [];
      $('#photoPreview').innerHTML = '';
      $('#postStatus').textContent = error.message;
      $('#postStatus').dataset.state = 'error';
    }
  });
  $('#listingGps').addEventListener('click', requestLocationForListing);
  $('#bookingForm').addEventListener('submit', submitBooking);
  $('#bookingForm').elements.starts_at.addEventListener('input', updateBookingEstimate);
  $('#bookingForm').elements.ends_at.addEventListener('input', updateBookingEstimate);
  $('#signOut').addEventListener('click', window.signOut);
  document.addEventListener('click', async (event) => {
    const tab = event.target.closest('[data-view]');
    const goView = event.target.closest('[data-go-view]');
    const bookButton = event.target.closest('[data-book-listing]');
    const mapButton = event.target.closest('[data-map-listing]');
    const actionButton = event.target.closest('[data-booking-action]');
    const readButton = event.target.closest('[data-read-notification]');
    const closeButton = event.target.closest('[data-close-dialog]');
    if (tab) await showView(tab.dataset.view);
    else if (goView) await showView(goView.dataset.goView);
    else if (bookButton) openBooking(Number(bookButton.dataset.bookListing));
    else if (mapButton) {
      const listing = state.listings.find((item) => item.id === Number(mapButton.dataset.mapListing));
      if (listing && state.map) {
        state.map.setView([listing.latitude, listing.longitude], 16);
        listing.marker?.openPopup();
      }
    } else if (actionButton) await bookingAction(actionButton);
    else if (readButton) {
      try {
        await api(`/api/equipment/notifications/${readButton.dataset.readNotification}`, { method: 'PATCH', body: '{}' });
        await loadNotifications();
      } catch (error) { toast(error.message); }
    } else if (closeButton) $('#bookingDialog').close();
  });
  $('#bookingDialog').addEventListener('click', (event) => {
    if (event.target === $('#bookingDialog')) $('#bookingDialog').close();
  });
  await loadNotifications();
}

initialize().catch((error) => {
  console.error(error);
  setLocationStatus(error.message || 'Could not load equipment sharing.', true);
});