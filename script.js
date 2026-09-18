if (sessionStorage.getItem('isLoggedIn') !== 'true') {
  window.location.href = 'index.html';
}

const appState = {
  village: 'Ramakuppam',
  mandal: 'Ramakuppam',
  district: 'Chittoor',
  state: 'Andhra Pradesh',
  locationName: 'Rural Agricultural Area',
  latitude: '13.0372',
  longitude: '79.9154',
  fieldCount: 20,
  transformerCount: 20,
  mainTransformerName: 'MAIN-TX-01',
  villageCode: 'KUP-001',
  population: 3200,
  houseCount: 850,
  poleCount: 240,
  streetLightCount: 180,
  motorCount: 75,
  mainCapacity: '5 MVA',
  incomingVoltage: 11000,
  incomingCurrent: 245,
  userRole: 'Farmer',
  mode: 'day',
  filter: 'all',
  search: '',
  selectedNode: null,
  onboardingComplete: false,
  mainTransformer: null,
  transformers: [],
  fields: [],
  poles: [],
  eventLog: []
};

const transformerOwners = [
  'Manjunath Reddy',
  'Ramadevi',
  'Babu',
  'Chandrashekar Reddy',
  'Raja Reddy',
  'Appi Reddy',
  'Rujji Reddy',
  'Nagaraju',
  'Bushnamma',
  'Shudhakar Reddy',
  'Narayanaswami',
  'Subramanyam',
  'Raghupathi'
];

const ui = {};

document.addEventListener('DOMContentLoaded', initializeApp);

function initializeApp() {
  cacheUi();
  bindEvents();
  bindWelcomeEvents();
  loadSelectedLocation();
  syncConfigForm();
  generateNetwork();
  updateDashboard();
  addEventLog(`Network initialized for ${appState.village} rural grid.`, 'info');
  showTransformerDetails({ id: appState.mainTransformerName, type: 'Main Transformer' });

  if (appState.onboardingComplete) {
    ui.welcomeScreen.classList.add('hidden');
    ui.appShell.classList.add('visible');
    document.body.classList.add('dashboard-ready');
  }
}

function loadSelectedLocation() {
  const savedLocation = sessionStorage.getItem('smartRuralLocation');
  if (!savedLocation) return;

  try {
    const locationData = JSON.parse(savedLocation);
    appState.state = locationData.state || appState.state;
    appState.district = locationData.district || appState.district;
    appState.mandal = locationData.mandalam || appState.mandal;
    appState.village = locationData.village || appState.village;
    appState.locationName = locationData.station || `${appState.village} Rural Area`;
    appState.onboardingComplete = true;
  } catch {
    sessionStorage.removeItem('smartRuralLocation');
  }
}

function cacheUi() {
  ui.dashboardLauncher = document.getElementById('dashboardLauncher');
  ui.appShell = document.getElementById('appShell');
  ui.welcomeScreen = document.getElementById('welcomeScreen');
  ui.locationForm = document.getElementById('locationForm');
  ui.roleButtons = document.querySelectorAll('.role-option');
  ui.form = document.getElementById('configForm');
  ui.search = document.getElementById('searchInput');
  ui.filterGroup = document.getElementById('filterGroup');
  ui.locationTitle = document.getElementById('locationTitle');
  ui.warningBanner = document.getElementById('warningBanner');
  ui.mainStatusLabel = document.getElementById('mainStatusLabel');
  ui.systemHealth = document.getElementById('systemHealth');
  ui.summaryTotal = document.getElementById('summaryTotal');
  ui.summaryOnline = document.getElementById('summaryOnline');
  ui.summaryOffline = document.getElementById('summaryOffline');
  ui.summaryFault = document.getElementById('summaryFault');
  ui.summaryFields = document.getElementById('summaryFields');
  ui.summaryMotors = document.getElementById('summaryMotors');
  ui.villageOverview = document.getElementById('villageOverview');
  ui.electricalMetrics = document.getElementById('electricalMetrics');
  ui.poleMetrics = document.getElementById('poleMetrics');
  ui.lightMetrics = document.getElementById('lightMetrics');
  ui.energyMetrics = document.getElementById('energyMetrics');
  ui.alertList = document.getElementById('alertList');
  ui.details = document.getElementById('detailsPanel');
  ui.eventList = document.getElementById('eventList');
  ui.nodeLayer = document.getElementById('nodeLayer');
  ui.sceneLayer = document.getElementById('sceneLayer');
  ui.nightButton = document.getElementById('toggleDayNight');
  ui.zoomIn = document.getElementById('zoomIn');
  ui.zoomOut = document.getElementById('zoomOut');
  ui.resetView = document.getElementById('resetView');
  ui.fitNetwork = document.getElementById('fitNetwork');
  ui.modal = document.getElementById('shutdownModal');
  ui.reason = document.getElementById('shutdownReason');
  ui.description = document.getElementById('shutdownDescription');
  ui.cancelShutdown = document.getElementById('cancelShutdown');
  ui.confirmShutdown = document.getElementById('confirmShutdown');
}

