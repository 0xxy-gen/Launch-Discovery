(function () {
  const $ = id => document.getElementById(id);
  const onlyMine = new URLSearchParams(location.search).has('mine');
  let flags = new Map();

  async function api(path, { method = 'GET', body } = {}) {
    const res = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
    if (res.status === 401) { location.href = '/'; throw new Error('signed out'); }
    return { ok: res.ok, data: res.status === 204 ? {} : await res.json().catch(() => ({})) };
  }

  function showBanner(msg, kind) {
    const banner = $('banner');
    banner.textContent = msg;
    banner.className = 'banner show ' + kind;
    if (kind === 'ok') setTimeout(() => { banner.className = 'banner'; }, 4000);
  }

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  // A quiet orbit arc behind the header, angled by the shell's inclination band.
  function banner(dest) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 320 90');
    svg.setAttribute('preserveAspectRatio', 'none');
    for (const [ry, opacity] of [[38, .35], [26, .2], [14, .12]]) {
      const path = document.createElementNS(ns, 'ellipse');
      path.setAttribute('cx', '160');
      path.setAttribute('cy', '104');
      path.setAttribute('rx', '210');
      path.setAttribute('ry', String(60 + ry));
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', '#7fefff');
      path.setAttribute('stroke-opacity', String(opacity));
      path.setAttribute('stroke-width', '1');
      svg.append(path);
    }
    return svg;
  }

  function destCard(dest) {
    const card = el('div', 'dest' + (dest.yours ? ' mine' : ''));

    const head = el('div', 'dest-banner');
    head.append(banner(dest));
    head.append(el('p', 'dest-orbit', dest.orbitType));
    head.append(el('p', 'dest-alt', dest.altitudeBand));
    head.append(el('span', 'dest-window', dest.window));
    card.append(head);

    const body = el('div', 'dest-body');

    // the "avatars" are the jurisdictions going — meaningful, and anonymous
    const going = el('div', 'going');
    const strip = el('div', 'flags');
    dest.jurisdictions.slice(0, 4).forEach(country => {
      strip.append(el('span', 'flag', flags.get(country) ?? '•'));
    });
    if (dest.jurisdictions.length > 4) {
      strip.append(el('span', 'flag more', `+${dest.jurisdictions.length - 4}`));
    }
    going.append(strip);

    const text = el('span', 'going-text');
    text.append(el('b', undefined, `${dest.satelliteCount} satellite${dest.satelliteCount === 1 ? '' : 's'}`));
    text.append(document.createTextNode(
      ` from ${dest.companies} ${dest.companies === 1 ? 'operator' : 'operators'}`));
    going.append(text);
    body.append(going);

    if (dest.mineCount) {
      body.append(el('p', 'yours-line',
        `${dest.mineCount} of them ${dest.mineCount === 1 ? 'is' : 'are'} yours`));
    }

    if (dest.groups.length) {
      const groups = el('div', 'groups');
      for (const group of dest.groups) {
        const row = el('div', 'group-row');
        const left = el('div');
        left.append(el('b', undefined, group.name));
        left.append(el('div', 'group-meta',
          `${group.members} member${group.members === 1 ? '' : 's'}`));
        row.append(left);
        row.append(el('span', 'tag', group.joined ? 'Joined' : 'Open'));
        groups.append(row);
      }
      body.append(groups);
    }

    // a group is only worth opening once you actually want to coordinate
    if (dest.yours) {
      const add = el('button', 'add-group', dest.groups.length ? 'Start another group here' : 'Start a group here');
      add.addEventListener('click', () => startGroup(dest));
      body.append(add);
    }

    card.append(body);
    return card;
  }

  async function startGroup(dest) {
    const name = prompt(`Name a group for ${dest.orbitType}, ${dest.window}`,
      `${dest.orbitType} · ${dest.window}`);
    if (!name || !name.trim()) return;

    const { ok, data } = await api('/api/missions');
    if (!ok) return;
    const seed = data.missions.find(m =>
      m.status === 'published'
      && m.published.orbitType === dest.orbitType
      && m.published.altitudeBand === dest.altitudeBand
      && m.published.window === dest.window);
    if (!seed) return showBanner('No published satellite of yours is going there.', 'bad');

    const res = await api('/api/pools', { method: 'POST', body: { name: name.trim(), missionId: seed.id } });
    if (!res.ok) return showBanner(res.data.error ?? 'Could not start that group.', 'bad');
    showBanner(`${name.trim()} started — it is open for others going the same way`, 'ok');
    load();
  }

  async function load() {
    const { ok, data } = await api('/api/destinations');
    if (!ok) return showBanner(data.error ?? 'Could not load destinations.', 'bad');

    const yours = data.yours;
    const others = onlyMine ? [] : data.others;

    $('yours').textContent = '';
    yours.forEach(d => $('yours').append(destCard(d)));
    $('yours-section').hidden = yours.length === 0;
    $('yours-count').textContent =
      `${yours.length} orbit${yours.length === 1 ? '' : 's'}`;

    $('others').textContent = '';
    others.forEach(d => $('others').append(destCard(d)));
    $('others-section').hidden = others.length === 0;
    $('others-count').textContent =
      `${others.length} orbit${others.length === 1 ? '' : 's'}`;

    $('empty').hidden = yours.length > 0 || others.length > 0;
  }

  (async function init() {
    const [me, options] = await Promise.all([api('/api/me'), api('/api/options')]);
    if (!me.ok) return;
    renderAccount(me.data.user);
    renderNav(me.data.user, 'pooling');
    flags = new Map(options.data.countries.map(c => [c.name, c.flag]));

    if (onlyMine) {
      document.querySelector('.page-head h1').innerHTML =
        '<span class="lite">Orbits</span> <span class="bold">you are going to</span>';
    }
    load();
  })();
})();
