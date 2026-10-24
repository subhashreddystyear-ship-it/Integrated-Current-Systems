const loginForm = document.querySelector('#login-form');
const emailInput = document.querySelector('#login-email');
const passwordInput = document.querySelector('#login-password');
const statusMessage = document.querySelector('#login-status');
const submitButton = loginForm.querySelector('.submit-button');
const passwordToggle = document.querySelector('[data-toggle-password]');

// Check existing session
fetch('/api/auth/me', { credentials: 'same-origin' })
  .then(async (response) => {
    const text = await response.text();

    if (!text) {
      return { user: null };
    }

    try {
      return JSON.parse(text);
    } catch {
      return { user: null };
    }
  })
  .then(({ user }) => {
    if (user) {
      window.location.replace('rural-dashboard.html');
    }
  })
  .catch((error) => {
    console.error('Session check failed:', error);
  });

// Login validation
const loginFields = [
  {
    input: emailInput,
    error: document.querySelector('#login-email-error'),
    message: 'Enter a valid email address.'
  },
  {
    input: passwordInput,
    error: document.querySelector('#login-password-error'),
    message: 'Password must be at least 8 characters.'
  }
];

loginFields.forEach(({ input, error }) => {
  input.addEventListener('input', () => {
    input.closest('.field-group').classList.remove('has-error');
    error.textContent = '';
    statusMessage.textContent = '';
    statusMessage.removeAttribute('data-state');
  });
});

// Password show/hide
if (passwordToggle) {
  passwordToggle.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';

    passwordInput.type = isPassword ? 'text' : 'password';

    passwordToggle.setAttribute(
      'aria-label',
      isPassword ? 'Hide password' : 'Show password'
    );
  });
}

// Login
loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  let isValid = true;

  loginFields.forEach(({ input, error, message }) => {
    const valid = input.validity.valid;

    input.closest('.field-group').classList.toggle('has-error', !valid);
    error.textContent = valid ? '' : message;

    isValid = isValid && valid;
  });

  if (!isValid) {
    return;
  }

  submitButton.disabled = true;
  statusMessage.textContent = 'Signing in...';
  statusMessage.removeAttribute('data-state');

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'same-origin',
      body: JSON.stringify({
        email: emailInput.value.trim(),
        password: passwordInput.value
      })
    });

    const text = await response.text();

    let result = {};

    try {
      result = text ? JSON.parse(text) : {};
    } catch {
      if (response.status === 403) {
        throw new Error(
          'The server denied this sign-in request (403 Forbidden). Open the app at http://localhost:3000. If you already are, check whether a proxy or access rule is blocking it.'
        );
      }

      throw new Error(
        `The sign-in server sent an unexpected response (HTTP ${response.status}). Refresh the page and try again.`
      );
    }

    if (!response.ok) {
      throw new Error(result.error || 'Unable to sign in.');
    }

    submitButton.classList.add('is-success');

    const buttonLabel = submitButton.querySelector('.button-label');

    if (buttonLabel) {
      buttonLabel.textContent = 'Signed in';
    }

    statusMessage.textContent = 'Login successful. Redirecting...';

    window.setTimeout(() => {
      window.location.replace('rural-dashboard.html');
    }, 300);

  } catch (error) {
    console.error('LOGIN ERROR:', error);

    statusMessage.dataset.state = 'error';
    statusMessage.textContent = error instanceof TypeError
      ? 'Cannot reach the sign-in server. Start it with "npm start" and open this page at http://localhost:3000.'
      : error?.message || 'Unable to sign in. Please try again.';
    submitButton.disabled = false;
  }
});
