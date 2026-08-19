// One nav for every signed-in page. Which tabs exist depends on the account:
// browsing other people's demand is supply-side only.
window.renderNav = function renderNav(user, current) {
  const browse = user.accountType === 'launch_provider' || user.accountType === 'broker';
  const mine = user.accountType === 'launch_provider' ? 'My Launches' : 'My Missions';

  const pooling = user.accountType === 'payload_owner' || user.accountType === 'broker';

  const tabs = [];
  if (browse) tabs.push({ href: '/payloads', label: 'Payloads', key: 'payloads' });
  if (pooling) tabs.push({ href: '/pooling', label: 'Aether Pooling', key: 'pooling' });
  tabs.push({ href: '/missions', label: mine, key: 'missions' });

  const nav = document.getElementById('nav');
  if (!nav || tabs.length < 2) return;   // a single tab is noise, not navigation

  for (const tab of tabs) {
    const a = document.createElement('a');
    a.href = tab.href;
    a.textContent = tab.label;
    a.className = 'nav-tab' + (tab.key === current ? ' current' : '');
    nav.appendChild(a);
  }
};