function bindEvents() {
  document.querySelector('[data-open-dashboard="transformer"]')?.addEventListener('click', () => {
    ui.dashboardLauncher.classList.add('hidden');
    ui.welcomeScreen.classList.add('hidden');
    ui.appShell.classList.add('visible');
    document.body.classList.add('dashboard-ready');
  });

  ui.form.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(ui.form);
    appState.village = formData.get('village') || appState.village;
    appState.mandal = formData.get('mandal') || appState.mandal;
    appState.district = formData.get('district') || appState.district;
    appState.state = formData.get('state') || appState.state;
    appState.locationName = formData.get('locationName') || appState.locationName;
    appState.latitude = formData.get('latitude') || appState.latitude;
    appState.longitude = formData.get('longitude') || appState.longitude;
    appState.fieldCount = Math.max(1, Number(formData.get('fieldCount')) || appState.fieldCount);
    appState.transformerCount = Math.max(1, Number(formData.get('transformerCount')) || appState.transformerCount);
    appState.mainTransformerName = formData.get('mainTransformer') || appState.mainTransformerName;
    readVillageMetrics(formData);
    generateNetwork();
  });

  ui.locationForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(ui.locationForm);
    appState.userRole = document.querySelector('.role-option.active')?.dataset.role || appState.userRole;
    appState.village = formData.get('village') || appState.village;
    appState.mandal = formData.get('mandal') || appState.mandal;
    appState.district = formData.get('district') || appState.district;
    appState.state = formData.get('state') || appState.state;
    appState.fieldCount = Math.max(1, Number(formData.get('fieldCount')) || appState.fieldCount);
    appState.transformerCount = Math.max(1, Number(formData.get('transformerCount')) || appState.transformerCount);
    appState.mainTransformerName = formData.get('mainTransformer') || appState.mainTransformerName;
    readVillageMetrics(formData);
    appState.locationName = `${appState.village} Rural Area`;
    appState.onboardingComplete = true;

    syncConfigForm();
    ui.welcomeScreen.classList.add('hidden');
    ui.appShell.classList.add('visible');
    document.body.classList.add('dashboard-ready');
    generateNetwork();
    addEventLog(`New session started for ${appState.userRole} in ${appState.village}.`, 'info');
    showTransformerDetails({ id: appState.mainTransformerName, type: 'Main Transformer' });
  });

  ui.search.addEventListener('input', (event) => {
    appState.search = event.target.value.trim().toLowerCase();
    applySearchAndFilter();
  });

  ui.filterGroup.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-filter]');
    if (!btn) return;
    appState.filter = btn.dataset.filter;
    updateFilterButtons();
    applySearchAndFilter();
  });

  ui.nightButton.addEventListener('click', toggleDayNight);
  ui.zoomIn.addEventListener('click', () => setZoom(1.15));
  ui.zoomOut.addEventListener('click', () => setZoom(0.85));
  ui.resetView.addEventListener('click', () => {
    ui.nodeLayer.setAttribute('transform', 'translate(0 0) scale(1)');
    ui.sceneLayer.setAttribute('transform', 'translate(0 0) scale(1)');
  });
  ui.fitNetwork.addEventListener('click', () => {
    ui.nodeLayer.setAttribute('transform', 'translate(0 0) scale(1.02)');
    ui.sceneLayer.setAttribute('transform', 'translate(0 0) scale(1.02)');
  });

  ui.cancelShutdown.addEventListener('click', closeShutdownModal);
  ui.confirmShutdown.addEventListener('click', () => {
    const reason = ui.reason.value || 'Unknown';
    const description = ui.description.value.trim();
    appState.mainTransformer.status = 'offline';
    appState.mainTransformer.reason = reason;
    appState.mainTransformer.description = description || 'Main transformer intentionally switched OFF';
    appState.mainTransformer.lastStatusChange = new Date();
    appState.mainTransformer.ownerNotification = `NOTICE TO ALL OWNERS: ${appState.mainTransformer.id} is OFF due to ${reason}. Red light means a problem. Do not switch it ON until an authorized operator clears the issue.`;
    appState.transformers.forEach((transformer) => {
      if (transformer.status !== 'fault') transformer.status = 'offline';
      transformer.systemMessage = appState.mainTransformer.ownerNotification;
    });
    addEventLog(`OWNER ALERT: ${appState.mainTransformer.ownerNotification}`, 'offline');
    updateMainTransformer();
    updateDashboard();
    showTransformerDetails(appState.mainTransformer);
    closeShutdownModal();
  });
}

function bindWelcomeEvents() {
  ui.roleButtons.forEach((button) => {
    button.addEventListener('click', () => {
      ui.roleButtons.forEach((item) => item.classList.toggle('active', item === button));
      appState.userRole = button.dataset.role || appState.userRole;
    });
  });
}

function syncConfigForm() {
  const formFields = {
    village: appState.village,
    mandal: appState.mandal,
    district: appState.district,
    state: appState.state,
    locationName: appState.locationName,
    latitude: appState.latitude,
    longitude: appState.longitude,
    fieldCount: String(appState.fieldCount),
    transformerCount: String(appState.transformerCount),
    mainTransformer: appState.mainTransformerName,
    villageCode: appState.villageCode,
    population: String(appState.population),
    houseCount: String(appState.houseCount),
    poleCount: String(appState.poleCount),
    streetLightCount: String(appState.streetLightCount),
    motorCount: String(appState.motorCount),
    mainCapacity: appState.mainCapacity,
    incomingVoltage: String(appState.incomingVoltage),
    incomingCurrent: String(appState.incomingCurrent)
  };

  Object.entries(formFields).forEach(([name, value]) => {
    const field = ui.form.elements.namedItem(name);
    if (field) field.value = value;
  });
}

function readVillageMetrics(formData) {
  appState.villageCode = formData.get('villageCode') || appState.villageCode;
  appState.population = Math.max(0, Number(formData.get('population')) || appState.population);
  appState.houseCount = Math.max(0, Number(formData.get('houseCount')) || appState.houseCount);
  appState.poleCount = Math.max(1, Number(formData.get('poleCount')) || appState.poleCount);
  appState.streetLightCount = Math.max(0, Number(formData.get('streetLightCount')) || appState.streetLightCount);
  appState.motorCount = Math.max(0, Number(formData.get('motorCount')) || appState.motorCount);
  appState.mainCapacity = formData.get('mainCapacity') || appState.mainCapacity;
  appState.incomingVoltage = Math.max(0, Number(formData.get('incomingVoltage')) || appState.incomingVoltage);
  appState.incomingCurrent = Math.max(0, Number(formData.get('incomingCurrent')) || appState.incomingCurrent);
}

