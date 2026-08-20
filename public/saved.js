(function () {
  const $ = id => document.getElementById(id);
  const rows = $('rows'), empty = $('empty');

  let flags = new Map();

  async function api(path, { method = 'GET' } = {}) {
    const res = await fetch(path, { method, credentials: 'same-origin' });
    if (res.status === 401) { location.href = '/'; throw new Error('signed out'); }
    return { ok: res.ok, data: res.status === 204 ? {} : await res.json().catch(() => ({})) };
  }

  const HEART = '<svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"><path d="M10 16.5S3.5 12.6 3.5 8.2A3.7 3.7 0 0110 6a3.7 3.7 0 016.5 2.2c0 4.4-6.5 8.3-6.5 8.3z"/></svg>';

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
    left.append(el('h2', undefined, l.name));
    left.append(el('p', 'launch-target',
      `${l.orbitType} · ${l.altitudeKm} km · ${l.inclinationDeg}° · ${l.windowMonth}`));
    head.append(left);

    const right = el('div');
    right.style.textAlign = 'right';
    right.append(el('div', 'provider', l.provider || 'Unnamed provider'));
    if (l.resold) right.append(el('div', 'operator', `flies on ${l.operator}`));
    const fav = el('button', 'fav on');
    fav.type = 'button';
    fav.title = 'Remove from saved';
    fav.setAttribute('aria-pressed', 'true');
    fav.innerHTML = HEART;
    fav.style.marginTop = '8px';
    fav.addEventListener('click', async () => {
      const { ok } = await api(`/api/saved/${l.id}`, { method: 'DELETE' });
      if (ok) load();
    });
    right.append(fav);
    head.append(right);
    card.append(head);

    const tags = el('div', 'tags');
    tags.style.marginTop = '14px';
    [l.vehicle, l.site || null, l.providerCountry && `${flags.get(l.providerCountry) ?? ''} ${l.providerCountry}`.trim()]
      .filter(Boolean).forEach(t => tags.append(el('span', 'tag', t)));
    card.append(tags);

    const pct = Math.min(100, Math.round(((l.capacityKg - l.availableKg) / l.capacityKg) * 100));
    const meter = el('div', 'meter');
    const track = el('div', 'meter-track');
    const fill = el('div', 'meter-fill');
    fill.style.width = pct + '%';
    track.append(fill);
    const legend = el('div', 'meter-legend');
    const spare = el('span');
    spare.append(el('b', undefined, `${l.availableKg} kg`), document.createTextNode(' spare'));
    legend.append(spare, el('span', undefined, `${l.capacityKg} kg capacity`));
    meter.append(track, legend);
    card.append(meter);

    card.append(el('p', 'saved-at', `Saved ${new Date(l.savedAt).toLocaleDateString()}`));
    return card;
  }

  async function load() {
    const { ok, data } = await api('/api/saved');
    if (!ok) return;
    rows.textContent = '';
    data.launches.forEach(l => rows.append(card(l)));
    empty.hidden = data.launches.length > 0;
  }

  (async function init() {
    const [me, options] = await Promise.all([api('/api/me'), api('/api/options')]);
    if (!me.ok) return;
    flags = new Map(options.data.countries.map(c => [c.name, c.flag]));
    renderAccount(me.data.user);
    renderNav(me.data.user, 'saved');
    load();
  })();
})();
