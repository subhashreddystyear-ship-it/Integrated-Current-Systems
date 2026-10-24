const state = {
  user: null,
  page: 1,
  pages: 1,
  total: 0,
  authMode: 'login',
  activeFilters: {},
  toastTimer: null
};

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const fallbackImage = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"><rect width="800" height="500" fill="#e8eee1"/><path d="M0 290 160 205l135 91 157-135 159 111 189-99v327H0Z" fill="#9bb783"/><path d="M0 353q160-89 302 0t498-15v162H0Z" fill="#547c4f"/><path d="M0 405q205-58 372 13t428-6v88H0Z" fill="#d9c98a"/><circle cx="644" cy="104" r="38" fill="#f2d681"/></svg>')}`;

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    }
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

function safeImage(image) {
  return escapeHtml(image || fallbackImage);
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}

function relativeDate(value) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

function toast(message) {
  const element = $('#toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('visible');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => element.classList.remove('visible'), 2700);
}

function dialog(id) {
  const element = document.getElementById(id);
  if (element && !element.open) element.showModal();
  return element;
}

function closeDialog(id) {
  const element = document.getElementById(id);
  if (element?.open) element.close();
}

async function loadUser() {
  try {
    const result = await api('/api/auth/me');
    state.user = result.user;
  } catch {
    state.user = null;
  }
  updateAccountButton();
}

function updateAccountButton() {
  const button = $('#accountButton');
  if (!button) return;
  button.textContent = state.user ? state.user.name.split(' ')[0] : 'Sign in';
  button.setAttribute('aria-label', state.user ? `Account: ${state.user.name}` : 'Sign in');
}

function requestSignIn() {
  state.authMode = 'login';
  updateAuthDialog();
  dialog('authDialog');
}

function updateAuthDialog() {
  const isRegister = state.authMode === 'register';
  $('#authTitle').textContent = isRegister ? 'Make yourself at home.' : 'Welcome back.';
  $('#authSubtitle').textContent = isRegister ? 'Create an account to save land and talk directly with owners.' : 'Sign in to save land and contact owners.';
  $('#authSubmit').textContent = isRegister ? 'Create account' : 'Sign in';
  $('#authNameField').hidden = !isRegister;
  $('#authNameField').querySelector('input').required = isRegister;
  $('#authForm [name="password"]').autocomplete = isRegister ? 'new-password' : 'current-password';
  $('#authModeToggle').textContent = isRegister ? 'Already have an account? Sign in' : 'New here? Create an account';
  $('#authStatus').textContent = '';
}

function imageFallback(image) {
  image.onerror = null;
  image.src = fallbackImage;
}

function listingCard(listing, index = 0) {
  const photo = listing.images?.[0] || fallbackImage;
  const rate = Number(listing.area) > 0
    ? `${inr.format(Number(listing.price) / Number(listing.area))} / ${escapeHtml(listing.area_unit)}`
    : `${inr.format(listing.price)} total`;
  const isFavorite = Boolean(listing.is_favorite);
  return `<article class="listing-card" style="animation-delay:${Math.min(index % 24, 8) * 22}ms">
    <div class="card-photo-wrap">
      <img class="card-photo" src="${safeImage(photo)}" alt="Land near ${escapeHtml(listing.location)}, ${escapeHtml(listing.district)}" loading="lazy" onerror="imageFallback(this)">
      <span class="listing-badge ${listing.sale_type === 'exchange' ? 'exchange' : ''}">${listing.sale_type === 'exchange' ? 'Open to exchange' : 'For sale'}</span>
      <button class="favorite-button ${isFavorite ? 'is-favorite' : ''}" type="button" data-favorite="${listing.id}" aria-label="${isFavorite ? 'Remove from saved land' : 'Save this land'}" aria-pressed="${isFavorite}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 8.8c0 5-8.8 10-8.8 10s-8.8-5-8.8-10A4.8 4.8 0 0 1 12 6.5a4.8 4.8 0 0 1 8.8 2.3Z"></path></svg></button>
    </div>
    <div class="card-body">
      <div class="card-location"><span aria-hidden="true">⌖</span>${escapeHtml(listing.location)}, ${escapeHtml(listing.district)} · ${escapeHtml(listing.state)}</div>
      <h3 class="card-title">${escapeHtml(listing.title)}</h3>
      <div class="card-price-line"><strong class="card-price">${inr.format(listing.price)}</strong><span class="card-rate">${rate}</span></div>
      <div class="card-facts"><span><b>↗</b>${escapeHtml(listing.area)} ${escapeHtml(listing.area_unit)}</span><span><b>⌂</b>${escapeHtml(listing.land_type)}</span><span><b>⌁</b>${escapeHtml(listing.road_access)}</span><span><b>◉</b>${escapeHtml(listing.water_availability)}</span><span><b>ϟ</b>${escapeHtml(listing.electricity_availability)}</span></div>
      <div class="card-meta"><strong>${escapeHtml(listing.owner_name)}</strong><span>${relativeDate(listing.created_at)}</span></div>
      <div class="card-actions"><a href="land-details.html?id=${listing.id}">View details</a><button class="contact-owner" type="button" data-contact="${listing.id}">Contact owner</button></div>
    </div>
  </article>`;
}

function collectFilters() {
  const form = $('#filterForm');
  if (!form) return {};
  const values = Object.fromEntries(new FormData(form));
  Object.keys(values).forEach((key) => {
    if (!String(values[key]).trim()) delete values[key];
  });
  const searchForm = $('#quickSearch');
  const location = $('#quickLocation')?.value.trim();
  const keyword = $('#quickKeyword')?.value.trim();
  if (location) values.location = location;
  if (keyword) values.search = keyword;
  const quickType = $('.quick-filter.active[data-quick-filter="sale"]') ? 'sale'
    : $('.quick-filter.active[data-quick-filter="exchange"]') ? 'exchange' : null;
  if (quickType) values.saleType = quickType;
  if ($('.quick-filter.active[data-quick-filter="road"]')) values.roadAccess = 'Paved road';
  if ($('.quick-filter.active[data-quick-filter="water"]')) values.waterAvailability = 'Borewell';
  values.sort = $('#sortListings')?.value || 'newest';
  return values;
}

function updateFilterCount() {
  const values = collectFilters();
  const count = Object.entries(values).filter(([key, value]) => key !== 'sort' && value).length;
  const badge = $('#activeFilterCount');
  if (badge) badge.textContent = String(count);
}

async function loadListings(page = 1) {
  const grid = $('#listingsGrid');
  if (!grid) return;
  state.page = page;
  grid.innerHTML = '<div class="loading-state">Finding land worth a closer look…</div>';
  const params = new URLSearchParams({ ...collectFilters(), page: String(page), limit: '24' });
  try {
    const result = await api(`/api/land/listings?${params}`);
    state.pages = result.pages;
    state.total = result.total;
    grid.innerHTML = result.listings.length
      ? result.listings.map(listingCard).join('')
      : '<div class="empty-state">No properties match those filters yet.<br>Try widening your search.</div>';
    $('#resultCount').textContent = `${result.total.toLocaleString('en-IN')} properties`;
    renderPagination();
    updateFilterCount();
  } catch (error) {
    grid.innerHTML = `<div class="empty-state">We could not load listings.<br>${escapeHtml(error.message)}<br><button class="secondary-button" type="button" data-retry>Try again</button></div>`;
  }
}

function renderPagination() {
  const nav = $('#pagination');
  if (!nav) return;
  if (state.pages < 2) {
    nav.innerHTML = '';
    return;
  }
  const pages = new Set([1, state.pages, state.page - 1, state.page, state.page + 1].filter((value) => value >= 1 && value <= state.pages));
  nav.innerHTML = [...pages].sort((a, b) => a - b).map((page) => `<button class="page-button ${page === state.page ? 'active' : ''}" type="button" data-page="${page}" aria-label="Page ${page}" aria-current="${page === state.page ? 'page' : 'false'}">${page}</button>`).join('');
}

async function loadFilterOptions() {
  try {
    const { options } = await api('/api/land/listings/filters');
    const fill = (name, values, label) => {
      const select = $(`#filterForm [name="${name}"]`);
      if (!select) return;
      const unique = [...new Set(values)].sort((a, b) => a.localeCompare(b));
      select.innerHTML = `<option value="">${label}</option>${unique.map((value) => `<option>${escapeHtml(value)}</option>`).join('')}`;
    };
    fill('state', options.map((item) => item.state), 'All South India');
    fill('district', options.map((item) => item.district), 'All districts');
    fill('landType', options.map((item) => item.land_type), 'Any type');
    fill('roadAccess', options.map((item) => item.road_access), 'Any access');
    fill('waterAvailability', options.map((item) => item.water_availability), 'Any water source');
  } catch (error) {
    console.error('Could not load filter options:', error);
  }
}

async function toggleFavorite(id, button) {
  if (!state.user) return requestSignIn();
  try {
    const isFavorite = button.classList.contains('is-favorite');
    const result = await api(`/api/land/favorites/${id}`, { method: isFavorite ? 'DELETE' : 'POST' });
    button.classList.toggle('is-favorite', result.favorited);
    button.setAttribute('aria-pressed', String(result.favorited));
    button.setAttribute('aria-label', result.favorited ? 'Remove from saved land' : 'Save this land');
    if (!button.classList.contains('favorite-button')) button.textContent = result.favorited ? '♥ Saved' : '♡ Save property';
    toast(result.favorited ? 'Saved to your land list.' : 'Removed from saved land.');
  } catch (error) {
    toast(error.message);
  }
}

function listingRow(listing, action = 'details') {
  const detail = `<a class="secondary-button" href="land-details.html?id=${listing.id}">View</a>`;
  const edit = action === 'listings' ? `<button type="button" data-edit-listing="${listing.id}">Edit</button><button type="button" data-delete-listing="${listing.id}">Delete</button>` : '';
  const favorite = action === 'favorites' ? `<button type="button" data-remove-favorite="${listing.id}">Remove</button>` : '';
  return `<div class="workspace-row"><img src="${safeImage(listing.images?.[0])}" alt="" loading="lazy" onerror="imageFallback(this)"><div><strong>${escapeHtml(listing.title)}</strong><small>${inr.format(listing.price)} · ${escapeHtml(listing.location)}, ${escapeHtml(listing.state)}</small></div><div>${detail}${edit}${favorite}</div></div>`;
}

async function openWorkspace(view) {
  if (!state.user) return requestSignIn();
  const title = { favorites: 'Saved land', listings: 'My listings', requests: 'Exchange requests', inbox: 'Messages & notifications', profile: 'Your profile' }[view] || 'Your account';
  $('#workspaceTitle').textContent = title;
  const content = $('#workspaceContent');
  content.innerHTML = '<div class="loading-state">Loading your account…</div>';
  dialog('workspaceDialog');
  try {
    if (view === 'profile') {
      content.innerHTML = `<div class="message-card"><strong>${escapeHtml(state.user.name)}</strong><p>${escapeHtml(state.user.email)}</p><small>Member since ${escapeHtml(formatDate(state.user.created_at || new Date()))}</small><div class="profile-shortcuts"><button class="secondary-button" type="button" data-view="listings">My listings</button><button class="secondary-button" type="button" data-view="favorites">Saved land</button><button class="secondary-button" type="button" data-view="requests">Exchange requests</button><button class="secondary-button" type="button" data-view="inbox">Messages &amp; notifications</button></div><div class="form-actions"><button class="secondary-button" type="button" data-sign-out>Sign out</button></div></div>`;
      return;
    }
    if (view === 'favorites' || view === 'listings') {
      const endpoint = view === 'favorites' ? '/api/land/favorites' : '/api/land/my/listings';
      const { listings } = await api(endpoint);
      content.innerHTML = listings.length ? listings.map((listing) => listingRow(listing, view)).join('') : '<div class="empty-state">Nothing here yet. Saved properties and your posted listings will appear here.</div>';
      return;
    }
    if (view === 'requests') {
      const { requests } = await api('/api/land/exchange-requests');
      content.innerHTML = requests.length ? requests.map((request) => `<article class="exchange-request-card"><strong>${escapeHtml(request.listing_title)}</strong><p>${escapeHtml(request.user_name)} offered ${escapeHtml(request.land_area)} in ${escapeHtml(request.land_location)} · ${inr.format(request.land_value)}</p><p>${escapeHtml(request.message)}</p><small>${escapeHtml(request.status)} · ${formatDate(request.created_at)}</small></article>`).join('') : '<div class="empty-state">No exchange requests yet.</div>';
      return;
    }
    const { messages } = await api('/api/land/messages');
    content.innerHTML = messages.length ? messages.map((message) => `<article class="message-card"><strong>${escapeHtml(message.message_type === 'offer' ? 'Offer' : 'Message')} · ${escapeHtml(message.listing_title)}</strong><p>${escapeHtml(message.sender_name)}: ${escapeHtml(message.body)}</p><small>${formatDate(message.created_at)}</small></article>`).join('') : '<div class="empty-state">No messages yet. Contact an owner to start a conversation.</div>';
  } catch (error) {
    content.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  }
}

function clearListingForm() {
  $('#listingForm').reset();
  $('#listingForm [name="listingId"]').value = '';
  $('#listingDialogTitle').textContent = 'Tell us about your land.';
  $('#listingSubmit').textContent = 'Publish listing';
  $('#listingStatus').textContent = '';
  updatePhotoSelection($('#listingForm [name="photos"]'), []);
  $('#exchangeFields').hidden = true;
}

function updatePhotoSelection(input, files) {
  const transfer = new DataTransfer();
  files.slice(0, 5).forEach((file) => transfer.items.add(file));
  input.files = transfer.files;

  const preview = $('#photoPreview');
  preview.querySelectorAll('img[data-preview-url]').forEach((image) => URL.revokeObjectURL(image.src));
  preview.innerHTML = [...input.files].map((file, index) => `
    <div class="photo-preview-item">
      <img data-preview-url src="${URL.createObjectURL(file)}" alt="Selected property photo">
      <button class="photo-preview-remove" type="button" data-remove-photo="${index}" aria-label="Remove selected photo" title="Remove photo">×</button>
    </div>
  `).join('');
}

function openListingDialog(listing = null) {
  if (!state.user) return requestSignIn();
  clearListingForm();
  if (listing) {
    const form = $('#listingForm');
    Object.entries(listing).forEach(([key, value]) => {
      const input = form.elements.namedItem(key);
      if (input && !['owner_email', 'owner_id', 'images', 'is_favorite', 'id', 'created_at', 'updated_at'].includes(key)) input.value = value ?? '';
    });
    form.elements.namedItem('listingId').value = listing.id;
    $('#listingDialogTitle').textContent = 'Update your listing.';
    $('#listingSubmit').textContent = 'Save changes';
    $('#exchangeFields').hidden = listing.sale_type !== 'exchange';
    $('#photoPreview').innerHTML = (listing.images || []).map((image) => `<img src="${safeImage(image)}" alt="Current property photo" onerror="imageFallback(this)">`).join('');
  }
  dialog('listingDialog');
}

async function editListing(id) {
  if (!$('#listingForm')) {
    location.href = `marketplace.html?edit=${encodeURIComponent(id)}`;
    return;
  }
  try {
    const { listing } = await api(`/api/land/listings/${id}`);
    openListingDialog(listing);
    closeDialog('workspaceDialog');
  } catch (error) {
    toast(error.message);
  }
}

async function handleListingSubmit(event) {
  event.preventDefault();
  if (!state.user) return requestSignIn();
  const form = event.currentTarget;
  const button = $('#listingSubmit');
  button.disabled = true;
  $('#listingStatus').textContent = 'Saving your property…';
  try {
    const values = Object.fromEntries(new FormData(form));
    const listingId = values.listingId;
    delete values.listingId;
    const photos = await Promise.all([...form.elements.namedItem('photos').files].slice(0, 5).map(compressPhoto));
    if (photos.length) values.photos = photos;
    const result = await api(listingId ? `/api/land/listings/${listingId}` : '/api/land/listings', {
      method: listingId ? 'PATCH' : 'POST',
      body: JSON.stringify(values)
    });
    closeDialog('listingDialog');
    toast(listingId ? 'Your listing has been updated.' : 'Your land is now listed.');
    if ($('#listingsGrid')) loadListings(1);
    if (listingId && $('#workspaceDialog')?.open) openWorkspace('listings');
    if (result.listing && !listingId) location.href = `land-details.html?id=${result.listing.id}`;
  } catch (error) {
    $('#listingStatus').textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

function compressPhoto(file) {
  if (!file.size) {
    return Promise.reject(new Error(`"${file.name}" is empty. Choose a different photo.`));
  }

  if (file.type && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return Promise.reject(new Error(`"${file.name}" uses an unsupported format. Choose a JPG, PNG or WebP photo.`));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Unable to read "${file.name}".`));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error(`"${file.name}" could not be decoded. Try a JPG, PNG or WebP photo.`));
      image.onload = () => {
        const scale = Math.min(1, 1500 / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', .72));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function loadDetails() {
  const host = $('#propertyDetails');
  if (!host) return;
  const id = new URLSearchParams(location.search).get('id');
  if (!id) {
    host.innerHTML = '<div class="empty-state">This property link is missing its listing ID. <a href="/">Browse all land</a></div>';
    return;
  }
  try {
    const { listing } = await api(`/api/land/listings/${encodeURIComponent(id)}`);
    document.title = `${listing.title} | Fieldmark`;
    renderDetails(listing);
  } catch (error) {
    host.innerHTML = `<div class="empty-state">${escapeHtml(error.message)} <a href="/">Browse all land</a></div>`;
  }
}

function renderDetails(listing) {
  const host = $('#propertyDetails');
  const images = listing.images?.length ? listing.images : [fallbackImage];
  const rate = Number(listing.area) > 0 ? `${inr.format(Number(listing.price) / Number(listing.area))} per ${escapeHtml(listing.area_unit)}` : `${inr.format(listing.price)} total`;
  const facts = [
    ['General location', listing.exact_location], ['Land type', listing.land_type], ['Road access', listing.road_access], ['Road width', listing.road_width],
    ['Water source', listing.water_availability], ['Electricity', listing.electricity_availability],
    ['Ownership', listing.ownership_status], ['Survey number', listing.survey_number],
    ['Distance from main road', listing.distance_main_road], ['Distance from town', listing.distance_town],
    ['Development', listing.development_status]
  ];
  host.innerHTML = `<div class="property-layout">
    <div class="property-main-column">
      <div class="property-gallery"><div class="main-photo-wrap"><img id="mainPropertyPhoto" class="main-property-photo" src="${safeImage(images[0])}" alt="${escapeHtml(listing.title)}" onerror="imageFallback(this)"></div><div class="gallery-thumbs">${images.slice(0, 4).map((image, index) => `<button class="gallery-thumb ${index === 0 ? 'active' : ''}" type="button" data-gallery-image="${index}" aria-label="Show property photo ${index + 1}"><img src="${safeImage(image)}" alt="" onerror="imageFallback(this)"></button>`).join('')}</div></div>
      <section class="property-heading"><p class="eyebrow"><span class="eyebrow-mark"></span>${listing.sale_type === 'exchange' ? 'Available for exchange' : 'Land for sale'} · Posted ${formatDate(listing.created_at)}</p><h1>${escapeHtml(listing.title)}</h1><p class="property-location"><span aria-hidden="true">⌖</span>${escapeHtml(listing.location)}, ${escapeHtml(listing.district)}, ${escapeHtml(listing.state)}</p></section>
      <div class="property-overview"><div class="overview-item"><span>Total area</span><strong>${escapeHtml(listing.area)} ${escapeHtml(listing.area_unit)}</strong></div><div class="overview-item"><span>Property type</span><strong>${escapeHtml(listing.land_type)}</strong></div><div class="overview-item"><span>Road access</span><strong>${escapeHtml(listing.road_access)}</strong></div><div class="overview-item"><span>Listed by</span><strong>${escapeHtml(listing.owner_name)}</strong></div></div>
      <section class="detail-section"><h2>About this land</h2><p>${escapeHtml(listing.description)}</p></section>
      <section class="detail-section"><h2>Property details</h2><div class="property-facts">${facts.map(([label, value]) => `<div class="property-fact"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || 'Not provided')}</strong></div>`).join('')}</div></section>
      <section class="detail-section"><h2>Nearby facilities</h2><p>${escapeHtml(listing.nearby_facilities || 'Ask the owner for nearby facilities.')}</p></section>
      <section class="detail-section"><h2>Property location</h2><div class="map-placeholder" role="img" aria-label="Map placeholder for ${escapeHtml(listing.location)}"><span class="map-pin"><span aria-hidden="true">⌖</span></span><span class="map-caption">${escapeHtml(listing.location)}, ${escapeHtml(listing.district)}</span></div><a class="map-open-link" href="https://www.openstreetmap.org/search?query=${encodeURIComponent(`${listing.location}, ${listing.district}, ${listing.state}, India`)}" target="_blank" rel="noreferrer">Explore this area on OpenStreetMap ↗</a></section>
    </div>
    <aside class="seller-panel"><p class="seller-price">${inr.format(listing.price)}</p><p class="seller-rate">${rate} · ${escapeHtml(listing.area)} ${escapeHtml(listing.area_unit)}</p><div class="seller-info"><span class="seller-avatar">${escapeHtml(listing.owner_name.slice(0, 1).toUpperCase())}</span><span><strong>${escapeHtml(listing.owner_name)}</strong><small>Landowner · Listed ${relativeDate(listing.created_at)}</small></span></div><div class="seller-actions"><button class="primary-button" type="button" data-contact="${listing.id}">Contact seller</button><button class="secondary-button" type="button" data-offer="${listing.id}">Make an offer</button>${listing.sale_type === 'exchange' ? `<button class="secondary-button" type="button" data-exchange="${listing.id}">Propose exchange</button>` : ''}<button class="secondary-button ${listing.is_favorite ? 'is-favorite' : ''}" type="button" data-favorite="${listing.id}" aria-pressed="${Boolean(listing.is_favorite)}">${listing.is_favorite ? '♥ Saved' : '♡ Save property'}</button></div><p class="seller-extra">Never pay a deposit before viewing the property and verifying ownership documents.</p>${listing.sale_type === 'exchange' ? `<div class="exchange-summary"><h3>Open to exchange</h3><p><strong>Preferred location</strong><br>${escapeHtml(listing.exchange_location || 'Flexible')}</p><p><strong>Preferred area</strong><br>${escapeHtml(listing.exchange_area || 'Open to discussion')}</p><p><strong>Conditions</strong><br>${escapeHtml(listing.exchange_conditions || 'Discuss terms with the owner.')}</p></div>` : ''}</aside>
  </div>`;
}

function actionForm(id, type) {
  const isExchange = type === 'exchange';
  const isOffer = type === 'offer';
  const heading = isExchange ? 'Propose a land exchange.' : isOffer ? 'Make an offer to the owner.' : 'Start a conversation.';
  const intro = isExchange ? 'Share your land details and what you have in mind.' : 'Your message goes directly to the property owner.';
  const fields = isExchange
    ? `<label>Your name<input name="user_name" autocomplete="name" required></label><label>Phone or email<input name="contact" autocomplete="email" required></label><label>Your land location<input name="land_location" required></label><label>Your land area<input name="land_area" required placeholder="e.g. 2.5 acres"></label><label>Estimated land value (₹)<input name="land_value" type="number" min="1" required></label><label class="full-field">Photos of your land<input name="photos" type="file" accept="image/*" multiple></label><label class="full-field">Message to owner<textarea name="message" rows="3" required></textarea></label>`
    : `<label>Your name<input name="user_name" autocomplete="name" required value="${escapeHtml(state.user?.name || '')}"></label><label>Phone or email<input name="contact" autocomplete="email" required value="${escapeHtml(state.user?.email || '')}"></label>${isOffer ? '<label class="full-field">Offer amount (₹)<input name="offer" type="number" min="1" required></label>' : ''}<label class="full-field">Message<textarea name="message" rows="4" required placeholder="Ask a question or arrange a visit…"></textarea></label>`;
  return `<p class="eyebrow">${isExchange ? 'Land exchange' : 'Contact owner'}</p><h2>${heading}</h2><p class="dialog-subtitle">${intro}</p><form class="action-form listing-form" data-action-form="${type}" data-listing-id="${id}">${fields}<div class="form-actions full-field"><button class="secondary-button" type="button" data-close-dialog>Cancel</button><button class="primary-button" type="submit">${isExchange ? 'Send proposal' : isOffer ? 'Send offer' : 'Send message'}</button></div><p class="form-status full-field" role="status"></p></form>`;
}

async function submitActionForm(form) {
  const type = form.dataset.actionForm;
  const listingId = form.dataset.listingId;
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  const status = form.querySelector('.form-status');
  try {
    const values = Object.fromEntries(new FormData(form));
    if (type === 'exchange') {
      const photos = await Promise.all([...form.elements.namedItem('photos').files].slice(0, 5).map(compressPhoto));
      values.photos = photos;
      await api(`/api/land/listings/${listingId}/exchange-requests`, { method: 'POST', body: JSON.stringify(values) });
      toast('Your exchange proposal has been sent.');
    } else {
      const body = type === 'offer' ? `${inr.format(values.offer)} offer from ${values.user_name}\n${values.message}` : `${values.message}\n\nReply to: ${values.contact}`;
      await api(`/api/land/listings/${listingId}/messages`, { method: 'POST', body: JSON.stringify({ message_type: type, subject: type === 'offer' ? `Offer for listing ${listingId}` : 'Property enquiry', body }) });
      toast(type === 'offer' ? 'Your offer has been sent to the owner.' : 'Your message has been sent.');
    }
    closeDialog('actionDialog');
  } catch (error) {
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

async function removeListing(id) {
  if (!window.confirm('Delete this land listing? This cannot be undone.')) return;
  try {
    await api(`/api/land/listings/${id}`, { method: 'DELETE' });
    openWorkspace('listings');
    toast('Listing deleted.');
  } catch (error) {
    toast(error.message);
  }
}

function bindEvents() {
  $('#quickSearch')?.addEventListener('submit', (event) => {
    event.preventDefault();
    loadListings(1);
  });
  $('#filterForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    loadListings(1);
    $('#filterPanel').classList.remove('open');
    $('#mobileFilterButton')?.setAttribute('aria-expanded', 'false');
  });
  $('#sortListings')?.addEventListener('change', () => loadListings(1));
  $('#clearFilters')?.addEventListener('click', () => {
    $('#filterForm').reset();
    $('#quickLocation').value = '';
    $('#quickKeyword').value = '';
    $$('.quick-filter').forEach((button) => button.classList.remove('active'));
    loadListings(1);
  });
  $('#quickFilters')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-quick-filter]');
    if (!button) return;
    const key = button.dataset.quickFilter;
    if (key === 'sale' || key === 'exchange') $$('.quick-filter[data-quick-filter="sale"], .quick-filter[data-quick-filter="exchange"]').forEach((item) => item.classList.toggle('active', item === button && !button.classList.contains('active')));
    else button.classList.toggle('active');
    loadListings(1);
  });
  $('#mobileFilterButton')?.addEventListener('click', () => {
    $('#filterPanel').classList.add('open');
    $('#mobileFilterButton').setAttribute('aria-expanded', 'true');
  });
  $('#mobileFilterClose')?.addEventListener('click', () => {
    $('#filterPanel').classList.remove('open');
    $('#mobileFilterButton').setAttribute('aria-expanded', 'false');
  });
  $('#pagination')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-page]');
    if (button) {
      loadListings(Number(button.dataset.page));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
  $('#listingsGrid')?.addEventListener('click', (event) => {
    if (event.target.closest('[data-retry]')) loadListings(state.page);
    const favorite = event.target.closest('[data-favorite]');
    if (favorite) toggleFavorite(favorite.dataset.favorite, favorite);
    const contact = event.target.closest('[data-contact]');
    if (contact) openAction(contact.dataset.contact, 'contact');
  });
  $('#propertyDetails')?.addEventListener('click', (event) => {
    const thumbnail = event.target.closest('[data-gallery-image]');
    if (thumbnail) {
      const image = $('#mainPropertyPhoto');
      const source = thumbnail.querySelector('img').src;
      image.src = source;
      $$('.gallery-thumb').forEach((item) => item.classList.toggle('active', item === thumbnail));
    }
    const favorite = event.target.closest('[data-favorite]');
    if (favorite) toggleFavorite(favorite.dataset.favorite, favorite);
    ['contact', 'offer', 'exchange'].forEach((type) => {
      const button = event.target.closest(`[data-${type}]`);
      if (button) openAction(button.dataset[type], type);
    });
  });
  $('#postLandButton')?.addEventListener('click', () => openListingDialog());
  $('#accountButton')?.addEventListener('click', () => state.user ? openWorkspace('profile') : requestSignIn());
  document.addEventListener('click', (event) => {
    const view = event.target.closest('[data-view]');
    if (view) openWorkspace(view.dataset.view);
    if (event.target.closest('[data-close-dialog]')) closeDialog('actionDialog');
    if (event.target.closest('[data-sign-out]')) {
      api('/api/auth/logout', { method: 'POST' }).finally(() => location.reload());
    }
    const edit = event.target.closest('[data-edit-listing]');
    if (edit) editListing(edit.dataset.editListing);
    const remove = event.target.closest('[data-delete-listing]');
    if (remove) removeListing(remove.dataset.deleteListing);
    const removeFavorite = event.target.closest('[data-remove-favorite]');
    if (removeFavorite) api(`/api/land/favorites/${removeFavorite.dataset.removeFavorite}`, { method: 'DELETE' }).then(() => openWorkspace('favorites')).catch((error) => toast(error.message));
  });
  $('#authModeToggle')?.addEventListener('click', () => {
    state.authMode = state.authMode === 'login' ? 'register' : 'login';
    updateAuthDialog();
  });
  $('#authForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    const isRegister = state.authMode === 'register';
    const path = isRegister ? '/api/auth/register' : '/api/auth/login';
    const button = $('#authSubmit');
    button.disabled = true;
    $('#authStatus').textContent = isRegister ? 'Creating your account…' : 'Signing in…';
    try {
      await api(path, { method: 'POST', body: JSON.stringify(values) });
      await loadUser();
      closeDialog('authDialog');
      form.reset();
      toast(isRegister ? 'Your Fieldmark account is ready.' : 'Signed in successfully.');
      if ($('#listingsGrid')) loadListings(state.page);
      if ($('#propertyDetails')) loadDetails();
    } catch (error) {
      $('#authStatus').textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
  $('#listingForm')?.addEventListener('submit', handleListingSubmit);
  $('#listingSaleType')?.addEventListener('change', (event) => {
    $('#exchangeFields').hidden = event.target.value !== 'exchange';
  });
  $('#listingForm [name="photos"]')?.addEventListener('change', (event) => {
    updatePhotoSelection(event.currentTarget, [...event.currentTarget.files]);
  });
  $('#photoPreview')?.addEventListener('click', (event) => {
    const removeButton = event.target.closest('[data-remove-photo]');
    if (!removeButton) return;
    const input = $('#listingForm [name="photos"]');
    const files = [...input.files];
    files.splice(Number(removeButton.dataset.removePhoto), 1);
    updatePhotoSelection(input, files);
  });
  $('#actionContent')?.addEventListener('submit', (event) => {
    const form = event.target.closest('[data-action-form]');
    if (form) {
      event.preventDefault();
      submitActionForm(form);
    }
  });
  $('#workspaceContent')?.addEventListener('click', (event) => {
    const favorite = event.target.closest('[data-favorite]');
    if (favorite) toggleFavorite(favorite.dataset.favorite, favorite);
  });
}

function openAction(id, type) {
  if (!state.user) return requestSignIn();
  $('#actionContent').innerHTML = actionForm(id, type);
  dialog('actionDialog');
}

async function initializeMarketplace() {
  bindEvents();
  await loadUser();
  const editId = new URLSearchParams(location.search).get('edit');
  if (editId && state.user) await editListing(editId);
  if ($('#listingsGrid')) {
    await loadFilterOptions();
    await loadListings();
  }
  if ($('#propertyDetails')) await loadDetails();
}

initializeMarketplace();