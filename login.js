const loginForm = document.querySelector('#login-form');
const emailInput = document.querySelector('#login-email');
const passwordInput = document.querySelector('#login-password');
const statusMessage = document.querySelector('#login-status');
const submitButton = loginForm.querySelector('.submit-button');
const passwordToggle = document.querySelector('[data-toggle-password]');

if (sessionStorage.getItem('isLoggedIn') === 'true') {
  window.location.href = 'location.html';
}

const loginFields = [
  { input: emailInput, error: document.querySelector('#login-email-error'), message: 'Enter a valid email address.' },
  { input: passwordInput, error: document.querySelector('#login-password-error'), message: 'Password must be at least 8 characters.' }
];

loginFields.forEach(({ input, error }) => {
  input.addEventListener('input', () => {
    input.closest('.field-group').classList.remove('has-error');
    error.textContent = '';
    statusMessage.textContent = '';
  });
});

passwordToggle.addEventListener('click', () => {
  const isPassword = passwordInput.type === 'password';
  passwordInput.type = isPassword ? 'text' : 'password';
  passwordToggle.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
});

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();

  let isValid = true;

  loginFields.forEach(({ input, error, message }) => {
    const valid = input.validity.valid;
    input.closest('.field-group').classList.toggle('has-error', !valid);
    error.textContent = valid ? '' : message;
    isValid = isValid && valid;
  });

  if (!isValid) return;

  submitButton.classList.add('is-success');
  submitButton.querySelector('.button-label').textContent = 'Signed in';
  statusMessage.textContent = 'Login successful. Redirecting...';
  sessionStorage.setItem('isLoggedIn', 'true');

  window.setTimeout(() => {
    window.location.href = 'location.html';
  }, 700);
});
