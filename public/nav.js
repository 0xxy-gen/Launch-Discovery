// One nav for every signed-in page. Which tabs exist depends on the account,
// because access does: supply is advertised, demand is not.
window.renderNav = function renderNav(user, current) {
  const sellsLaunch = user.accountType === 'launch_provider' || user.accountType === 'broker';

  // Four tabs for everyone. Only the last one changes noun, because a
  // provider's own inventory is launches, not missions.
  const tabs = [
    { href: '/launches', label: 'Launches', key: 'launches' },
    { href: '/payloads', label: 'Payloads', key: 'payloads' },
    { href: '/pooling',  label: 'Aether Pooling', key: 'pooling' },
    sellsLaunch
      ? { href: '/my-launches', label: 'My Launches', key: 'my-launches' }
      : { href: '/missions', label: 'My Missions', key: 'missions' },
  ];

  const nav = document.getElementById('nav');
  if (!nav) return;

  for (const tab of tabs) {
    const a = document.createElement('a');
    a.href = tab.href;
    a.textContent = tab.label;
    a.className = 'nav-tab' + (tab.key === current ? ' current' : '');
    nav.appendChild(a);
  }
};

// ── account menu, top right ────────────────────────────────────────────────
// The avatar is the company, not a person: satellite operators and providers
// act as organisations here, so it carries the organisation's initials.
window.renderAccount = function renderAccount(user) {
  const host = document.getElementById('account');
  if (!host) return;
  host.textContent = '';

  const name = user.organisation || user.email;
  const initials = (user.organisation
    ? user.organisation.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0])
    : [user.email[0], user.email[1]]).join('').toUpperCase();

  const button = document.createElement('button');
  button.className = 'avatar';
  button.type = 'button';
  button.textContent = initials;
  button.setAttribute('aria-haspopup', 'menu');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-label', `Account: ${name}`);
  button.title = name;

  const menu = document.createElement('div');
  menu.className = 'account-menu';
  menu.setAttribute('role', 'menu');
  menu.hidden = true;

  const head = document.createElement('div');
  head.className = 'account-head';
  const org = document.createElement('div');
  org.className = 'account-org';
  org.textContent = user.organisation || 'No organisation yet';
  const meta = document.createElement('div');
  meta.className = 'account-meta';
  meta.textContent = `${user.accountTypeLabel} · ${user.email}`;
  head.append(org, meta);
  menu.append(head);

  const link = document.createElement('a');
  link.className = 'account-item';
  link.href = '/profile';
  link.textContent = 'Company profile';
  link.setAttribute('role', 'menuitem');
  menu.append(link);

  const out = document.createElement('button');
  out.className = 'account-item';
  out.type = 'button';
  out.textContent = 'Sign out';
  out.setAttribute('role', 'menuitem');
  out.addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
    location.href = '/';
  });
  menu.append(out);

  const close = () => {
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  };

  button.addEventListener('click', e => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
    button.setAttribute('aria-expanded', String(!menu.hidden));
  });
  document.addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  menu.addEventListener('click', e => e.stopPropagation());

  host.append(button, menu);

  // A profile with no organisation cannot publish anything, so say so here too.
  if (!user.profileComplete) button.classList.add('incomplete');
};