function generateNetwork() {
  appState.mainTransformer = {
    id: appState.mainTransformerName,
    type: 'Main Transformer',
    status: 'online',
    voltage: appState.incomingVoltage,
    outputVoltage: 415,
    current: appState.incomingCurrent,
    totalLoad: 68,
    reason: 'None',
    description: 'Normal operation',
    ownerNotification: 'Blue light means the main transformer is safe and operating normally.',
    lastStatusChange: new Date(),
    connectedTransformers: appState.transformerCount
  };

  appState.transformers = [];
  appState.fields = [];
  appState.poles = [];
  ui.nodeLayer.innerHTML = '';
  ui.sceneLayer.innerHTML = '';
  renderLandscape();

  const centerX = 800;
  const centerY = 520;
  const total = Math.max(appState.transformerCount, appState.fieldCount);

  for (let index = 0; index < appState.fieldCount; index += 1) {
    const fieldId = `FIELD-${String(index + 1).padStart(2, '0')}`;
    const angle = (index / total) * Math.PI * 2;
    const radius = 610;
    const field = {
      id: fieldId,
      name: fieldId,
      motorId: `MOTOR-${String(index + 1).padStart(2, '0')}`,
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * 390
    };
    appState.fields.push(field);
    createField(field);
  }

  for (let index = 0; index < appState.transformerCount; index += 1) {
    const txNumber = String(index + 1).padStart(2, '0');
    const tx = {
      id: `TX-${txNumber}`,
      owner: transformerOwners[index] || 'Unassigned',
      type: '3-Phase',
      status: 'online',
      fieldId: `FIELD-${String((index % appState.fieldCount) + 1).padStart(2, '0')}`,
      motorId: `MOTOR-${String((index % appState.fieldCount) + 1).padStart(2, '0')}`,
      voltage: 415,
      current: 12 + ((index * 5) % 24),
      load: 35 + ((index * 12) % 55),
      temperature: 42 + ((index * 6) % 25),
      lastStatusChange: new Date(),
      faultReason: 'None',
      systemMessage: 'Normal power supply and irrigation load.',
      ...getTransformerPosition(index),
    };

    appState.transformers.push(tx);
    createTransformer(tx);
    createConnection(centerX, centerY, tx.x, tx.y, tx.status);
  }

  createMainTransformer(centerX, centerY);
  renderPoles();
  updateLocationInfo();
  updateDashboard();
  renderMonitoringPanels();
  applySearchAndFilter();
  addEventLog(`Generated ${appState.transformerCount} transformers around ${appState.village}.`, 'info');
}

function getTransformerPosition(index) {
  const innerRingCount = Math.min(8, appState.transformerCount);
  const isInnerRing = index < innerRingCount;
  const ringIndex = isInnerRing ? index : index - innerRingCount;
  const ringCount = isInnerRing ? innerRingCount : appState.transformerCount - innerRingCount;
  const angle = (ringIndex / Math.max(ringCount, 1)) * Math.PI * 2 - Math.PI / 2;
  const radiusX = isInnerRing ? 285 : 535;
  const radiusY = isInnerRing ? 225 : 400;

  return {
    x: 800 + Math.cos(angle) * radiusX,
    y: 520 + Math.sin(angle) * radiusY
  };
}

function renderLandscape() {
  const ground = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  ground.setAttribute('d', 'M0 0H1000V620H0Z M0 440C190 410 260 500 420 470C530 453 600 505 760 480C890 465 935 430 1000 450V620H0Z');
  ground.setAttribute('class', 'scene-ground');
  ui.sceneLayer.appendChild(ground);

  const roads = ['M80 350C220 430 330 290 500 360S790 430 960 380', 'M210 520C330 490 540 540 690 500S890 470 990 520', 'M260 140L500 260L760 140'];
  roads.forEach((path) => {
    const road = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    road.setAttribute('d', path);
    road.setAttribute('class', 'scene-road');
    ui.sceneLayer.appendChild(road);
  });

  const channels = ['M70 180C180 150 260 212 360 180S610 120 740 170S900 210 960 165', 'M80 260C180 225 260 290 360 255S610 200 750 255S900 285 960 240'];
  channels.forEach((path) => {
    const water = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    water.setAttribute('d', path);
    water.setAttribute('class', 'scene-water');
    ui.sceneLayer.appendChild(water);
  });

  const fields = [
    [70, 90, 200, 70, 260, 175, 120, 190],
    [720, 90, 920, 80, 980, 180, 760, 180],
    [280, 415, 410, 395, 470, 540, 300, 550],
    [600, 420, 840, 420, 930, 540, 610, 560]
  ];
  fields.forEach((points, idx) => {
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', points.join(' '));
    polygon.setAttribute('class', `scene-field ${idx % 2 === 0 ? '' : 'alt'}`);
    ui.sceneLayer.appendChild(polygon);
  });

  const houses = [
    [110, 90, 58, 44], [180, 78, 52, 40], [825, 110, 56, 40], [890, 90, 46, 38], [770, 485, 54, 40], [845, 495, 58, 42]
  ];
  houses.forEach(([x, y, w, h]) => {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', w);
    rect.setAttribute('height', h);
    rect.setAttribute('rx', 6);
    rect.setAttribute('class', 'scene-house');
    ui.sceneLayer.appendChild(rect);

    const roof = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    roof.setAttribute('d', `M${x - 4} ${y}L${x + w / 2} ${y - 16}L${x + w + 4} ${y}Z`);
    roof.setAttribute('fill', 'rgba(90,69,55,0.72)');
    ui.sceneLayer.appendChild(roof);
  });

  const trees = [[150, 430], [650, 120], [760, 170], [900, 350], [240, 580], [820, 570], [450, 130]];
  trees.forEach(([x, y]) => {
    const trunk = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    trunk.setAttribute('x', x);
    trunk.setAttribute('y', y + 15);
    trunk.setAttribute('width', 8);
    trunk.setAttribute('height', 18);
    trunk.setAttribute('fill', '#6d4a2d');
    trunk.setAttribute('rx', 4);
    ui.sceneLayer.appendChild(trunk);

    const canopy = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    canopy.setAttribute('cx', x + 4);
    canopy.setAttribute('cy', y);
    canopy.setAttribute('r', 18);
    canopy.setAttribute('class', 'scene-tree');
    ui.sceneLayer.appendChild(canopy);
  });

  const stationBanner = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  stationBanner.setAttribute('class', 'station-banner');

  const bannerSurface = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bannerSurface.setAttribute('x', 560);
  bannerSurface.setAttribute('y', 24);
  bannerSurface.setAttribute('width', 480);
  bannerSurface.setAttribute('height', 58);
  bannerSurface.setAttribute('rx', 12);
  bannerSurface.setAttribute('class', 'station-banner-surface');
  stationBanner.appendChild(bannerSurface);

  const bannerLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  bannerLabel.setAttribute('x', 800);
  bannerLabel.setAttribute('y', 47);
  bannerLabel.setAttribute('text-anchor', 'middle');
  bannerLabel.setAttribute('class', 'station-banner-label');
  bannerLabel.textContent = `SUBSTATION: ${appState.locationName}`;
  stationBanner.appendChild(bannerLabel);

  const bannerMeta = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  bannerMeta.setAttribute('x', 800);
  bannerMeta.setAttribute('y', 68);
  bannerMeta.setAttribute('text-anchor', 'middle');
  bannerMeta.setAttribute('class', 'station-banner-meta');
  bannerMeta.textContent = `${appState.village} • ${appState.district}`;
  stationBanner.appendChild(bannerMeta);

  ui.sceneLayer.appendChild(stationBanner);
}

