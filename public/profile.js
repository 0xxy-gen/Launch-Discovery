(function () {
  const $ = id => document.getElementById(id);
  const FIELDS = ['name', 'role', 'organisation', 'country', 'linkedin', 'dial', 'phone'];
  let me = null;
  const onboarding = new URLSearchParams(location.search).has('new');

  async function api(path, { method = 'GET', body } = {}) {
    const res = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
    if (res.status === 401) { location.href = '/'; throw new Error('signed out'); }
    return { ok: res.ok, data: await res.json().catch(() => ({})) };
  }

  const setError = (id, msg) => {
    $(id + '-err').textContent = msg || '';
    $(id).setAttribute('aria-invalid', msg ? 'true' : 'false');
  };

  function showBanner(msg, kind) {
    const banner = $('banner');
    banner.textContent = msg;
    banner.className = 'banner show ' + kind;
    if (kind === 'ok') setTimeout(() => { banner.className = 'banner'; }, 4000);
  }

  function paintCard() {
    const initials = (me.organisation
      ? me.organisation.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0])
      : [me.email[0], me.email[1]]).join('').toUpperCase();

    $('id-avatar').textContent = initials;
    $('id-org').textContent = me.organisation || 'No organisation yet';
    $('id-role').textContent = [me.name, me.role].filter(Boolean).join(' · ') || '—';

    const tags = $('id-tags');
    tags.textContent = '';
    [me.accountTypeLabel, me.country].filter(Boolean).forEach(text => {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = text;
      tags.appendChild(tag);
    });

    $('id-note').textContent = me.profileComplete
      ? 'Complete — you can publish requirements and launches.'
      : 'Add an organisation and a country before publishing anything.';
  }

  function fill() {
    FIELDS.forEach(id => { $(id).value = me[id] ?? ''; });
    paintCard();
  }

  $('profile-form').addEventListener('submit', async e => {
    e.preventDefault();
    FIELDS.forEach(id => setError(id, ''));

    const body = Object.fromEntries(FIELDS.map(id => [id, $(id).value]));
    const { ok, data } = await api('/api/profile', { method: 'PUT', body });
    if (!ok) {
      for (const [id, msg] of Object.entries(data.fields ?? {})) if ($(id)) setError(id, msg);
      return showBanner('Check the highlighted fields.', 'bad');
    }
    me = data.user;
    fill();
    renderAccount(me);

    // First time through, this form is a step rather than a settings page.
    if (onboarding) return location.assign('/');
    showBanner('Profile saved', 'ok');
  });

  FIELDS.forEach(id => $(id).addEventListener('input', () => setError(id, '')));

  $('signout').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
    location.href = '/';
  });

  // ── people ────────────────────────────────────────────────────────────────

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  async function loadPeople() {
    const { ok, data } = await api('/api/people');
    if (!ok) return;

    const host = $('people');
    host.textContent = '';

    for (const person of data.people) {
      const row = el('div', 'person');
      const left = el('div');
      left.append(el('div', 'person-email',
        (person.name || person.email) + (person.isYou ? '  (you)' : '')));
      left.append(el('div', 'person-role',
        [person.role || 'No role set', person.name ? person.email : null].filter(Boolean).join(' · ')));
      row.append(left);
      row.append(el('span', 'tag', person.companyRole === 'admin' ? 'Admin' : 'Member'));

      if (me.isAdmin && !person.isYou) {
        const remove = el('button', 'ghost-sm', 'Remove');
        remove.addEventListener('click', async () => {
          const { ok } = await api(`/api/people/${person.id}`, { method: 'DELETE' });
          if (ok) { showBanner(`${person.email} removed`, 'ok'); loadPeople(); }
        });
        row.append(remove);
      } else {
        row.append(el('span'));
      }
      host.append(row);
    }

    for (const invite of data.invites) {
      const row = el('div', 'person pending');
      const left = el('div');
      left.append(el('div', 'person-email', invite.email));
      left.append(el('div', 'person-role', 'Invited — not joined yet'));
      row.append(left, el('span', 'tag', 'Pending'));

      if (me.isAdmin) {
        const revoke = el('button', 'ghost-sm', 'Revoke');
        revoke.addEventListener('click', async () => {
          const { ok } = await api('/api/people/invite',
            { method: 'DELETE', body: { email: invite.email } });
          if (ok) { showBanner('Invitation revoked', 'ok'); loadPeople(); }
        });
        row.append(revoke);
      } else {
        row.append(el('span'));
      }
      host.append(row);
    }
  }

  $('invite-form').addEventListener('submit', async e => {
    e.preventDefault();
    $('invite-email-err').textContent = '';

    const { ok, data } = await api('/api/people/invite',
      { method: 'POST', body: { email: $('invite-email').value } });
    if (!ok) {
      if (data.fields?.['invite-email']) $('invite-email-err').textContent = data.fields['invite-email'];
      else showBanner(data.error ?? 'Could not send that invite.', 'bad');
      return;
    }
    $('invite-email').value = '';
    $('invite-link-value').textContent = data.link;
    $('invite-link').hidden = false;
    showBanner(`Invitation ready for ${data.email}`, 'ok');
    loadPeople();
  });

  $('copy-link').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('invite-link-value').textContent);
      showBanner('Link copied', 'ok');
    } catch {
      showBanner('Copy it manually — the clipboard is blocked here.', 'bad');
    }
  });

  (async function init() {
    const [meRes, options] = await Promise.all([api('/api/me'), api('/api/options')]);
    if (!meRes.ok) return;
    me = meRes.data.user;

    for (const c of options.data.countries) {
      $('country').add(new Option(`${c.flag}  ${c.name}`, c.name));
      $('dial').add(new Option(`${c.flag}  ${c.dial} · ${c.name}`, c.dial));
    }

    if (onboarding) {
      document.querySelector('.page-head .eyebrow').textContent = 'Welcome';
      document.querySelector('.page-head h1').innerHTML =
        '<span class="lite">Set up your</span> <span class="bold">company</span>';
      document.querySelector('.page-head .lede').textContent =
        'Your account is created. This is the company it acts for — colleagues can be added to it afterwards. Only the operating country is ever published.';
      document.querySelector('#profile-form button[type=submit]').textContent = 'Continue';
    }

    renderAccount(me);
    renderNav(me, 'profile');
    fill();

    // The people list is only meaningful once the company has a name.
    if (!onboarding) {
      $('people-section').hidden = false;
      $('invite-form').hidden = !me.isAdmin;
      loadPeople();
    }

    if (!me.isAdmin) {
      FIELDS.forEach(id => { $(id).disabled = true; });
      $('profile-form').querySelector('button[type=submit]').hidden = true;
      showBanner('Only an admin can edit the company details.', 'ok');
    }
  })();
})();
