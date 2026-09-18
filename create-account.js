const signupForm = document.querySelector('#signup-form');
const firstNameInput = document.querySelector('#first-name');
const lastNameInput = document.querySelector('#last-name');
const emailInput = document.querySelector('#signup-email');
const passwordInput = document.querySelector('#signup-password');
const termsInput = signupForm.querySelector('input[name="terms"]');
const submitButton = signupForm.querySelector('.submit-button');
const statusMessage = document.querySelector('#signup-status');

const fields = [
  { input: firstNameInput, error: document.querySelector('#first-name-error'), message: 'Enter your first name.' },
  { input: lastNameInput, error: document.querySelector('#last-name-error'), message: 'Enter your last name.' },
  { input: emailInput, error: document.querySelector('#signup-email-error'), message: 'Enter a valid email address.' },
  { input: passwordInput, error: document.querySelector('#signup-password-error'), message: 'Password must be at least 8 characters.' }
];

fields.forEach(({ input, error }) => {
  input.addEventListener('input', () => {
    input.closest('.field-group').classList.remove('has-error');
    error.textContent = '';
    statusMessage.textContent = '';
  });
});

signupForm.addEventListener('submit', (event) => {
  event.preventDefault();
  let isValid = true;

  fields.forEach(({ input, error, message }) => {
    const valid = input.validity.valid;
    input.closest('.field-group').classList.toggle('has-error', !valid);
    error.textContent = valid ? '' : message;
    isValid = isValid && valid;
  });

  if (!termsInput.checked) {
    statusMessage.textContent = 'Please agree to the Terms and Privacy Policy to continue.';
    isValid = false;
  }

  if (!isValid) return;

  submitButton.classList.add('is-success');
  submitButton.querySelector('.button-label').textContent = 'Your workspace is ready';
  statusMessage.textContent = 'Account created successfully.';
  window.setTimeout(() => {
    window.location.href = 'location.html';
  }, 700);
});