function createPole(pole) {
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.setAttribute('class', 'pole-node');

  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', pole.x);
  line.setAttribute('y1', pole.y);
  line.setAttribute('x2', pole.x);
  line.setAttribute('y2', pole.y - 90);
  line.setAttribute('class', 'pole');
  group.appendChild(line);

  const lamp = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  lamp.setAttribute('cx', pole.x);
  lamp.setAttribute('cy', pole.y - 96);
  lamp.setAttribute('r', 6);
  lamp.setAttribute('class', 'lamp');
  lamp.setAttribute('fill', pole.status === 'on' ? '#ffef7a' : '#8e9aa6');
  if (appState.mode === 'night' && pole.status === 'on') {
    lamp.style.filter = 'drop-shadow(0 0 8px rgba(255,224,98,0.8))';
  }
  group.appendChild(lamp);

  const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  label.setAttribute('x', pole.x - 22);
  label.setAttribute('y', pole.y + 18);
  label.setAttribute('fill', 'rgba(240,245,250,0.8)');
  label.setAttribute('font-size', '9');
  label.setAttribute('font-weight', '700');
  label.textContent = pole.id;
  group.appendChild(label);

  ui.sceneLayer.appendChild(group);
}

function renderPoles() {
  const basePositions = [
    { id: 'POLE-01', x: 120, y: 370, status: 'on' },
    { id: 'POLE-02', x: 210, y: 430, status: 'off' },
    { id: 'POLE-03', x: 315, y: 390, status: 'on' },
    { id: 'POLE-04', x: 450, y: 438, status: 'off' },
    { id: 'POLE-05', x: 620, y: 395, status: 'on' },
    { id: 'POLE-06', x: 790, y: 420, status: 'off' },
    { id: 'POLE-07', x: 890, y: 360, status: 'on' },
    { id: 'POLE-08', x: 205, y: 190, status: 'on' },
    { id: 'POLE-09', x: 705, y: 220, status: 'off' },
    { id: 'POLE-10', x: 842, y: 270, status: 'on' }
  ];

  const positions = Array.from({ length: Math.min(appState.poleCount, 40) }, (_, index) => {
    const base = basePositions[index % basePositions.length];
    return { id: `POLE-${String(index + 1).padStart(3, '0')}`, x: base.x + (index % 4) * 8, y: base.y + Math.floor(index / basePositions.length) * 12, status: index % 17 === 0 ? 'off' : 'on' };
  });

  positions.forEach((pole) => {
    appState.poles.push(pole);
    createPole(pole);
  });
}

function createField(field) {
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.setAttribute('class', 'field-node');
  group.setAttribute('data-id', field.id);

  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', field.x - 54);
  rect.setAttribute('y', field.y - 28);
  rect.setAttribute('width', 108);
  rect.setAttribute('height', 56);
  rect.setAttribute('rx', 14);
  rect.setAttribute('class', 'field-surface');
  group.appendChild(rect);

  const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  label.setAttribute('x', field.x);
  label.setAttribute('y', field.y + 4);
  label.setAttribute('text-anchor', 'middle');
  label.setAttribute('class', 'field-label');
  label.textContent = field.id;
  group.appendChild(label);

  const motor = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  motor.setAttribute('x', field.x + 10);
  motor.setAttribute('y', field.y + 18);
  motor.setAttribute('font-size', '9');
  motor.setAttribute('font-weight', '700');
  motor.setAttribute('fill', '#062630');
  motor.textContent = field.motorId;
  group.appendChild(motor);

  group.addEventListener('click', () => {
    const tx = appState.transformers.find((item) => item.fieldId === field.id);
    showTransformerDetails(tx || appState.mainTransformer);
  });

  ui.nodeLayer.appendChild(group);
}

function createTransformer(transformer) {
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.setAttribute('class', `transformer-node ${transformer.status}`);
  group.setAttribute('data-id', transformer.id);
  group.setAttribute('data-type', 'transformer');
  group.setAttribute('transform', `translate(${transformer.x} ${transformer.y})`);

  const body = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  body.setAttribute('x', -90);
  body.setAttribute('y', -52);
  body.setAttribute('width', 180);
  body.setAttribute('height', 104);
  body.setAttribute('rx', 14);
  body.setAttribute('class', `body ${transformer.status}`);
  group.appendChild(body);

  const phase = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  phase.setAttribute('x', 0);
  phase.setAttribute('x', -72);
  phase.setAttribute('y', -27);
  phase.setAttribute('text-anchor', 'start');
  phase.setAttribute('class', 'phase-indicator');
  phase.textContent = '3PH';
  group.appendChild(phase);

  const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  label.setAttribute('x', 0);
  label.setAttribute('y', 5);
  label.setAttribute('text-anchor', 'middle');
  label.setAttribute('class', 'label transformer-id');
  label.textContent = transformer.id;
  group.appendChild(label);

  const status = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  status.setAttribute('x', -72);
  status.setAttribute('y', 35);
  status.setAttribute('text-anchor', 'start');
  status.setAttribute('class', 'transformer-status');
  status.textContent = transformer.status.toUpperCase();
  group.appendChild(status);

  const field = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  field.setAttribute('x', -72);
  field.setAttribute('y', 49);
  field.setAttribute('text-anchor', 'start');
  field.setAttribute('class', 'transformer-meta');
  field.textContent = transformer.fieldId;
  group.appendChild(field);

  const motor = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  motor.setAttribute('x', 8);
  motor.setAttribute('y', 49);
  motor.setAttribute('text-anchor', 'start');
  motor.setAttribute('class', 'transformer-meta');
  motor.textContent = transformer.motorId;
  group.appendChild(motor);

  const owner = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  owner.setAttribute('x', 0);
  owner.setAttribute('y', 22);
  owner.setAttribute('text-anchor', 'middle');
  owner.setAttribute('class', 'transformer-owner');
  owner.textContent = transformer.owner;
  group.appendChild(owner);

  const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  dot.setAttribute('cx', 72);
  dot.setAttribute('cy', -31);
  dot.setAttribute('r', 5);
  dot.setAttribute('class', 'status-dot');
  group.appendChild(dot);

  const blueLight = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  blueLight.setAttribute('cx', 72);
  blueLight.setAttribute('cy', -31);
  blueLight.setAttribute('r', 7);
  blueLight.setAttribute('class', 'blue-light');
  blueLight.setAttribute('opacity', '1');
  group.appendChild(blueLight);

  const alarmRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  alarmRing.setAttribute('cx', 72);
  alarmRing.setAttribute('cy', -31);
  alarmRing.setAttribute('r', 9);
  alarmRing.setAttribute('class', 'alarm-ring');
  group.appendChild(alarmRing);

  const glow = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  glow.setAttribute('x', -100);
  glow.setAttribute('y', -62);
  glow.setAttribute('width', 200);
  glow.setAttribute('height', 124);
  glow.setAttribute('rx', 18);
  glow.setAttribute('class', 'node-highlight');
  group.appendChild(glow);

  group.addEventListener('click', (event) => {
    event.stopPropagation();
    appState.selectedNode = transformer.id;
    showTransformerDetails(transformer);
  });

  ui.nodeLayer.appendChild(group);
}

