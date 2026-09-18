const locationForm = document.querySelector('#location-form');
const selects = [...locationForm.querySelectorAll('select')];
const stationButtons = [...document.querySelectorAll('.substation-item')];
const selectedStation = document.querySelector('#selected-station');
const selectedStatus = document.querySelector('#selected-status');
const locationStatus = document.querySelector('#location-status');
const confirmButton = document.querySelector('#confirm-location');
const backButton = document.querySelector('#back-button');

backButton.addEventListener('click', () => {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }
  window.location.href = 'index.html';
});

selects.forEach((select, index) => {
  select.addEventListener('change', () => {
    selects.slice(index + 1).forEach((nextSelect) => {
      nextSelect.value = '';
      nextSelect.disabled = true;
    });
    const nextSelect = selects[index + 1];
    if (select.value && nextSelect) nextSelect.disabled = false;
    locationStatus.textContent = '';
  });
});

stationButtons.forEach((button) => {
  button.addEventListener('click', () => {
    stationButtons.forEach((item) => item.classList.remove('is-selected'));
    button.classList.add('is-selected');
    selectedStation.textContent = button.dataset.station;
    const isMaintenance = button.querySelector('.station-state').classList.contains('warning');
    selectedStatus.textContent = isMaintenance
      ? 'Scheduled maintenance is in progress in this area.'
      : 'Power supply is stable in this area.';
    locationStatus.textContent = '';
  });
});

confirmButton.addEventListener('click', () => {
  const locationIsComplete = selects.every((select) => select.value);
  if (!locationIsComplete) {
    locationStatus.textContent = 'Select all six location fields to continue.';
    selects.find((select) => !select.value)?.focus();
    return;
  }
  const locationData = Object.fromEntries(selects.map((select) => [select.id, select.value]));
  sessionStorage.setItem('smartRuralLocation', JSON.stringify({
    ...locationData,
    station: selectedStation.textContent
  }));
  confirmButton.classList.add('is-success');
  confirmButton.querySelector('span').textContent = 'Substation selected';
  locationStatus.textContent = `You are viewing ${selectedStation.textContent}.`;
  window.setTimeout(() => {
    window.location.href = 'index.html';
  }, 250);
});
