(function () {
  const $ = id => document.getElementById(id);
  const token = new URLSearchParams(location.search).get('token') ?? '';

  async function api(path, { method = 'GET', body } = {}) {
    const res = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
  }

  function showBanner(msg, kind) {
    const banner = $('banner');
    banner.textContent = msg;
    banner.className = 'banner show ' + kind;
  }

  $('reveal').addEventListener('click', () => {
    const shown = $('password').type === 'text';
    $('password').type = shown ? 'password' : 'text';
    $('reveal').textContent = shown ? 'Show' : 'Hide';
  });

  $('join-form').addEventListener('submit', async e => {
    e.preventDefault();
    $('password-err').textContent = '';

    const password = $('password').value;
    if (password.length < 8) {
      $('password-err').textContent = 'Use at least 8 characters.';
      return;
    }

    const { ok, data } = await api('/api/join',
      { method: 'POST', body: { token, password, name: $('name').value, role: $('role').value } });
    if (!ok) {
      if (data.fields?.password) $('password-err').textContent = data.fields.password;
      else showBanner(data.error ?? 'Could not complete that.', 'bad');
      return;
    }
    location.assign('/');
  });

  (async function init() {
    const { ok, data } = await api('/api/join?token=' + encodeURIComponent(token));
    if (!ok) {
      $('invited').textContent = '';
      return showBanner(data.error ?? 'That invitation is no longer valid.', 'bad');
    }

    $('headline').innerHTML =
      `<span class="lite">Join</span> <span class="bold">${data.organisation || 'your team'}</span>`;
    $('invited').textContent =
      'You have been invited to work on this company’s launch campaigns. Set a password and you are in.';
    $('who').textContent = `Joining as ${data.email}`;
    $('join-form').hidden = false;
  })();
})();