function createMainTransformer(centerX, centerY) {
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.setAttribute('class', `main-transformer ${appState.mainTransformer.status}`);
  group.setAttribute('data-id', appState.mainTransformer.id);
  group.setAttribute('data-type', 'main');
  group.setAttribute('transform', `translate(${centerX} ${centerY})`);

  const body = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  body.setAttribute('x', -92);
  body.setAttribute('y', -74);
  body.setAttribute('width', 184);
  body.setAttribute('height', 148);
  body.setAttribute('rx', 18);
  body.setAttribute('class', `body ${appState.mainTransformer.status}`);
  group.appendChild(body);

  const bolt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  bolt.setAttribute('x', 0);
  bolt.setAttribute('y', 0);
  bolt.setAttribute('text-anchor', 'middle');
  bolt.setAttribute('font-size', '28');
  bolt.setAttribute('font-weight', '900');
  bolt.setAttribute('fill', '#ecfbff');
  bolt.textContent = '⚡';
  group.appendChild(bolt);

  const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  label.setAttribute('x', 0);
  label.setAttribute('y', 28);
  label.setAttribute('text-anchor', 'middle');
  label.setAttribute('class', 'label');
  label.textContent = 'MAIN TRANSFORMER';
  group.appendChild(label);

  const status = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  status.setAttribute('x', 0);
  status.setAttribute('y', 50);
  status.setAttribute('text-anchor', 'middle');
  status.setAttribute('class', 'status-label');
  status.textContent = appState.mainTransformer.status === 'online' ? 'ONLINE' : 'OFFLINE';
  group.appendChild(status);

  const glow = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  glow.setAttribute('x', -104);
  glow.setAttribute('y', -84);
  glow.setAttribute('width', 208);
  glow.setAttribute('height', 168);
  glow.setAttribute('rx', 22);
  glow.setAttribute('class', 'node-highlight');
  group.appendChild(glow);

  group.addEventListener('click', (event) => {
    event.stopPropagation();
    appState.selectedNode = appState.mainTransformer.id;
    showTransformerDetails(appState.mainTransformer);
  });

  ui.nodeLayer.appendChild(group);
}

function createConnection(fromX, fromY, toX, toY, status) {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  const dx = toX - fromX;
  const dy = toY - fromY;
  const distance = Math.sqrt((dx * dx) + (dy * dy));
  const controlX = fromX + (dx / distance) * distance * 0.56;
  const controlY = fromY + (dy / distance) * distance * 0.56;
  path.setAttribute('d', `M ${fromX} ${fromY} Q ${controlX} ${controlY} ${toX} ${toY}`);
  path.setAttribute('class', `network-line ${status === 'online' ? 'animated' : status === 'fault' ? 'fault' : status === 'warning' ? 'warning' : 'off'}`);
  if (appState.mainTransformer.status === 'offline') path.classList.add('off');
  ui.nodeLayer.insertBefore(path, ui.nodeLayer.firstChild);
}

function updateLocationInfo() {
  ui.locationTitle.textContent = `${appState.village.toUpperCase()} RURAL ELECTRICAL NETWORK`;
  const meta = `Mandal: ${appState.mandal} • District: ${appState.district} • State: ${appState.state} • Location: ${appState.locationName} • GPS: ${appState.latitude}, ${appState.longitude}`;
  ui.locationTitle.setAttribute('title', meta);
}

function updateDashboard() {
  ui.summaryTotal.textContent = String(appState.transformers.length);
  const online = appState.transformers.filter((t) => t.status === 'online').length;
  const offline = appState.transformers.filter((t) => t.status === 'offline').length;
  const fault = appState.transformers.filter((t) => t.status === 'fault').length;
  ui.summaryOnline.textContent = String(online);
  ui.summaryOffline.textContent = String(offline);
  ui.summaryFault.textContent = String(fault);
  ui.summaryFields.textContent = String(appState.fields.length);
  ui.summaryMotors.textContent = String(online);

  const statusText = appState.mainTransformer.status === 'online' ? 'ONLINE' : 'OFFLINE';
  const healthText = appState.mainTransformer.status === 'online' && fault === 0 ? 'HEALTHY' : fault > 0 ? 'WARNING' : 'OFFLINE';
  ui.mainStatusLabel.textContent = statusText;
  ui.systemHealth.textContent = healthText;
  ui.mainStatusLabel.className = `value status-badge ${appState.mainTransformer.status === 'online' ? 'success' : appState.mainTransformer.status === 'fault' ? 'danger' : 'warning'}`;
  ui.systemHealth.className = `value status-badge ${healthText === 'HEALTHY' ? 'success' : healthText === 'WARNING' ? 'warning' : 'danger'}`;

  const shouldWarn = appState.mainTransformer.status === 'offline';
  ui.warningBanner.classList.toggle('visible', shouldWarn);
  if (shouldWarn) {
    ui.warningBanner.innerHTML = `
      <h4>⚠️ MAIN TRANSFORMER OFF</h4>
      <p>Power supply interrupted.</p>
      <p>${appState.transformers.length} connected transformers affected.</p>
      <p>Reason: ${appState.mainTransformer.reason || 'Unknown'}.</p>
    `;
  }
  renderMonitoringPanels();
}

function metricMarkup(items) {
  return items.map(([label, value, tone = '']) => `<div class="metric-cell ${tone}"><span>${label}</span><strong>${value}</strong></div>`).join('');
}

