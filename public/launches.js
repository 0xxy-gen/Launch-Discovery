(function () {
  const $ = id => document.getElementById(id);
  const rows = $('rows'), empty = $('empty'), banner = $('banner');
  const FILTERS = ['orbit', 'country', 'minAvailable', 'from', 'to'];

  async function api(path) {
    const res = await fetch(path, { credentials: 'same-origin' });
    if (res.status === 401) { location.href = '/'; throw new Error('signed out'); }
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
  }

  let flags = new Map();

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
    for (const id of FILTERS) if ($(id).value) params.set(id, $(id).value);
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
    const high = Math.round(l.priceHigh).toLocaleString('en-US');
    span.append(el('b', null, `${money(l.priceLow)}–${high}`));
    span.append(document.createTextNode(' /kg'));
    return span;
  }

  // How comfortably the heaviest satellite that fits would sit on this flight.
  function headroom(l) {
    const ok = fitting(l);
    if (!ok.length) return 0;
    return l.availableKg - Math.max(...ok.map(c => c.mass));
  }

  function compare(a, b) {
    if (sortKey === 'soonest') return a.windowMonth.localeCompare(b.windowMonth);
    if (sortKey === 'cheapest') {
      // an unpriced flight cannot be ranked on price, so it sorts to the back
      const pa = a.priceLow ?? Infinity, pb = b.priceLow ?? Infinity;
      if (pa !== pb) return pa - pb;
      return a.windowMonth.localeCompare(b.windowMonth);
    }

    // best: fits more of your satellites, then more headroom, then sooner
    const fa = fitting(a).length, fb = fitting(b).length;
    if (fa !== fb) return fb - fa;
    const ha = headroom(a), hb = headroom(b);
    if (ha !== hb) return hb - ha;
    return a.windowMonth.localeCompare(b.windowMonth);
  }

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
    // options come from the data, with a count, so nothing offered is empty
    const select = $('country');
    if (!select.dataset.filled && data.countries) {
      select.dataset.filled = '1';
      for (const c of data.countries) {
        const flag = flags.get(c.country);
        select.add(new Option(`${flag ? flag + '  ' : ''}${c.country} (${c.n})`, c.country));
      }
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
    const viable = all.filter(l => fitting(l).length);
    const top = sortKey === 'best' ? viable.slice(0, 3) : [];
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
    $('count').textContent = top.length
      ? `${rest.length} other launch${rest.length === 1 ? '' : 'es'}`
      : `${all.length} launch${all.length === 1 ? '' : 'es'}`;

    document.querySelector('.focused')?.scrollIntoView({ block: 'center' });
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
    renderNav(me.data.user, 'launches');
    setVehicleImages(options.data.vehicleImages);
    for (const o of options.data.orbitTypes) $('orbit').add(new Option(o.label, o.value));
    flags = new Map(options.data.countries.map(c => [c.name, c.flag]));
    load();
  })();
})();
