(function () {
  const $ = id => document.getElementById(id);
  const rows = $('rows'), empty = $('empty'), banner = $('banner');
  const FILTERS = ['orbit', 'minAvailable', 'from', 'to'];

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

  function card(l) {
    const card = el('div', 'launch-card');

    const head = el('div', 'launch-head');
    const left = el('div');
    left.append(el('h2', null, l.name));
    left.append(el('p', 'launch-target',
      `${l.orbitType} · ${l.altitudeKm} km · ${l.inclinationDeg}° · ${l.windowMonth}`));
    head.append(left);
    const right = el('div');
    right.append(el('div', 'provider', l.provider || 'Unnamed provider'));
    head.append(right);
    card.append(head);

    const tags = el('div', 'tags');
    tags.style.marginTop = '14px';
    tags.append(el('span', 'tag', l.vehicle), el('span', 'tag', l.site));
    if (l.providerCountry) tags.append(el('span', 'tag', l.providerCountry));
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
    rows.textContent = '';
    data.launches.forEach(l => rows.append(card(l)));
    empty.hidden = data.launches.length > 0;
    $('count').textContent = `${data.launches.length} launch${data.launches.length === 1 ? '' : 'es'}`;
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
    load();
  })();
})();