function renderMonitoringPanels() {
  if (!ui.villageOverview) return;
  const online = appState.transformers.filter((item) => item.status === 'online').length;
  const faultyPoles = Math.max(1, Math.round(appState.poleCount * 0.03));
  const maintenancePoles = Math.max(1, Math.round(appState.poleCount * 0.02));
  const workingLights = Math.max(0, appState.streetLightCount - Math.max(1, Math.round(appState.streetLightCount * 0.04)));
  const totalPower = (appState.incomingVoltage * appState.incomingCurrent * 0.94 / 1000000).toFixed(2);
  const load = Math.round(appState.mainTransformer.totalLoad);

  ui.villageOverview.innerHTML = metricMarkup([
    ['Village', appState.village], ['Code', appState.villageCode], ['District', appState.district], ['State', appState.state],
    ['Population', appState.population.toLocaleString()], ['Houses', appState.houseCount.toLocaleString()], ['Farms', appState.fieldCount], ['Capacity', appState.mainCapacity]
  ]);
  ui.electricalMetrics.innerHTML = metricMarkup([
    ['Incoming Voltage', `${appState.incomingVoltage.toLocaleString()} V`, 'accent'], ['Incoming Current', `${appState.incomingCurrent} A`, 'accent'], ['Total Power', `${totalPower} MW`, 'good'], ['Village Load', `${load}%`, 'warning'], ['Frequency', '50 Hz'], ['Power Factor', '0.94']
  ]);
  ui.poleMetrics.innerHTML = metricMarkup([['Total Poles', appState.poleCount], ['Online', appState.poleCount - faultyPoles - maintenancePoles, 'good'], ['Faulty', faultyPoles, 'danger'], ['Maintenance', maintenancePoles, 'warning']]);
  if (ui.lightMetrics) {
    ui.lightMetrics.innerHTML = metricMarkup([['Total Lights', appState.streetLightCount], ['Working', workingLights, 'good'], ['Faulty', appState.streetLightCount - workingLights, 'danger'], ['Switched ON', Math.max(0, workingLights - 12), 'accent']]);
  }
  ui.energyMetrics.innerHTML = metricMarkup([['Total Village', `${totalPower} MW`], ['Residential', `${(appState.houseCount * 0.003).toFixed(2)} MW`], ['Agricultural', `${(appState.motorCount * 0.012).toFixed(2)} MW`], ['Daily Energy', `${(Number(totalPower) * 18).toFixed(1)} MWh`], ['Monthly Energy', `${(Number(totalPower) * 18 * 30).toFixed(0)} MWh`], ['Peak Demand', `${Math.min(99, load + 8)}%`]]);
  const alerts = [
    ...(appState.mainTransformer.status !== 'online' ? [[`🔴 OWNER ALERT: ${appState.mainTransformer.ownerNotification}`, 'danger']] : []),
    [`⚠ ${appState.mainTransformer.id} ${load}% Load`, load >= 80 ? 'warning' : 'info'],
    [`🔴 POLE-${String(faultyPoles).padStart(3, '0')} Fault`, 'danger'],
    [`⚠ TX-${String(Math.min(appState.transformerCount, 7)).padStart(2, '0')} High Load`, 'warning'],
    [`🔴 STREET-LIGHT-${String(Math.max(1, appState.streetLightCount - workingLights)).padStart(3, '0')} Failed`, 'danger']
  ];
  ui.alertList.innerHTML = alerts.map(([message, tone]) => `<li class="alert-item ${tone}">${message}</li>`).join('');
}

function updateMainTransformer() {
  const mainNode = document.querySelector('.main-transformer');
  if (mainNode) {
    mainNode.classList.remove('online', 'offline', 'fault', 'warning');
    mainNode.classList.add(appState.mainTransformer.status);
    const body = mainNode.querySelector('.body');
    if (body) {
      body.classList.remove('online', 'offline', 'fault', 'warning');
      body.classList.add(appState.mainTransformer.status);
    }

    const statusLabel = mainNode.querySelector('.status-label');
    if (statusLabel) {
      statusLabel.textContent = appState.mainTransformer.status === 'online' ? 'ONLINE' : appState.mainTransformer.status === 'fault' ? 'FAULT' : 'OFFLINE';
      statusLabel.setAttribute('fill', appState.mainTransformer.status === 'online' ? '#58de9d' : appState.mainTransformer.status === 'fault' ? '#ff5c6c' : '#ff5c6c');
    }
  }

  ui.nodeLayer.querySelectorAll('.network-line').forEach((line) => {
    if (appState.mainTransformer.status === 'offline') {
      line.classList.remove('animated');
      line.classList.add('off');
    } else {
      line.classList.remove('off');
      if (line.classList.contains('fault')) {
        line.classList.add('fault');
      } else {
        line.classList.remove('fault');
      }
      if (appState.mainTransformer.status === 'online') line.classList.add('animated');
    }
  });

  appState.transformers.forEach((tx) => {
    if (appState.mainTransformer.status !== 'online' && tx.status !== 'fault') {
      tx.status = 'offline';
      tx.faultReason = appState.mainTransformer.status === 'fault' ? 'Main transformer fault' : 'Main transformer is OFF';
      tx.systemMessage = appState.mainTransformer.ownerNotification;
    } else if (appState.mainTransformer.status === 'online' && tx.status === 'offline' && (tx.faultReason === 'Main transformer is OFF' || tx.faultReason === 'Main transformer fault')) {
      tx.status = 'online';
      tx.faultReason = 'None';
      tx.systemMessage = 'Main transformer restored. Blue power lights are active.';
    }
    updateTransformerStatus(tx);
  });
  updateDashboard();
}

