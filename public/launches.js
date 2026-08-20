(function () {
  const $ = id => document.getElementById(id);
  const rows = $('rows'), empty = $('empty'), banner = $('banner');
  // Orbit and country are sets, not single choices: the real constraint is
  // "SSO or polar" and "US or EU", almost never exactly one value.
  const picked = { orbit: new Set(), country: new Set() };
  let windowFrom = '', windowTo = '';

  async function api(path) {
    const res = await fetch(path, { credentials: 'same-origin' });
    if (res.status === 401) { location.href = '/'; throw new Error('signed out'); }
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
  }

  let flags = new Map();
  let orbitLabels = new Map();
  let filtersBuilt = false;

  const heart = on => `<svg viewBox="0 0 20 20" width="18" height="18" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"><path d="M10 16.5S3.5 12.6 3.5 8.2A3.7 3.7 0 0110 6a3.7 3.7 0 016.5 2.2c0 4.4-6.5 8.3-6.5 8.3z"/></svg>`;

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  // an alert links to one launch, so mark it and scroll it into view
  const focusId = Number(new URLSearchParams(location.search).get('launch')) || 0;

  function card(l) {
    const card = el('div', 'launch-card' + (l.id === focusId ? ' focused' : ''));

    // The silhouette sits alongside the card rather than inside a chip, so the
    // size class is actually legible — that is the only thing it encodes.
    const art = el('div', 'launch-art');
    art.append(vehicleGlyph(l.vehicle, l.capacityKg));
    card.append(art);

    const main = el('div', 'launch-main');
    card.append(main);

    const head = el('div', 'launch-head');
    const left = el('div');
    left.append(el('h2', null, l.name));
    left.append(el('p', 'launch-target',
      `${l.orbitType} · ${l.altitudeKm} km · ${l.inclinationDeg}° · ${l.windowMonth}`));
    head.append(left);
    const right = el('div', 'launch-right');
    // A broker sells ports on someone else's rocket, so name both, stacked.
    const seller = el('div', 'seller');
    const line = el('div', 'provider-line');
    line.append(providerBadge(l.provider, l.providerLogo));
    line.append(el('span', 'provider', l.provider || 'Unnamed provider'));
    seller.append(line);
    if (l.resold) seller.append(el('div', 'operator', `flies on ${l.operator}`));
    right.append(seller);

    const save = el('button', 'fav' + (l.saved ? ' on' : ''));
    save.type = 'button';
    save.title = l.saved ? 'Remove from saved' : 'Save this launch';
    save.setAttribute('aria-pressed', String(Boolean(l.saved)));
    save.innerHTML = heart(l.saved);
    save.addEventListener('click', async () => {
      const next = !save.classList.contains('on');
      const res = await fetch(`/api/saved/${l.id}`, {
        method: next ? 'POST' : 'DELETE',
        headers: next ? { 'Content-Type': 'application/json' } : undefined,
        body: next ? '{}' : undefined,
        credentials: 'same-origin',
      });
      if (!res.ok) return;
      save.classList.toggle('on', next);
      save.setAttribute('aria-pressed', String(next));
      save.title = next ? 'Remove from saved' : 'Save this launch';
      save.innerHTML = heart(next);
    });
    right.append(save);

    head.append(right);
    main.append(head);

    const tags = el('div', 'tags');
    tags.style.marginTop = '14px';
    tags.append(el('span', 'tag', l.vehicle));
    if (l.site) tags.append(el('span', 'tag', l.site));
    if (l.providerCountry) {
      tags.append(el('span', 'tag', `${flags.get(l.providerCountry) ?? ''} ${l.providerCountry}`.trim()));
    }
    main.append(tags);

    const used = l.capacityKg - l.availableKg;
    const pct = Math.min(100, Math.round((used / l.capacityKg) * 100));
    const meter = el('div', 'meter');
    const track = el('div', 'meter-track');
    const fill = el('div', 'meter-fill');
    fill.style.width = pct + '%';
    track.append(fill);
    const legend = el('div', 'meter-legend');
    const spare = el('span');
    spare.append(el('b', null, `${l.availableKg} kg`), document.createTextNode(' spare'));
    spare.append(document.createTextNode(` of ${l.capacityKg} kg`));
    legend.append(spare, priceLabel(l));
    meter.append(track, legend);
    main.append(meter);


    return card;
  }

  function query() {
    const params = new URLSearchParams();
    if (picked.orbit.size) params.set('orbit', [...picked.orbit].join(','));
    if (picked.country.size) params.set('country', [...picked.country].join(','));
    if ($('minAvailable').value) params.set('minAvailable', $('minAvailable').value);
    if (windowFrom) params.set('from', windowFrom);
    if (windowTo) params.set('to', windowTo);
    return params.toString();
  }


  // ─── ranking ──────────────────────────────────────────────────────────────
  // Google Flights sorts on price. Launch pricing is negotiated and unpublished,
  // so there is no price here to sort on — the axes that actually separate one
  // flight from another are whether it fits, how much room is left over, and
  // how soon it goes.

  let sortKey = 'best';

  const SORTS = [
    { key: 'best',     label: 'Best match',
      hint: 'Fits the most of your satellites, with the most room to spare' },
    { key: 'cheapest', label: 'Cheapest',
      hint: 'Lowest quoted price per kilogram first' },
    { key: 'soonest',  label: 'Soonest',
      hint: 'Earliest launch window first' },
  ];

  const fitting = l => l.candidates.filter(c => c.ok && c.mass <= l.availableKg);

  const money = n => '$' + Math.round(n).toLocaleString('en-US');
  const plain = n => Math.round(n).toLocaleString('en-US');   // second half of a range

  // Quoting on request is normal in launch, so a missing price is stated rather
  // than hidden — an empty space would read as free.
  function priceLabel(l) {
    const span = el('span', 'price');
    if (l.priceLow == null) {
      span.classList.add('on-request');
      span.textContent = 'Price on request';
      return span;
    }
    // one currency symbol across the range, not one per end
    span.append(el('b', null, `${money(l.priceLow)}–${plain(l.priceHigh)}`));
    span.append(document.createTextNode(' /kg'));
    return span;
  }

  // How comfortably the heaviest satellite that fits would sit on this flight.
  function headroom(l) {
    const ok = fitting(l);
    if (!ok.length) return 0;
    return l.availableKg - Math.max(...ok.map(c => c.mass));
  }

  // The shortlist is a recommendation, not a view of the current sort, so it is
  // always ranked this way — switching tabs reorders the list underneath it and
  // leaves the top three where they are.
  function bestFirst(a, b) {
    const fa = fitting(a).length, fb = fitting(b).length;
    if (fa !== fb) return fb - fa;
    const ha = headroom(a), hb = headroom(b);
    if (ha !== hb) return hb - ha;
    return a.windowMonth.localeCompare(b.windowMonth);
  }

  function compare(a, b) {
    if (sortKey === 'soonest') return a.windowMonth.localeCompare(b.windowMonth);
    if (sortKey === 'cheapest') {
      // an unpriced flight cannot be ranked on price, so it sorts to the back
      const pa = a.priceLow ?? Infinity, pb = b.priceLow ?? Infinity;
      if (pa !== pb) return pa - pb;
      return a.windowMonth.localeCompare(b.windowMonth);
    }

    return bestFirst(a, b);
  }



  // ─── checkbox filters ─────────────────────────────────────────────────────
  // Counts come from the data, so an option with nothing behind it is never
  // offered — and you can see what a box is worth before ticking it.

  function checkGroup(host, items, set, { limit = 0 } = {}) {
    host.textContent = '';
    items.forEach((item, i) => {
      const label = el('label', 'check-row' + (limit && i >= limit ? ' extra' : ''));
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.value = item.value;
      box.checked = set.has(item.value);
      box.addEventListener('change', () => {
        if (box.checked) set.add(item.value); else set.delete(item.value);
        load();
      });
      label.append(box, el('span', 'check-text', item.label), el('span', 'check-count', String(item.n)));
      host.append(label);
    });
  }

  // ─── launch window ────────────────────────────────────────────────────────
  // Nobody books a launch on a given day, so the picker works in months and
  // takes both ends on one calendar: click the first month, then the last.

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthKey = (y, m) => `${y}-${String(m + 1).padStart(2, '0')}`;
  let anchor = '';   // first click of a new range, before the second lands

  function paintWindowButton() {
    const text = !windowFrom && !windowTo ? 'Any window'
      : windowFrom && windowTo && windowFrom !== windowTo ? `${windowFrom} → ${windowTo}`
      : `${windowFrom || windowTo} only`;
    $('window-text').textContent = text;
    $('window-btn').classList.toggle('set', Boolean(windowFrom || windowTo));
  }

  function paintCalendar(years) {
    const host = $('mr-years');
    host.textContent = '';
    for (const y of years) {
      const row = el('div', 'mr-year');
      row.append(el('div', 'mr-year-label', String(y)));
      const grid = el('div', 'mr-months');
      for (let m = 0; m < 12; m++) {
        const key = monthKey(y, m);
        const cell = el('button', 'mr-month', MONTHS[m]);
        cell.type = 'button';
        cell.dataset.key = key;
        if (!windowsAvailable.has(key)) cell.classList.add('empty');
        if (windowFrom && windowTo && key >= windowFrom && key <= windowTo) cell.classList.add('in');
        if (key === windowFrom || key === windowTo) cell.classList.add('end');
        if (key === anchor) cell.classList.add('end');
        cell.addEventListener('click', () => pickMonth(key, years));
        grid.append(cell);
      }
      row.append(grid);
      host.append(row);
    }
  }

  let windowsAvailable = new Set();

  function pickMonth(key, years) {
    if (!anchor) {
      // first click starts a new range and clears the old one
      anchor = key;
      windowFrom = windowTo = '';
      $('mr-hint').textContent = 'Now pick the last month you could fly.';
    } else {
      windowFrom = anchor < key ? anchor : key;
      windowTo = anchor < key ? key : anchor;
      anchor = '';
      $('mr-hint').textContent = 'Pick the first month you could fly.';
      load();
    }
    paintCalendar(years);
    paintWindowButton();
  }

  function setupWindow(months) {
    windowsAvailable = new Set(months);
    const years = [...new Set(months.map(m => Number(m.slice(0, 4))))].sort();
    if (!years.length) return;

    paintCalendar(years);
    paintWindowButton();

    $('window-btn').addEventListener('click', () => {
      const panel = $('month-range');
      panel.hidden = !panel.hidden;
      $('window-btn').setAttribute('aria-expanded', String(!panel.hidden));
    });
    $('mr-clear').addEventListener('click', () => {
      windowFrom = windowTo = anchor = '';
      $('mr-hint').textContent = 'Pick the first month you could fly.';
      paintCalendar(years);
      paintWindowButton();
      load();
    });
    $('mr-done').addEventListener('click', () => {
      $('month-range').hidden = true;
      $('window-btn').setAttribute('aria-expanded', 'false');
    });
  }

  // ─── price context ────────────────────────────────────────────────────────
  // Google Flights can say "prices are typical" because it has a price history
  // to compare against. There is no such history here — launch prices are not
  // published, let alone tracked over time — so inventing a trend line would be
  // fabricating market data. What IS honest is describing the listings actually
  // on screen: the range they span and where the middle of them sits.

  const quantile = (sorted, q) => {
    const pos = (sorted.length - 1) * q;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  };

  function renderPricePanel(list) {
    const panel = $('price-panel');
    const priced = list.filter(l => l.priceLow != null);

    // one listing is not a spread, and none is not a panel
    if (priced.length < 3) { panel.hidden = true; return; }

    const lows = priced.map(l => l.priceLow).sort((a, b) => a - b);
    const min = lows[0];
    const max = lows[lows.length - 1];
    const q1 = quantile(lows, 0.25);
    const q3 = quantile(lows, 0.75);
    const median = quantile(lows, 0.5);

    $('pp-title').textContent =
      `Listed prices run ${money(min)}–${plain(max)} per kg`;
    $('pp-lede').textContent =
      `Across ${priced.length} priced flights matching these filters. Half sit between `
      + `${money(q1)} and ${plain(q3)} — anything below that is cheap for this search.`;

    const span = max - min || 1;
    const pct = v => ((v - min) / span) * 100;

    const scale = $('pp-scale');
    scale.textContent = '';

    // the middle half, shaded, so "typical" is a band rather than a claim
    const mid = el('div', 'pp-mid');
    mid.style.left = pct(q1) + '%';
    mid.style.width = (pct(q3) - pct(q1)) + '%';
    scale.append(mid);

    // one tick per listing, so the shape of the market is visible, not asserted
    for (const l of priced) {
      const tick = el('div', 'pp-tick');
      tick.style.left = pct(l.priceLow) + '%';
      tick.title = `${l.name} — ${money(l.priceLow)}/kg`;
      scale.append(tick);
    }

    const mark = el('div', 'pp-median');
    mark.style.left = pct(median) + '%';
    mark.append(el('span', 'pp-median-label', `${money(median)} median`));
    scale.append(mark);

    $('pp-min').textContent = money(min);
    $('pp-max').textContent = money(max);
    panel.hidden = false;
  }

  $('pp-toggle').addEventListener('click', () => {
    const body = $('pp-body');
    const open = body.hidden;
    body.hidden = !open;
    $('pp-toggle').textContent = open ? 'Hide' : 'Show';
    $('pp-toggle').setAttribute('aria-expanded', String(open));
  });

  // The value that would lead under each sort, shown on the tab so the choice
  // is informative before you make it — Google Flights' "Cheapest from $191".
  function leadValue(key, list) {
    if (!list.length) return '';
    if (key === 'cheapest') {
      const priced = list.filter(l => l.priceLow != null);
      return priced.length ? `from ${money(Math.min(...priced.map(l => l.priceLow)))}/kg` : '';
    }
    if (key === 'soonest') {
      return `from ${list.map(l => l.windowMonth).sort()[0]}`;
    }
    const n = list.filter(l => fitting(l).length).length;
    return n ? `${n} fit yours` : '';
  }

  function renderTabs(list) {
    const host = $('sort-tabs');
    host.textContent = '';
    for (const s of SORTS) {
      const tab = el('button', 'sort-tab' + (s.key === sortKey ? ' on' : ''));
      tab.type = 'button';
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(s.key === sortKey));
      tab.title = s.hint;
      tab.append(el('span', 'sort-label', s.label));
      const lead = leadValue(s.key, list);
      if (lead) tab.append(el('span', 'sort-lead', lead));
      tab.addEventListener('click', () => {
        if (sortKey === s.key) return;
        sortKey = s.key;
        paint();
      });
      host.append(tab);
    }
    host.hidden = false;
  }

  let timer;
  const scheduleLoad = () => { clearTimeout(timer); timer = setTimeout(load, 200); };

  async function load() {
    const { ok, data } = await api('/api/launches?' + query());
    if (!ok) {
      banner.textContent = data.error ?? 'Could not load launches.';
      banner.className = 'banner show bad';
      return;
    }
    // Built once, from the unfiltered response, so the options do not vanish
    // underneath you as you tick them.
    if (!filtersBuilt && data.countries && data.orbits) {
      filtersBuilt = true;

      checkGroup($('orbit-group'),
        data.orbits.map(o => ({
          value: o.orbitType, label: orbitLabels.get(o.orbitType) ?? o.orbitType, n: o.n,
        })),
        picked.orbit);

      const countries = data.countries.map(c => ({
        value: c.country,
        label: `${flags.get(c.country) ?? ''} ${c.country}`.trim(),
        n: c.n,
      }));
      checkGroup($('country-group'), countries, picked.country, { limit: 6 });
      if (countries.length > 6) {
        const more = $('country-more');
        more.hidden = false;
        more.textContent = `Show all ${countries.length}`;
        let open = false;
        more.addEventListener('click', () => {
          open = !open;
          $('country-group').classList.toggle('open', open);
          more.textContent = open ? 'Show fewer' : `Show all ${countries.length}`;
        });
      }

      setupWindow([...new Set(data.launches.map(l => l.windowMonth))].sort());
    }

    current = data.launches;
    paint();
  }

  let current = [];

  function paint() {
    const all = [...current].sort(compare);

    // The shortlist only means anything if something actually fits. With no
    // satellites listed, or nothing compatible, promoting three at random would
    // be dressing up a guess.
    const viable = [...current].filter(l => fitting(l).length).sort(bestFirst);
    const top = viable.slice(0, 3);
    const topIds = new Set(top.map(l => l.id));

    const box = $('top-box');
    const topRows = $('top-rows');
    topRows.textContent = '';
    if (top.length) {
      top.forEach(l => topRows.append(card(l)));
      const refs = [...new Set(top.flatMap(l => fitting(l).map(c => c.reference)))];
      $('top-lede').textContent =
        `Ranked on what fits ${refs.slice(0, 3).join(', ')}`
        + `${refs.length > 3 ? ` and ${refs.length - 3} more` : ''}, and how much room is left over.`;
      box.hidden = false;
    } else {
      box.hidden = true;
    }

    const rest = all.filter(l => !topIds.has(l.id));
    rows.textContent = '';
    rest.forEach(l => rows.append(card(l)));

    empty.hidden = all.length > 0;
    renderTabs(all);
    renderPricePanel(all);
    $('count').textContent = top.length
      ? `${rest.length} other launch${rest.length === 1 ? '' : 'es'}`
      : `${all.length} launch${all.length === 1 ? '' : 'es'}`;

    document.querySelector('.focused')?.scrollIntoView({ block: 'center' });
  }

  $('minAvailable').addEventListener('input', scheduleLoad);
  $('clear').addEventListener('click', () => {
    picked.orbit.clear();
    picked.country.clear();
    $('minAvailable').value = '';
    windowFrom = windowTo = '';
    document.querySelectorAll('.check-group input').forEach(i => { i.checked = false; });
    paintWindowButton();
    load();
  });


  (async function init() {
    const [me, options] = await Promise.all([api('/api/me'), api('/api/options')]);
    if (!me.ok) return;
    renderAccount(me.data.user);
    renderNav(me.data.user, 'launches');
    setVehicleImages(options.data.vehicleImages);
    orbitLabels = new Map(options.data.orbitTypes.map(o => [o.value, o.label]));
    flags = new Map(options.data.countries.map(c => [c.name, c.flag]));
    load();
  })();
})();
