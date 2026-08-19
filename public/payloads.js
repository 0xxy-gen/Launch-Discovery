(function () {
  const $ = id => document.getElementById(id);
  const rows = $('rows'), empty = $('empty'), banner = $('banner');
  const FILTERS = ['orbit', 'ride', 'form', 'massMin', 'massMax', 'from', 'to'];

  async function api(path) {
    const res = await fetch(path, { credentials: 'same-origin' });
    if (res.status === 401) { location.href = '/'; throw new Error('signed out'); }
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
  }

  function query() {
    const params = new URLSearchParams();
    for (const id of FILTERS) if ($(id).value) params.set(id, $(id).value);
    return params.toString();
  }

  function card(p) {
    const el = document.createElement('div');
    el.className = 'payload-card';

    const left = document.createElement('div');

    const head = document.createElement('div');
    head.className = 'payload-head';
    const ref = document.createElement('span');
    ref.className = 'payload-ref';
    ref.textContent = p.ref;
    const jur = document.createElement('span');
    jur.className = 'payload-jur';
    jur.textContent = p.jurisdiction;
    head.append(ref, jur);

    const tags = document.createElement('div');
    tags.className = 'tags';
    const add = (text, key) => {
      if (!text) return;
      const t = document.createElement('span');
      t.className = 'tag' + (key ? ' key' : '');
      t.textContent = text;
      tags.appendChild(t);
    };
    add(p.orbitType, true);
    add(p.altitudeBand);
    add(p.inclinationBand);
    add(p.massBand, true);
    add(p.formFactor);
    add(p.rideType);
    add(p.window, true);
    add(p.propulsion ? 'Propulsive' : 'Non-propulsive');

    left.append(head, tags);

    const actions = document.createElement('div');
    actions.className = 'row-actions';
    const interest = document.createElement('button');
    interest.className = 'ghost-sm';
    interest.textContent = 'Express interest';
    interest.disabled = true;
    interest.title = 'Introductions are not wired up yet';
    actions.appendChild(interest);

    el.append(left, actions);
    return el;
  }

  let timer;
  function scheduleLoad() {
    clearTimeout(timer);
    timer = setTimeout(load, 200);
  }

  async function load() {
    const { ok, data } = await api('/api/payloads?' + query());
    if (!ok) {
      banner.textContent = data.error ?? 'Could not load requirements.';
      banner.className = 'banner show bad';
      return;
    }
    const list = data.payloads;
    rows.textContent = '';
    list.forEach(p => rows.appendChild(card(p)));
    empty.hidden = list.length > 0;
    $('count').textContent = `${list.length} requirement${list.length === 1 ? '' : 's'}`;
  }

  FILTERS.forEach(id => {
    $(id).addEventListener('change', scheduleLoad);
    $(id).addEventListener('input', scheduleLoad);
  });
  $('clear').addEventListener('click', () => {
    FILTERS.forEach(id => { $(id).value = ''; });
    load();
  });

  $('signout').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
    location.href = '/';
  });

  (async function init() {
    const [me, options] = await Promise.all([api('/api/me'), api('/api/options')]);
    if (!me.ok) return;

    $('whoami').textContent = `${me.data.user.email} · ${me.data.user.accountTypeLabel}`;
    renderNav(me.data.user, 'payloads');

    const fill = (id, list) => { for (const o of list) $(id).add(new Option(o.label, o.value)); };
    fill('orbit', options.data.orbitTypes);
    fill('ride', options.data.rideTypes);
    fill('form', options.data.formFactors);

    load();
  })();
})();