function updateTransformerStatus(transformer) {
  const node = document.querySelector(`[data-id="${transformer.id}"]`);
  if (!node) return;
  const body = node.querySelector('.body');
  node.classList.remove('online', 'offline', 'fault', 'warning');
  node.classList.add(transformer.status);
  if (body) {
    body.classList.remove('online', 'offline', 'fault', 'warning');
    body.classList.add(transformer.status);
  }

  const dot = node.querySelector('.status-dot');
  const blueLight = node.querySelector('.blue-light');
  const alarmRing = node.querySelector('.alarm-ring');

  if (dot) {
    if (transformer.status === 'online') {
      dot.setAttribute('fill', '#4bb7ff');
    } else if (transformer.status === 'warning') {
      dot.setAttribute('fill', '#ffb84d');
    } else {
      dot.setAttribute('fill', '#ff5c6c');
    }
  }

  if (blueLight) {
    const showBlue = transformer.status === 'online';
    blueLight.setAttribute('opacity', showBlue ? '1' : '0');
    blueLight.setAttribute('fill', transformer.status === 'online' ? '#4bb7ff' : '#89d6ff');
    blueLight.setAttribute('stroke', transformer.status === 'online' ? '#dfefff' : '#a8d6ff');
  }

  if (alarmRing) {
    const showAlarm = transformer.status === 'fault' || transformer.status === 'warning' || transformer.status === 'offline';
    alarmRing.setAttribute('opacity', showAlarm ? '1' : '0');
    alarmRing.setAttribute('stroke', transformer.status === 'fault' ? '#ff5c6c' : transformer.status === 'warning' ? '#ffb84d' : '#ff5c6c');
  }

  if (transformer.status === 'online') {
    transformer.systemMessage = 'Main transformer is ON. Blue power light active and motors are running normally.';
  } else if (transformer.status === 'fault') {
    transformer.systemMessage = `Major issue: ${transformer.faultReason}. Both blue and red lights are active for fault response.`;
  } else if (transformer.status === 'warning') {
    transformer.systemMessage = `Warning: ${transformer.faultReason}. Check power quality and motor stability.`;
  } else {
    transformer.systemMessage = 'Main transformer is OFF. Red light is active and downstream motors are stopped.';
  }

  if (appState.mainTransformer.status === 'offline') {
    transformer.systemMessage = appState.mainTransformer.ownerNotification;
    transformer.status = 'offline';
    transformer.faultReason = 'Main transformer is OFF';
  }

  if (transformer.status === 'online' && appState.mainTransformer.status === 'offline') {
    transformer.status = 'offline';
    transformer.faultReason = 'Main transformer is OFF';
    transformer.systemMessage = appState.mainTransformer.ownerNotification;
  }
}

function toggleDayNight() {
  appState.mode = appState.mode === 'day' ? 'night' : 'day';
  document.body.classList.toggle('day-mode', appState.mode === 'day');
  ui.nightButton.textContent = appState.mode === 'day' ? '🌙 NIGHT MODE' : '☀️ DAY MODE';

  document.querySelectorAll('.pole-node .lamp').forEach((lamp) => {
    const isOn = lamp.getAttribute('fill') === '#ffef7a';
    lamp.setAttribute('fill', appState.mode === 'night' && isOn ? '#ffef7a' : '#8e9aa6');
    lamp.style.filter = appState.mode === 'night' && isOn ? 'drop-shadow(0 0 8px rgba(255,224,98,0.8))' : 'none';
  });
}

function setZoom(factor) {
  const current = ui.nodeLayer.getAttribute('transform') || 'translate(0 0) scale(1)';
  const match = current.match(/scale\(([^)]+)\)/);
  const currentScale = match ? Number(match[1]) : 1;
  const nextScale = Math.min(2.2, Math.max(0.7, currentScale * factor));
  ui.nodeLayer.setAttribute('transform', `translate(0 0) scale(${nextScale})`);
  ui.sceneLayer.setAttribute('transform', `translate(0 0) scale(${nextScale})`);
}

function showTransformerDetails(target) {
  if (!target) return;
  const isMain = target.id === appState.mainTransformer.id || target.type === 'Main Transformer';

  if (isMain) {
    const online = appState.transformers.filter((t) => t.status === 'online').length;
    const offline = appState.transformers.filter((t) => t.status === 'offline').length;
    const fault = appState.transformers.filter((t) => t.status === 'fault').length;
    ui.details.innerHTML = `
      <div class="detail-card">
        <h3>MAIN TRANSFORMER</h3>
        <div class="detail-list">
          <div class="detail-item"><span>ID</span><strong>${appState.mainTransformer.id}</strong></div>
          <div class="detail-item"><span>Status</span><strong>${appState.mainTransformer.status === 'online' ? '🟢 ONLINE' : '🔴 OFFLINE'}</strong></div>
          <div class="detail-item"><span>Input Voltage</span><strong>${appState.mainTransformer.voltage} V</strong></div>
          <div class="detail-item"><span>Output Voltage</span><strong>${appState.mainTransformer.outputVoltage} V</strong></div>
          <div class="detail-item"><span>Current</span><strong>${appState.mainTransformer.current} A</strong></div>
          <div class="detail-item"><span>Total Load</span><strong>${appState.mainTransformer.totalLoad}%</strong></div>
          <div class="detail-item"><span>Connected Transformers</span><strong>${appState.transformers.length}</strong></div>
          <div class="detail-item"><span>Online</span><strong>${online}</strong></div>
          <div class="detail-item"><span>Offline</span><strong>${offline}</strong></div>
          <div class="detail-item"><span>Fault</span><strong>${fault}</strong></div>
          <div class="detail-item"><span>Last Change</span><strong>${formatTime(appState.mainTransformer.lastStatusChange)}</strong></div>
          <div class="detail-item"><span>Reason</span><strong>${appState.mainTransformer.reason || 'None'}</strong></div>
          <div class="detail-item full-row owner-notice"><span>Owner Notice</span><strong>${appState.mainTransformer.ownerNotification || 'Blue light means safe operation.'}</strong></div>
        </div>
        <div class="actions">
          <button class="action-button primary" type="button" data-main-toggle ${appState.mainTransformer.status === 'online' ? '' : 'disabled'}>${appState.mainTransformer.status === 'online' ? 'Switch OFF' : 'TRANSFORMER LOCKED OFF'}</button>
          <button class="action-button alert" type="button" data-main-fault>Simulate Fault</button>
        </div>
      </div>
    `;

    ui.details.querySelector('[data-main-toggle]')?.addEventListener('click', () => {
      if (appState.mainTransformer.status === 'online') {
        ui.modal.classList.add('visible');
        ui.modal.setAttribute('aria-hidden', 'false');
      }
    });

    ui.details.querySelector('[data-main-fault]')?.addEventListener('click', () => {
      simulateFault(appState.mainTransformer.id);
    });
    return;
  }

  const transformer = appState.transformers.find((item) => item.id === target.id) || target;
  const statusLabel = transformer.status === 'online' ? '🟢 ONLINE' : transformer.status === 'warning' ? '🟠 WARNING' : transformer.status === 'fault' ? '🔴 FAULT' : '🔴 OFFLINE';
  const motorState = transformer.status === 'online' ? '🟢 RUNNING' : '🔴 OFF';
  const systemMessage = transformer.systemMessage || (appState.mainTransformer.status === 'offline' ? 'Main transformer is OFF. All downstream motors are stopped.' : transformer.faultReason !== 'None' ? `Problem alert: ${transformer.faultReason}` : 'Normal power supply and irrigation load.');

  ui.details.innerHTML = `
    <div class="detail-card">
      <h3>${transformer.id}</h3>
      <div class="detail-list">
        <div class="detail-item"><span>Type</span><strong>${transformer.type}</strong></div>
        <div class="detail-item"><span>Status</span><strong>${statusLabel}</strong></div>
        <div class="detail-item"><span>Connected Field</span><strong>${transformer.fieldId}</strong></div>
        <div class="detail-item"><span>Motor Pump</span><strong>${motorState}</strong></div>
        <div class="detail-item"><span>Voltage</span><strong>${transformer.voltage} V</strong></div>
        <div class="detail-item"><span>Current</span><strong>${transformer.current} A</strong></div>
        <div class="detail-item"><span>Load</span><strong>${transformer.load}%</strong></div>
        <div class="detail-item"><span>Temperature</span><strong>${transformer.temperature}°C</strong></div>
        <div class="detail-item"><span>Last Status Change</span><strong>${formatTime(transformer.lastStatusChange)}</strong></div>
        <div class="detail-item"><span>Shutdown Reason</span><strong>${transformer.faultReason || 'None'}</strong></div>
        <div class="detail-item full-row"><span>System Message</span><strong>${systemMessage}</strong></div>
      </div>
      <div class="actions">
        <button class="action-button primary" type="button" data-transformer-toggle>${transformer.status === 'online' ? 'Switch OFF' : 'Switch ON'}</button>
        <button class="action-button alert" type="button" data-transformer-fault>Simulate Fault</button>
      </div>
    </div>
  `;

  ui.details.querySelector('[data-transformer-toggle]')?.addEventListener('click', () => {
    if (transformer.status === 'online') {
      transformer.status = 'offline';
      transformer.faultReason = 'Manual shutdown';
      transformer.lastStatusChange = new Date();
      addEventLog(`${transformer.id} switched OFF manually.`, 'offline');
    } else {
      transformer.status = 'online';
      transformer.faultReason = 'None';
      transformer.lastStatusChange = new Date();
      addEventLog(`${transformer.id} switched ON.`, 'online');
    }
    updateTransformerStatus(transformer);
    updateDashboard();
    showTransformerDetails(transformer);
  });

  ui.details.querySelector('[data-transformer-fault]')?.addEventListener('click', () => {
    simulateFault(transformer.id);
  });
}

