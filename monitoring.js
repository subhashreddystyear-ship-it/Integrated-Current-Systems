const employees = [
  { name: 'A. Ravi Kumar', initials: 'AR', role: 'Assistant Engineer', substation: 'Ramakuppam SS' },
  { name: 'S. Meena Devi', initials: 'SM', role: 'Line Inspector', substation: 'Chittoor Road SS' },
  { name: 'K. Prasad', initials: 'KP', role: 'Junior Engineer', substation: 'Kothapalli SS' },
  { name: 'P. Lakshmi', initials: 'PL', role: 'Line Inspector', substation: 'Madanapalli SS' },
  { name: 'V. Ramesh', initials: 'VR', role: 'Junior Engineer', substation: 'Kalavapalli SS' }
];

const substations = employees.map((employee, index) => ({
  name: employee.substation,
  employee: employee.name,
  villages: [],
  x: [19, 72, 45, 82, 25][index],
  y: [26, 20, 72, 66, 58][index]
}));

const villageNames = [
  'Ramakuppam', 'Kothapalli', 'Gollapalli', 'Chinnagottigallu', 'Pedduru', 'Madanapalli',
  'Kalavapalli', 'Punganur', 'Sundarapalli', 'Vepanapalli', 'Bandlapalli', 'Yerravaripalem',
  'Nimmanapalli', 'Bangarupalem', 'Palamaner', 'Keelapatla', 'Mogili', 'Sankarayalapeta',
  'Thamballapalli', 'Kalikiri', 'Pileru', 'Valmikipuram', 'Kurabalakota', 'Somala'
];

const initialStatuses = ['normal', 'normal', 'failure', 'warning', 'normal', 'repair', 'normal', 'failure', 'normal', 'normal', 'warning', 'normal', 'normal', 'repair', 'normal', 'failure', 'normal', 'normal', 'warning', 'normal', 'repair', 'normal', 'normal', 'normal'];
const villages = villageNames.map((name, index) => ({
  id: `village-${index + 1}`,
  name,
  status: initialStatuses[index],
  substation: substations[index % substations.length].name,
  gramPanchayat: `GP-${String(Math.floor(index / 4) + 1).padStart(2, '0')}`,
  poles: 18 + ((index * 7) % 30),
  lightsOn: 14 + ((index * 5) % 20),
  transformer: `TX-${String(index + 1).padStart(2, '0')}`,
  transformerStatus: [3, 10, 15].includes(index) ? 'problem' : 'normal',
  issue: initialStatuses[index] === 'normal' ? '' : index % 2 ? 'Low voltage sensor alert' : 'Feeder trip detected',
  issueState: initialStatuses[index] === 'repair' ? 'repairing' : initialStatuses[index] === 'normal' ? 'resolved' : 'reported',
  lastUpdate: `${index + 1} min ago`,
  x: 10 + (index % 6) * 16,
  y: 14 + Math.floor(index / 6) * 21
}));

substations.forEach((substation) => {
  substation.villages = villages.filter((village) => village.substation === substation.name);
});

const ui = {};
let selectedVillage = villages[0];
let showAllUpdates = false;

const statusMeta = {
  normal: { label: 'Normal', className: 'normal', icon: '&#10003;' },
  failure: { label: 'Power failure', className: 'failure', icon: '&#9889;' },
  warning: { label: 'Warning', className: 'warning', icon: '&#9888;' },
  repair: { label: 'Repair in progress', className: 'repair', icon: '&#8635;' }
};

