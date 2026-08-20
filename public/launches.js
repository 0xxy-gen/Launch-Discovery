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

    const head = el('div', 'launch-head');
    const left = el('div');
    left.append(el('h2', null, l.name));
    left.append(el('p', 'launch-target',
      `${l.orbitType} · ${l.altitudeKm} km · ${l.inclinationDeg}° · ${l.windowMonth}`));
    head.append(left);
    const right = el('div', 'launch-right');
    // A broker sells ports on someone else's rocket, so name both, stacked.
    const seller = el('div', 'seller');
    seller.append(el('div', 'provider', l.provider || 'Unnamed provider'));
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
    card.append(head);

    const tags = el('div', 'tags');
    tags.style.marginTop = '14px';
    tags.append(el('span', 'tag', l.vehicle), el('span', 'tag', l.site));
    if (l.providerCountry) {
      tags.append(el('span', 'tag', `${flags.get(l.providerCountry) ?? ''} ${l.providerCountry}`.trim()));
    }
    card.append(tags);

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
    legend.append(spare, el('span', null, `${l.capacityKg} kg capacity`));
    meter.append(track, legend);
    card.append(meter);

    // does anything of mine actually fit
    const fits = l.candidates.filter(c => c.ok && c.mass <= l.availableKg);
    if (l.candidates.length) {
      const fit = el('div', 'fit');
      if (fits.length) {
        fit.append(el('span', 'fit-yes',
          `Fits: ${fits.map(c => c.reference).join(', ')}`));
      } else {
        const why = el('div', 'fit-no');
        why.append(el('b', null, 'None of your missions fit. '));
        why.append(document.createTextNode(l.candidates.map(c => {
          if (!c.ok) return `${c.reference}: ${c.reasons[0]}`;
          return `${c.reference}: ${c.mass} kg exceeds the ${l.availableKg} kg spare`;
        }).join(' · ')));
        fit.append(why);
      }
      card.append(fit);
    }

    return card;
  }

  function query() {
    const params = new URLSearchParams();
    for (const id of FILTERS) if ($(id).value) params.set(id, $(id).value);
    return params.toString();
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

    rows.textContent = '';
    data.launches.forEach(l => rows.append(card(l)));
    empty.hidden = data.launches.length > 0;
    $('count').textContent = `${data.launches.length} launch${data.launches.length === 1 ? '' : 'es'}`;

    rows.querySelector('.focused')?.scrollIntoView({ block: 'center' });
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
    for (const o of options.data.orbitTypes) $('orbit').add(new Option(o.label, o.value));
    flags = new Map(options.data.countries.map(c => [c.name, c.flag]));
    load();
  })();
})();