function simulateFault(id) {
  if (id === appState.mainTransformer.id) {
    appState.mainTransformer.status = 'fault';
    appState.mainTransformer.reason = 'Electrical fault';
    appState.mainTransformer.description = 'Main transformer fault reported';
    appState.mainTransformer.ownerNotification = `NOTICE TO ALL OWNERS: ${id} has a fault and is OFF. Red light means a problem. Do not switch it ON until an authorized operator clears the issue.`;
    appState.mainTransformer.lastStatusChange = new Date();
    addEventLog(`OWNER ALERT: ${appState.mainTransformer.ownerNotification}`, 'warning');
    appState.transformers.forEach((tx) => {
      if (tx.status !== 'fault') tx.status = 'offline';
    });
    updateMainTransformer();
    updateDashboard();
    showTransformerDetails(appState.mainTransformer);
    return;
  }

  const transformer = appState.transformers.find((item) => item.id === id);
  if (!transformer) return;

  const issue = ['Transformer fault', 'Phase fault', 'Motor pump fault', 'Overload', 'Power interruption', 'Street light fault'][Math.floor(Math.random() * 6)];
  transformer.status = 'fault';
  transformer.faultReason = issue;
  transformer.lastStatusChange = new Date();
  transformer.load = Math.min(100, transformer.load + 18);
  addEventLog(`${transformer.id} fault detected: ${issue}.`, 'warning');
  updateTransformerStatus(transformer);
  updateDashboard();
  showTransformerDetails(transformer);
}

function closeShutdownModal() {
  ui.modal.classList.remove('visible');
  ui.modal.setAttribute('aria-hidden', 'true');
}

function addEventLog(message, severity) {
  const item = document.createElement('li');
  item.className = 'event-item';
  const time = document.createElement('time');
  time.textContent = formatTime(new Date());

  const strong = document.createElement('strong');
  strong.innerHTML = `<span class="${severity}">${message}</span>`;

  item.appendChild(time);
  item.appendChild(strong);
  ui.eventList.prepend(item);

  while (ui.eventList.children.length > 12) {
    ui.eventList.removeChild(ui.eventList.lastChild);
  }
}

function formatTime(date) {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).format(date);
}

function applySearchAndFilter() {
  const matchText = (id) => (appState.search ? id.toLowerCase().includes(appState.search) : true);
  document.querySelectorAll('[data-id]').forEach((node) => {
    const id = node.dataset.id;
    const isTransformer = id.startsWith('TX-');
    const isField = id.startsWith('FIELD-');
    const isMain = id === appState.mainTransformer.id;
    let visible = true;

    if (appState.filter !== 'all') {
      if (isMain) {
        visible = appState.mainTransformer.status === appState.filter;
      } else if (isTransformer) {
        const tx = appState.transformers.find((item) => item.id === id);
        visible = tx ? tx.status === appState.filter : false;
      } else {
        visible = false;
      }
    }

    if (appState.search) {
      visible = visible && matchText(id);
    }

    node.style.opacity = visible ? '1' : '0.2';
    node.style.filter = visible ? 'none' : 'grayscale(0.8)';

    if (node.querySelector('.node-highlight')) {
      const selected = appState.selectedNode === id;
      node.querySelector('.node-highlight').classList.toggle('visible', selected);
    }
  });
}

function updateFilterButtons() {
  ui.filterGroup.querySelectorAll('[data-filter]').forEach((button) => {
    button.classList.toggle('active', button.dataset.filter === appState.filter);
  });
}

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeShutdownModal();
});

updateFilterButtons();
