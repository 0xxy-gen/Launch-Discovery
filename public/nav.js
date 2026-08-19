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
    { href: '/agents', label: 'Aether Agents', key: 'agents', badge: 'Beta' },
  ];

  const nav = document.getElementById('nav');
  if (!nav) return;

  for (const tab of tabs) {
    const a = document.createElement('a');
    a.href = tab.href;
    a.textContent = tab.label;
    a.className = 'nav-tab' + (tab.key === current ? ' current' : '');
    if (tab.badge) {
      const badge = document.createElement('span');
      badge.className = 'nav-badge';
      badge.textContent = tab.badge;
      a.appendChild(badge);
    }
    nav.appendChild(a);
  }
};

// ── account, top right ─────────────────────────────────────────────────────
// A straight link to the company profile. The avatar carries the company's
// initials, since operators and providers act as organisations here.
window.renderAccount = function renderAccount(user) {
  const host = document.getElementById('account');
  if (!host) return;
  host.textContent = '';

  const name = user.organisation || user.email;
  const initials = (user.organisation
    ? user.organisation.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0])
    : [user.email[0], user.email[1]]).join('').toUpperCase();

  const link = document.createElement('a');
  link.className = 'avatar';
  link.href = '/profile';
  link.textContent = initials;
  link.title = `${name} — company profile`;
  link.setAttribute('aria-label', `${name} — company profile`);

  // An unfinished profile blocks publishing, so it is flagged rather than hidden.
  if (!user.profileComplete) link.classList.add('incomplete');

  host.append(link);
};
