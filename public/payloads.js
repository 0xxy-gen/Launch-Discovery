(function () {
  const $ = id => document.getElementById(id);
  const rows = $('rows'), empty = $('empty'), banner = $('banner');
  const FILTERS = ['orbit', 'ride', 'form', 'massMin', 'massMax', 'from', 'to'];
  const SVG_NS = 'http://www.w3.org/2000/svg';

  async function api(path) {
    const res = await fetch(path, { credentials: 'same-origin' });
    if (res.status === 401) { location.href = '/'; throw new Error('signed out'); }
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
  }

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const svg = (tag, attrs) => {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  };

  // A small orbit sketch instead of an avatar: the ring is tilted by the
  // inclination band, so the orbit family reads at a glance — an SSO ring
  // stands near-vertical, an equatorial one lies flat.
  function glyph(inclinationBand) {
    const deg = parseFloat(inclinationBand) || 0;
    const node = svg('svg', { viewBox: '0 0 72 72', width: '128', height: '128', class: 'glyph' });

    node.append(svg('circle', {
      cx: 36, cy: 36, r: 33, fill: 'none',
      stroke: 'currentColor', 'stroke-opacity': '.10', 'stroke-width': '1',
    }));
    node.append(svg('circle', { cx: 36, cy: 36, r: 13, fill: 'var(--cyan)', 'fill-opacity': '.16' }));
    node.append(svg('circle', {
      cx: 36, cy: 36, r: 13, fill: 'none', stroke: 'var(--cyan)', 'stroke-opacity': '.5', 'stroke-width': '1',
    }));
    node.append(svg('ellipse', {
      cx: 36, cy: 36, rx: 27, ry: 9,
      fill: 'none', stroke: 'var(--cyan)', 'stroke-width': '1.4',
      transform: `rotate(${deg} 36 36)`,
    }));
    node.append(svg('circle', {
      cx: 36 + 27 * Math.cos(deg * Math.PI / 180),
      cy: 36 + 27 * Math.sin(deg * Math.PI / 180),
      r: 2.4, fill: 'var(--cyan)',
    }));
    return node;
  }

  const ICONS = {
    window: 'M3 5.5h10M4.5 2.5v2M11.5 2.5v2M3 5.5v8h10v-8z',
    mass: 'M8 2.5a1.6 1.6 0 100 3.2 1.6 1.6 0 000-3.2zM3 13.5l1.8-6.4h6.4L13 13.5z',
    orbit: 'M8 3.2c3.3 0 6 1.3 6 2.9s-2.7 2.9-6 2.9-6-1.3-6-2.9 2.7-2.9 6-2.9zM8 3.2v9.6',
    ride: 'M2.5 11.5h11M4.5 11.5V6.2L8 3l3.5 3.2v5.3',
  };

  function specRow(icon, text) {
    const row = el('div', 'spec-row');
    const node = svg('svg', { viewBox: '0 0 16 16', width: '15', height: '15', fill: 'none' });
    node.append(svg('path', {
      d: ICONS[icon], stroke: 'currentColor', 'stroke-width': '1.3',
      'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    }));
    row.append(node, el('span', null, text));
    return row;
  }

  function card(p) {
    const card = el('div', 'card');
    card.append(glyph(p.inclinationBand));
    card.append(el('p', 'card-ref', p.ref));
    card.append(el('p', 'card-sub', [p.jurisdiction, p.formFactor].filter(Boolean).join(' · ')));
    card.append(el('p', 'card-orbit', p.orbitType));

    const specs = el('div', 'spec-rows');
    specs.append(specRow('window', p.window));
    specs.append(specRow('mass', p.massBand));
    specs.append(specRow('orbit', `${p.altitudeBand} · ${p.inclinationBand}`));
    specs.append(specRow('ride', `${p.rideType}${p.propulsion ? ' · propulsive' : ''}`));
    card.append(specs);

    const actions = el('div', 'card-actions');
    const interest = el('button', 'ghost-sm', 'Express interest');
    interest.disabled = true;
    interest.title = 'Introductions are not wired up yet';
    actions.append(interest);
    card.append(actions);

    return card;
  }

  // A satellite, drawn in the same line style as the orbit glyphs
  function satellite() {
    const node = svg('svg', { viewBox: '0 0 64 64', width: '58', height: '58', fill: 'none' });
    const g = svg('g', {
      stroke: 'currentColor', 'stroke-width': '2',
      'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      transform: 'rotate(-20 32 32)',
    });
    g.append(svg('rect', { x: 25, y: 24, width: 14, height: 16, rx: 2 }));      // bus
    g.append(svg('rect', { x: 5,  y: 27, width: 16, height: 10, rx: 1.5 }));    // panel
    g.append(svg('rect', { x: 43, y: 27, width: 16, height: 10, rx: 1.5 }));    // panel
    g.append(svg('path', { d: 'M21 32h4M39 32h4' }));                            // booms
    g.append(svg('path', { d: 'M32 24v-6M28 15l4-3 4 3' }));                     // antenna
    node.append(g);
    return node;
  }

  function ctaCard() {
    const cta = el('div', 'cta-card');
    const top = el('div');
    top.append(satellite());
    top.append(el('h2', null, 'Want to find launch capacity?'));
    top.append(el('p', null,
      'Describe your mission and providers can find it — banded, so nobody learns your figures or your name until you accept an introduction.'));
    cta.append(top);
    const link = el('a', null, 'List your mission');
    link.href = '/missions';
    cta.append(link);
    return cta;
  }

  function query() {
    const params = new URLSearchParams();
    for (const id of FILTERS) if ($(id).value) params.set(id, $(id).value);
    return params.toString();
  }

  let timer;
  const scheduleLoad = () => { clearTimeout(timer); timer = setTimeout(load, 200); };

  async function load() {
    const { ok, data } = await api('/api/payloads?' + query());
    if (!ok) {
      banner.textContent = data.error ?? 'Could not load missions.';
      banner.className = 'banner show bad';
      return;
    }
    const list = data.payloads;
    rows.textContent = '';
    rows.append(ctaCard());
    list.forEach(p => rows.append(card(p)));
    empty.hidden = list.length > 0;
    $('count').textContent = `${list.length} mission${list.length === 1 ? '' : 's'}`;
  }

  FILTERS.forEach(id => {
    $(id).addEventListener('change', scheduleLoad);
    $(id).addEventListener('input', scheduleLoad);
  });
  $('clear').addEventListener('click', () => {
    FILTERS.forEach(id => { $(id).value = ''; });
    load();
  });


  (async function init() {
    const [me, options] = await Promise.all([api('/api/me'), api('/api/options')]);
    if (!me.ok) return;
    renderAccount(me.data.user);
    renderNav(me.data.user, 'payloads');
    const fill = (id, list) => { for (const o of list) $(id).add(new Option(o.label, o.value)); };
    fill('orbit', options.data.orbitTypes);
    fill('ride', options.data.rideTypes);
    fill('form', options.data.formFactors);
    load();
  })();
})();