function cacheUi() {
  ui.mandalName = document.getElementById('mandalName');
  ui.hierarchy = document.getElementById('hierarchy');
  ui.employeeList = document.getElementById('employeeList');
  ui.map = document.getElementById('villageMap');
  ui.search = document.getElementById('villageSearch');
  ui.detail = document.getElementById('villageDetail');
  ui.updates = document.getElementById('sensorUpdates');
  ui.addPanel = document.getElementById('addPanel');
  ui.form = document.getElementById('villageForm');
  ui.substationSelect = document.getElementById('substationSelect');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function initialize() {
  cacheUi();
  const savedLocation = sessionStorage.getItem('smartRuralLocation');
  if (savedLocation) {
    try {
      const location = JSON.parse(savedLocation);
      ui.mandalName.textContent = location.mandalam || location.village || 'Ramakuppam';
    } catch { /* use the default mandal */ }
  }
  bindEvents();
  renderAll();
}

function bindEvents() {
  ui.search.addEventListener('input', renderMap);
  document.getElementById('refreshFeed').addEventListener('click', refreshFeed);
  document.getElementById('addVillage').addEventListener('click', () => { ui.addPanel.hidden = false; });
  document.getElementById('closeAddVillage').addEventListener('click', () => { ui.addPanel.hidden = true; });
  document.getElementById('viewAllUpdates').addEventListener('click', () => { showAllUpdates = !showAllUpdates; renderUpdates(); });
  ui.form.addEventListener('submit', addVillage);
  ui.detail.addEventListener('click', handleDetailAction);
  ui.hierarchy.addEventListener('click', (event) => {
    const villageButton = event.target.closest('[data-village-id]');
    if (villageButton) selectVillage(villageButton.dataset.villageId);
  });
}

function renderAll() {
  renderHierarchy();
  renderEmployees();
  renderMap();
  renderDetail();
  renderUpdates();
  updateSummary();
}

function renderHierarchy() {
  ui.hierarchy.innerHTML = substations.map((substation) => `
    <details class="substation" open>
      <summary><span class="tree-chevron">&#8250;</span><span class="substation-icon">&#9889;</span><span class="tree-copy"><strong>${escapeHtml(substation.name)}</strong><small>${escapeHtml(substation.employee)}</small></span><b>${substation.villages.length}</b></summary>
      <div class="village-tree">${[...new Set(substation.villages.map((village) => village.gramPanchayat))].map((gramPanchayat) => `<div class="gp-group"><span class="gp-label">Gram Panchayat ${escapeHtml(gramPanchayat.replace('GP-', ''))}</span>${substation.villages.filter((village) => village.gramPanchayat === gramPanchayat).map((village) => `<button type="button" class="tree-village ${selectedVillage.id === village.id ? 'selected' : ''}" data-village-id="${village.id}"><i class="status-dot ${village.status}"></i>${escapeHtml(village.name)}<span>${statusMeta[village.status].label}</span></button>`).join('')}</div>`).join('')}</div>
    </details>`).join('');
}

function renderEmployees() {
  ui.employeeList.innerHTML = employees.map((employee) => `<div class="employee-row"><span class="avatar small">${employee.initials}</span><div><strong>${escapeHtml(employee.name)}</strong><small>${escapeHtml(employee.role)} · ${escapeHtml(employee.substation)}</small></div><span class="online-dot"></span></div>`).join('');
  ui.substationSelect.innerHTML = substations.map((substation) => `<option value="${escapeHtml(substation.name)}">${escapeHtml(substation.name)}</option>`).join('');
}

function renderMap() {
  const query = ui.search.value.trim().toLowerCase();
  const visible = villages.filter((village) => village.name.toLowerCase().includes(query));
  ui.map.innerHTML = `
    <div class="map-grid-lines"></div>
    <div class="map-road road-a"></div><div class="map-road road-b"></div><div class="map-road road-c"></div>
    <div class="map-label label-north">NORTH MANDAL</div><div class="map-label label-south">AGRICULTURAL BELT</div>
    ${substations.map((substation) => `<button type="button" class="substation-marker" style="left:${substation.x}%;top:${substation.y}%" title="${escapeHtml(substation.name)}"><span>&#9889;</span></button>`).join('')}
    ${visible.map((village) => `<button type="button" class="village-marker ${village.status} ${selectedVillage.id === village.id ? 'selected' : ''}" style="left:${village.x}%;top:${village.y}%" data-village-id="${village.id}" title="${escapeHtml(village.name)}"><span>${statusMeta[village.status].icon}</span><b>${escapeHtml(village.name)}</b></button>`).join('')}`;
  ui.map.querySelectorAll('[data-village-id]').forEach((marker) => marker.addEventListener('click', () => selectVillage(marker.dataset.villageId)));
}

function renderDetail() {
  const meta = statusMeta[selectedVillage.status];
  const issueText = selectedVillage.status === 'normal' ? 'No active issue. Sensor readings are within normal limits.' : selectedVillage.issue;
  ui.detail.innerHTML = `
    <div class="detail-top"><div><p class="kicker">Village details</p><h2>${escapeHtml(selectedVillage.name)}</h2><p class="detail-path">Mandal / ${escapeHtml(selectedVillage.gramPanchayat)} / ${escapeHtml(selectedVillage.substation)}</p></div><span class="status-pill ${meta.className}">${meta.icon} ${meta.label}</span></div>
    <div class="detail-stats"><div><span>Poles</span><strong>${selectedVillage.poles}</strong></div><div><span>Lights ON</span><strong>${selectedVillage.lightsOn}</strong></div><div><span>Transformer</span><strong>${escapeHtml(selectedVillage.transformer)}</strong></div></div>
    <div class="detail-section"><span class="section-label">Transformer status</span><div class="transformer-state ${selectedVillage.transformerStatus}"><i></i><strong>${selectedVillage.transformerStatus === 'normal' ? 'Working normally' : 'Problem detected'}</strong><small>${selectedVillage.transformerStatus === 'normal' ? 'Voltage stable at 415 V' : 'Temperature sensor above threshold'}</small></div></div>
    <div class="detail-section"><span class="section-label">Latest sensor update</span><div class="issue-box ${meta.className}"><span>${meta.icon}</span><div><strong>${escapeHtml(issueText)}</strong><small>Updated ${escapeHtml(selectedVillage.lastUpdate)} · Assigned to ${escapeHtml(substations.find((item) => item.name === selectedVillage.substation).employee)}</small></div></div></div>
    <div class="detail-actions"><button type="button" class="action-button report" data-action="report">Mark reported</button><button type="button" class="action-button repair" data-action="repair">Start repair</button><button type="button" class="action-button resolve" data-action="resolve">Resolve</button></div>`;
}

function renderUpdates() {
  const updates = villages.filter((village) => village.status !== 'normal').slice(0, showAllUpdates ? villages.length : 5);
  ui.updates.innerHTML = updates.length ? updates.map((village) => `<button type="button" class="update-row" data-village-id="${village.id}"><span class="update-icon ${village.status}">${statusMeta[village.status].icon}</span><span><strong>${escapeHtml(village.name)} · ${escapeHtml(village.issue)}</strong><small>${escapeHtml(village.substation)} · ${escapeHtml(village.lastUpdate)}</small></span><span class="update-arrow">&#8250;</span></button>`).join('') : '<p class="empty-state">No sensor problems are currently active.</p>';
  ui.updates.querySelectorAll('[data-village-id]').forEach((row) => row.addEventListener('click', () => selectVillage(row.dataset.villageId)));
  document.getElementById('viewAllUpdates').textContent = showAllUpdates ? 'Show recent' : 'View all';
}

function updateSummary() {
  const counts = { normal: 0, failure: 0, warning: 0, repair: 0 };
  villages.forEach((village) => { counts[village.status] += 1; });
  document.getElementById('totalVillages').textContent = villages.length;
  document.getElementById('normalVillages').textContent = counts.normal;
  document.getElementById('powerFailures').textContent = counts.failure;
  document.getElementById('transformerProblems').textContent = villages.filter((village) => village.transformerStatus === 'problem').length;
  document.getElementById('activeRepairs').textContent = counts.repair;
}

function selectVillage(id) {
  selectedVillage = villages.find((village) => village.id === id) || selectedVillage;
  renderHierarchy();
  renderMap();
  renderDetail();
  ui.detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function handleDetailAction(event) {
  const actionButton = event.target.closest('[data-action]');
  if (!actionButton) return;
  const action = actionButton.dataset.action;
  if (action === 'report') {
    selectedVillage.status = 'warning';
    selectedVillage.issueState = 'reported';
    selectedVillage.issue = selectedVillage.issue || 'Issue reported by field employee';
  }
  if (action === 'repair') {
    selectedVillage.status = 'repair';
    selectedVillage.issueState = 'repairing';
    selectedVillage.issue = selectedVillage.issue || 'Repair crew assigned';
  }
  if (action === 'resolve') {
    selectedVillage.status = 'normal';
    selectedVillage.issueState = 'resolved';
    selectedVillage.issue = '';
    selectedVillage.transformerStatus = 'normal';
  }
  selectedVillage.lastUpdate = 'just now';
  renderAll();
}

function refreshFeed() {
  const update = villages.find((village) => village.status === 'warning' || village.status === 'failure');
  if (update) update.lastUpdate = 'just now';
  renderUpdates();
}

function addVillage(event) {
  event.preventDefault();
  const formData = new FormData(ui.form);
  const substationName = formData.get('substation');
  const nextVillage = { id: `village-${Date.now()}`, name: formData.get('name'), status: 'normal', substation: substationName, gramPanchayat: `GP-${String(Math.floor(villages.length / 4) + 1).padStart(2, '0')}`, poles: Number(formData.get('poles')), lightsOn: Math.max(1, Math.round(Number(formData.get('poles')) * 0.8)), transformer: formData.get('transformer'), transformerStatus: 'normal', issue: '', issueState: 'resolved', lastUpdate: 'just now', x: 10 + (villages.length % 6) * 16, y: 14 + Math.floor(villages.length / 6) * 21 };
  villages.push(nextVillage);
  substations.find((substation) => substation.name === substationName).villages.push(nextVillage);
  selectedVillage = nextVillage;
  ui.form.reset();
  ui.addPanel.hidden = true;
  renderAll();
}

document.addEventListener('DOMContentLoaded', initialize);
