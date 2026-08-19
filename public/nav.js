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

// ── account cluster, top right ─────────────────────────────────────────────
// The avatar is a straight link to the company profile; the menu beside it
// holds everything that is not a top-level tab.
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
  link.title = `${name} — company profile`;
  link.setAttribute('aria-label', `${name} — company profile`);
  if (user.logo) {
    const img = document.createElement('img');
    img.src = user.logo;
    img.alt = '';
    link.append(img);
    link.classList.add('has-logo');
  } else {
    link.textContent = initials;
  }
  if (!user.profileComplete) link.classList.add('incomplete');

  // ── quick actions beside the avatar ───────────────────────────────────────
  const icon = (href, label, path, filled) => {
    const a = document.createElement('a');
    a.className = 'icon-link';
    a.href = href;
    a.title = label;
    a.setAttribute('aria-label', label);
    a.innerHTML =
      `<svg viewBox="0 0 20 20" width="18" height="18" fill="${filled ? 'currentColor' : 'none'}" ` +
      `stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">` +
      `<path d="${path}"/></svg>`;
    return a;
  };

  const CHAT = 'M17 11.5a6.5 6.5 0 01-6.5 6.5H4l-1.5 1.5v-7.9A6.5 6.5 0 0110.5 5h0a6.5 6.5 0 016.5 6.5z';
  const HEART = 'M10 16.5S3.5 12.6 3.5 8.2A3.7 3.7 0 0110 6a3.7 3.7 0 016.5 2.2c0 4.4-6.5 8.3-6.5 8.3z';

  const chat = icon('/messages', 'Inbox', CHAT);
  if (user.unreadCount) {
    chat.classList.add('unread');
    chat.title = `Inbox (${user.unreadCount} unread)`;
  }
  const saved = icon('/saved', 'Saved launch opportunities', HEART);
  if (user.savedCount) saved.title = `Saved launch opportunities (${user.savedCount})`;

  // ── the menu ──────────────────────────────────────────────────────────────
  const wrap = document.createElement('div');
  wrap.className = 'menu-wrap';

  const button = document.createElement('button');
  button.className = 'menu-button';
  button.type = 'button';
  button.setAttribute('aria-haspopup', 'menu');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-label', 'Menu');
  button.innerHTML =
    '<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 6h14M3 10h14M3 14h14"/></svg>';

  const menu = document.createElement('div');
  menu.className = 'menu';
  menu.setAttribute('role', 'menu');
  menu.hidden = true;

  const mine = user.accountType === 'launch_provider' || user.accountType === 'broker'
    ? { href: '/my-launches', label: 'My Launches' }
    : { href: '/missions', label: 'My Missions' };

  const items = [
    mine,
    { href: '/pooling?mine=1', label: 'My Pools' },
    { href: '/profile', label: 'Profile' },
    { href: '/saved', label: 'Saved Launch Opportunities' },
    { href: '/settings', label: 'Settings' },
  ];

  for (const item of items) {
    const a = document.createElement('a');
    a.className = 'menu-item';
    a.href = item.href;
    a.textContent = item.label;
    a.setAttribute('role', 'menuitem');
    menu.append(a);
  }

  const rule = document.createElement('div');
  rule.className = 'menu-rule';
  menu.append(rule);

  const out = document.createElement('button');
  out.className = 'menu-item';
  out.type = 'button';
  out.textContent = 'Log Out';
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
  menu.addEventListener('click', e => e.stopPropagation());
  document.addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  wrap.append(button, menu);
  host.append(chat, saved, link, wrap);
};
