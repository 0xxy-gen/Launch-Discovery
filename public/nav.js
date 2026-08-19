// One nav for every signed-in page. Which tabs exist depends on the account,
// because access does: supply is advertised, demand is not.
window.renderNav = function renderNav(user, current) {
  const type = user.accountType;
  const sellsLaunch = type === 'launch_provider' || type === 'broker';
  const buysLaunch = type === 'payload_owner' || type === 'broker';

  const tabs = [{ href: '/launches', label: 'Launches', key: 'launches' }];
  if (sellsLaunch) tabs.push({ href: '/payloads', label: 'Payloads', key: 'payloads' });
  tabs.push(sellsLaunch
    ? { href: '/my-launches', label: 'My Launches', key: 'my-launches' }
    : { href: '/missions', label: 'My Missions', key: 'missions' });
  if (buysLaunch) tabs.push({ href: '/pooling', label: 'Aether Pooling', key: 'pooling' });

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
