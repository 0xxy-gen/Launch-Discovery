(function () {
  const $ = id => document.getElementById(id);
  const KEY = 'ld.theme';

  async function api(path, { method = 'GET' } = {}) {
    const res = await fetch(path, { method, credentials: 'same-origin' });
    if (res.status === 401) { location.href = '/'; throw new Error('signed out'); }
    return { ok: res.ok, data: res.status === 204 ? {} : await res.json().catch(() => ({})) };
  }

  // "System" is the absence of a stored choice, so choosing it clears the key
  // rather than storing a third value.
  function currentChoice() {
    try { return localStorage.getItem(KEY) ?? 'system'; } catch { return 'system'; }
  }

  function applyTheme(choice) {
    const root = document.documentElement;
    const effective = choice === 'system'
      ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : choice;
    if (effective === 'light') root.setAttribute('data-theme', 'light');
    else root.removeAttribute('data-theme');

    try {
      if (choice === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, choice);
    } catch { /* private mode */ }
  }

  function paintChoice() {
    const choice = currentChoice();
    document.querySelectorAll('#theme-choice button').forEach(b => {
      b.classList.toggle('on', b.dataset.theme === choice);
    });
  }

  document.querySelectorAll('#theme-choice button').forEach(button => {
    button.addEventListener('click', () => {
      applyTheme(button.dataset.theme);
      paintChoice();
    });
  });

  $('signout').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
    location.href = '/';
  });

  (async function init() {
    const me = await api('/api/me');
    if (!me.ok) return;
    const user = me.data.user;

    renderAccount(user);
    renderNav(user, 'settings');

    $('who').textContent = [user.name, user.email].filter(Boolean).join(' · ');
    $('company').textContent = user.organisation || 'No company details yet';
    $('company-role').textContent = user.isAdmin ? 'Admin' : 'Member';
    paintChoice();
  })();
})();
