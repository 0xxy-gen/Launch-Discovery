(function () {
  const $ = id => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';
  let me = null, flags = new Map(), data = { yours: [], others: [] };

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

  // orbit arcs behind a card header, standing in for the destination photo
  function arcs(scale = 1) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 400 200');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('class', 'arcs');
    for (const [ry, opacity] of [[150, .30], [118, .18], [88, .10]]) {
      const arc = document.createElementNS(NS, 'ellipse');
      arc.setAttribute('cx', '200');
      arc.setAttribute('cy', String(240 * scale));
      arc.setAttribute('rx', '300');
      arc.setAttribute('ry', String(ry));
      arc.setAttribute('fill', 'none');
      arc.setAttribute('stroke', '#7fefff');
      arc.setAttribute('stroke-opacity', String(opacity));
      arc.setAttribute('stroke-width', '1.2');
      svg.append(arc);
    }
    return svg;
  }

  const ORBIT_GLYPH =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.4">' +
    '<circle cx="12" cy="12" r="4.5"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-30 12 12)"/></svg>';

  function flagStrip(dest) {
    const strip = el('div', 'flags');
    dest.jurisdictions.slice(0, 4).forEach(c => strip.append(el('span', 'flag', flags.get(c) ?? '•')));
    if (dest.jurisdictions.length > 4) {
      strip.append(el('span', 'flag more', `+${dest.jurisdictions.length - 4}`));
    }
    return strip;
  }

  function goingText(dest) {
    const text = el('span', 'going-text');
    text.append(el('b', undefined,
      `${dest.satelliteCount} satellite${dest.satelliteCount === 1 ? '' : 's'}`));
    text.append(document.createTextNode(
      ` from ${dest.companies} ${dest.companies === 1 ? 'operator' : 'operators'}`));
    return text;
  }

  // ── the hero card, for orbits you are already going to ────────────────────
  function heroCard(dest) {
    const card = el('div', 'hero' + (dest.yours ? ' mine' : ''));

    const banner = el('div', 'hero-banner');
    banner.append(arcs());
    banner.append(el('span', 'hero-window', dest.window));
    banner.append(el('p', 'hero-orbit', dest.orbitType));
    banner.append(el('p', 'hero-alt', dest.altitudeBand));
    card.append(banner);

    const foot = el('div', 'hero-foot');
    const going = el('div', 'going');
    going.append(flagStrip(dest), goingText(dest));
    foot.append(going);
    if (dest.mineCount) {
      foot.append(el('span', 'yours-flag',
        `${dest.mineCount} ${dest.mineCount === 1 ? 'is' : 'are'} yours`));
    }
    card.append(foot);

    const groups = el('div', 'groups');
    groups.append(el('p', 'groups-head',
      dest.groups.length ? 'Groups in this orbit' : 'No groups here yet'));

    for (const group of dest.groups) {
      const row = el('div', 'group-row');
      const glyph = el('div', 'group-glyph');
      glyph.innerHTML = ORBIT_GLYPH;
      const middle = el('div');
      middle.append(el('div', 'group-name', group.name));
      middle.append(el('div', 'group-meta',
        `${group.members} member${group.members === 1 ? '' : 's'}`));
      const right = group.joined
        ? el('span', 'tag', 'Joined')
        : el('span', 'tag', 'Open');
      row.append(glyph, middle, right);
      groups.append(row);
    }

    const add = el('button', 'add-group', dest.groups.length ? '+  Start another group' : '+  Start a group');
    add.type = 'button';
    add.addEventListener('click', () => startGroup(dest));
    groups.append(add);

    card.append(groups);
    return card;
  }

  // ── the smaller card, for everywhere else ─────────────────────────────────
  function miniCard(dest) {
    const card = el('div', 'mini');

    const banner = el('div', 'mini-banner');
    banner.append(arcs(1.4));
    banner.append(el('span', 'mini-window', dest.window));
    banner.append(el('p', 'mini-orbit', dest.orbitType));
    banner.append(el('p', 'mini-alt', dest.altitudeBand));
    card.append(banner);

    const foot = el('div', 'mini-foot');
    const going = el('div', 'going');
    going.append(flagStrip(dest), goingText(dest));
    foot.append(going);
    card.append(foot);

    return card;
  }

  async function startGroup(dest) {
    const name = await promptDialog({
      title: 'Start a group',
      lead: `Everyone here is heading for ${dest.orbitType}, ${dest.altitudeBand}, ${dest.window}. Members see each other's exact figures and get a group chat.`,
      label: 'Group name',
      value: `${dest.orbitType} · ${dest.window}`,
      action: 'Start',
    });
    if (!name) return;

    const mine = await api('/api/missions');
    if (!mine.ok) return;
    const seed = mine.data.missions.find(m =>
      m.status === 'published'
      && m.published.orbitType === dest.orbitType
      && m.published.altitudeBand === dest.altitudeBand
      && m.published.window === dest.window);
    if (!seed) return showBanner('No published satellite of yours is going there.', 'bad');

    const res = await api('/api/pools', { method: 'POST', body: { name, missionId: seed.id } });
    if (!res.ok) return showBanner(res.data.error ?? 'Could not start that group.', 'bad');
    showBanner(`${name} started — it is open to others going the same way`, 'ok');
    load();
  }

  // ── sidebar ───────────────────────────────────────────────────────────────
  function renderSide() {
    const initials = (me.organisation
      ? me.organisation.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0])
      : [me.email[0], me.email[1]]).join('').toUpperCase();

    const avatar = $('side-avatar');
    avatar.textContent = '';
    if (me.logo) {
      const img = document.createElement('img');
      img.src = me.logo;
      img.alt = '';
      avatar.append(img);
    } else {
      avatar.textContent = initials;
    }
    $('side-name').textContent = me.organisation || me.email;
    $('side-sub').textContent = [me.country, me.accountTypeLabel].filter(Boolean).join(' · ');

    const orbits = $('side-orbits');
    orbits.textContent = '';
    $('side-orbit-count').textContent = data.yours.length || '';
    if (!data.yours.length) {
      orbits.append(el('p', 'side-empty', 'Publish a satellite and the orbit it is going to appears here.'));
    }
    for (const dest of data.yours) {
      const item = el('button', 'side-item');
      item.type = 'button';
      const glyph = el('div', 'side-glyph');
      glyph.innerHTML = ORBIT_GLYPH;
      const middle = el('div');
      middle.append(el('div', 'side-title', dest.orbitType));
      middle.append(el('div', 'side-sub', `${dest.altitudeBand} · ${dest.window}`));
      item.append(glyph, middle, el('span', 'side-count', String(dest.satelliteCount)));
      item.addEventListener('click', () => {
        document.getElementById('dest-' + dest.id.replace(/[^\w-]/g, ''))
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      orbits.append(item);
    }

    const joined = [...data.yours, ...data.others]
      .flatMap(d => d.groups.filter(g => g.joined).map(g => ({ ...g, dest: d })));
    const groups = $('side-groups');
    groups.textContent = '';
    $('side-group-count').textContent = joined.length || '';
    if (!joined.length) {
      groups.append(el('p', 'side-empty', 'Groups you join show up here, with a chat in your inbox.'));
    }
    for (const group of joined) {
      const item = el('a', 'side-item');
      item.href = '/messages';
      const glyph = el('div', 'side-glyph');
      glyph.innerHTML = ORBIT_GLYPH;
      const middle = el('div');
      middle.append(el('div', 'side-title', group.name));
      middle.append(el('div', 'side-sub', `${group.members} member${group.members === 1 ? '' : 's'}`));
      item.append(glyph, middle, el('span', 'side-count', 'Chat'));
      groups.append(item);
    }
  }

  async function load() {
    const res = await api('/api/destinations');
    if (!res.ok) return showBanner(res.data.error ?? 'Could not load orbits.', 'bad');
    data = res.data;

    $('yours').textContent = '';
    data.yours.forEach(d => {
      const card = heroCard(d);
      card.id = 'dest-' + d.id.replace(/[^\w-]/g, '');
      $('yours').append(card);
    });
    $('yours-section').hidden = data.yours.length === 0;
    $('yours-count').textContent = `${data.yours.length} orbit${data.yours.length === 1 ? '' : 's'}`;

    $('others').textContent = '';
    data.others.forEach(d => $('others').append(miniCard(d)));
    $('others-section').hidden = data.others.length === 0;
    $('others-count').textContent = `${data.others.length} orbit${data.others.length === 1 ? '' : 's'}`;

    $('empty').hidden = data.yours.length > 0 || data.others.length > 0;
    renderSide();
  }

  (async function init() {
    const [meRes, options] = await Promise.all([api('/api/me'), api('/api/options')]);
    if (!meRes.ok) return;
    me = meRes.data.user;
    renderAccount(me);
    renderNav(me, 'pooling');
    flags = new Map(options.data.countries.map(c => [c.name, c.flag]));
    load();
  })();
})();
