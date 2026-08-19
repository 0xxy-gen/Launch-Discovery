(function () {
  const $ = id => document.getElementById(id);
  const TEXT_FIELDS = [
    'firstName', 'lastName', 'role', 'linkedin', 'dial', 'phone',
    'organisation', 'website', 'description', 'entityType', 'fundingStage',
    'country', 'incorporatedIn', 'sizeBand', 'foundedYear',
    'flightHeritage', 'exportRegime',
  ];
  const FIELDS = [...TEXT_FIELDS, 'applications', 'logo'];
  let logo = '';
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
    const err = $(id + '-err');
    if (err) err.textContent = msg || '';
    $(id)?.setAttribute('aria-invalid', msg ? 'true' : 'false');
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

    const avatar = $('id-avatar');
    avatar.textContent = '';
    if (me.logo) {
      const img = document.createElement('img');
      img.src = me.logo;
      img.alt = '';
      avatar.append(img);
      avatar.style.background = 'transparent';
    } else {
      avatar.textContent = initials;
      avatar.style.background = '';
    }

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

    // completeness
    const pct = me.completeness?.percent ?? 0;
    $('pct').textContent = pct + '%';
    $('meter-fill').style.width = pct + '%';

    const missing = me.completeness?.missing ?? [];
    $('missing').hidden = missing.length === 0;
    const list = $('missing-list');
    list.textContent = '';
    missing.forEach(label => {
      const li = document.createElement('li');
      li.textContent = label;
      list.append(li);
    });

    $('id-note').textContent = me.profileComplete
      ? 'Complete enough to publish missions and launches.'
      : 'Add an organisation, a country and an organisation type before publishing.';
  }

  // the logo is resized in the browser, so what reaches the server is small
  function readLogo(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('unreadable'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('not an image'));
        img.onload = () => {
          const size = 256;
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = size;
          const ctx = canvas.getContext('2d');

          // cover-crop to a square so logos of any shape land the same
          const scale = Math.max(size / img.width, size / img.height);
          const w = img.width * scale, h = img.height * scale;
          ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);

          resolve(canvas.toDataURL('image/png'));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function paintLogo() {
    const preview = $('logo-preview');
    preview.textContent = '';
    if (logo) {
      const img = document.createElement('img');
      img.src = logo;
      img.alt = '';
      preview.append(img);
    } else {
      preview.textContent = 'No logo';
      preview.style.fontSize = '11px';
    }
    $('logo-clear').hidden = !logo;
  }

  $('logo-pick').addEventListener('click', () => $('logo-input').click());
  $('logo-clear').addEventListener('click', () => { logo = ''; paintLogo(); });
  $('logo-input').addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('logo', '');
    try {
      logo = await readLogo(file);
      paintLogo();
    } catch {
      setError('logo', 'That file could not be read as an image.');
    }
    e.target.value = '';
  });

  // funding only means anything for a commercial company
  function syncFunding() {
    const commercial = $('entityType').value === 'commercial';
    $('funding-field').hidden = !commercial;
    if (!commercial) $('fundingStage').value = '';
  }
  $('entityType').addEventListener('change', syncFunding);

  $('description').addEventListener('input', () => {
    $('description-count').textContent = $('description').value.length;
  });

  function readApplications() {
    return [...document.querySelectorAll('#applications input:checked')].map(i => i.value);
  }

  function fill() {
    TEXT_FIELDS.forEach(id => { $(id).value = me[id] ?? ''; });
    $('email').value = me.email;   // read-only, comes from the sign-in
    logo = me.logo ?? '';

    document.querySelectorAll('#applications input').forEach(i => {
      i.checked = (me.applications ?? []).includes(i.value);
    });

    $('description-count').textContent = ($('description').value || '').length;
    syncFunding();
    paintLogo();
    paintCard();
  }

  $('profile-form').addEventListener('submit', async e => {
    e.preventDefault();
    FIELDS.forEach(id => setError(id, ''));

    const body = Object.fromEntries(TEXT_FIELDS.map(id => [id, $(id).value]));
    body.applications = readApplications();
    body.logo = logo;
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

  // only the real inputs — 'applications' is a checkbox group and 'logo' a file
  TEXT_FIELDS.forEach(id => $(id).addEventListener('input', () => setError(id, '')));

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
      $('incorporatedIn').add(new Option(`${c.flag}  ${c.name}`, c.name));
      $('dial').add(new Option(`${c.flag}  ${c.dial} · ${c.name}`, c.dial));
    }

    const fill$ = (id, list) => { for (const o of list) $(id).add(new Option(o.label, o.value)); };
    fill$('entityType', options.data.entityTypes);
    fill$('fundingStage', options.data.fundingStages);
    fill$('sizeBand', options.data.companySizes);
    fill$('flightHeritage', options.data.flightHeritage);
    fill$('exportRegime', options.data.exportRegimes);

    const apps = $('applications');
    for (const a of options.data.applications) {
      const label = document.createElement('label');
      label.className = 'check-item';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = a.value;
      const span = document.createElement('span');
      span.textContent = a.label;
      label.append(input, span);
      apps.append(label);
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
      TEXT_FIELDS.forEach(id => { $(id).disabled = true; });
      document.querySelectorAll('#applications input').forEach(i => { i.disabled = true; });
      $('logo-pick').disabled = true;
      $('profile-form').querySelector('button[type=submit]').hidden = true;
      showBanner('Only an admin can edit the company details.', 'ok');
    }
  })();
})();
