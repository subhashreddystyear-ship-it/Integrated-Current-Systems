window.authReady = fetch('/api/auth/me', { credentials: 'same-origin' })
  .then(async (response) => {
    if (!response.ok) return { user: null };

    const text = await response.text();
    if (!text) return { user: null };

    try {
      return JSON.parse(text);
    } catch {
      return { user: null };
    }
  })
  .then(({ user }) => user)
  .catch(() => null);

window.requireAuth = async function requireAuth() {
  const user = await window.authReady;
  if (!user) window.location.replace('index.html');
  return user;
};

window.signOut = async function signOut() {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  window.location.replace('index.html');
};