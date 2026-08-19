(function () {
  const $ = id => document.getElementById(id);
  const listView = $('list-view'), createView = $('create-view');
  const rows = $('rows'), empty = $('empty'), banner = $('banner');

  let missions = [];

  async function api(path, { method = 'GET', body } = {}) {
    const res = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
    if (res.status === 401) { location.href = '/'; throw new Error('signed out'); }
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
  }

  function showBanner(msg, kind) {
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

  function poolCard(pool) {
    const card = el('div', 'pool-card' + (pool.isMember ? ' mine' : ''));

    const head = el('div', 'pool-head');
    const left = el('div');
    left.append(el('h2', null, pool.name));
    left.append(el('p', 'pool-target',
      `${pool.orbitType} · ${pool.altitudeKm} km · ${pool.inclinationDeg}° · ${pool.windowMonth}`));
    head.append(left);
    if (pool.isMember) head.append(el('span', 'pill published', pool.isLead ? 'Your pool' : 'Joined'));
    card.append(head);

    // running total
    const pct = Math.min(100, Math.round((pool.totalMassKg / pool.capacityKg) * 100));
    const meter = el('div', 'meter');
    const track = el('div', 'meter-track');
    const fill = el('div', 'meter-fill');
    fill.style.width = pct + '%';
    track.append(fill);
    const legend = el('div', 'meter-legend');
    const left2 = el('span');
    left2.append(el('b', null, `${pool.totalMassKg} kg`),
                 document.createTextNode(` of ${pool.capacityKg} kg`));
    legend.append(left2, el('span', null,
      `${pool.memberCount} member${pool.memberCount === 1 ? '' : 's'}`));
    meter.append(track, legend);
    card.append(meter);

    if (pool.jurisdictions.length) {
      const jur = el('div', 'jurisdictions');
      jur.append(el('span', 'jur-label', 'Jurisdictions'));
      pool.jurisdictions.forEach(c => jur.append(el('span', 'tag', c)));
      card.append(jur);
    }

    // members, visible only from inside
    if (pool.members) {
      const list = el('div', 'members');
      for (const m of pool.members) {
        const row = el('div', 'member');
        const who = el('div');
        who.append(el('b', null, m.organisation || 'Unnamed organisation'));
        if (m.isYou) who.append(el('span', 'you', 'You'));
        const figures = el('div', 'figures',
          `${m.payloadMassKg} kg · ${m.altitudeKm} km · ${m.inclinationDeg}° · ${m.windowMonth}`);
        row.append(who, el('div', 'figures', m.country), figures);
        list.append(row);
      }
      card.append(list);
    }

    // join / leave
    const actions = el('div', 'join-row');
    if (pool.isMember) {
      const leave = el('button', 'ghost-sm', 'Leave pool');
      leave.addEventListener('click', async () => {
        const { ok } = await api(`/api/pools/${pool.id}/leave`, { method: 'POST', body: {} });
        if (ok) { showBanner('You left the pool', 'ok'); load(); }
      });
      actions.append(leave);
    } else {
      const eligible = pool.candidates.filter(c => c.ok);
      if (eligible.length) {
        const select = el('select');
        eligible.forEach(c => select.add(new Option(c.reference, c.id)));
        const join = el('button', 'ghost-sm', 'Join with this mission');
        join.addEventListener('click', async () => {
          const { ok, data } = await api(`/api/pools/${pool.id}/join`,
            { method: 'POST', body: { missionId: Number(select.value) } });
          if (!ok) return showBanner(data.error ?? 'Could not join.', 'bad');
          showBanner('Joined the pool', 'ok');
          load();
        });
        actions.append(select, join);
      } else {
        // say why, rather than just greying a button out
        const why = el('div', 'why');
        if (!pool.candidates.length) {
          why.textContent = 'Describe a mission first and it will show up here if it fits.';
        } else {
          why.append(el('b', null, 'None of your missions fit this pool. '));
          why.append(document.createTextNode(
            pool.candidates.map(c => `${c.reference}: ${c.reasons[0]}`).join(' · ')));
        }
        card.append(why);
      }
    }
    if (actions.childNodes.length) card.append(actions);

    return card;
  }

  async function load() {
    const { ok, data } = await api('/api/pools');
    if (!ok) return showBanner(data.error ?? 'Could not load pools.', 'bad');

    missions = data.missions;
    rows.textContent = '';
    data.pools.forEach(p => rows.append(poolCard(p)));
    empty.hidden = data.pools.length > 0;

    $('missionId').textContent = '';
    $('missionId').add(new Option('Choose one of your missions', ''));
    missions.forEach(m => $('missionId').add(new Option(m.reference, m.id)));
  }

  function showList() { createView.hidden = true; listView.hidden = false; load(); }
  function showCreate() {
    listView.hidden = true;
    createView.hidden = false;
    window.scrollTo(0, 0);
  }

  $('new-pool').addEventListener('click', showCreate);
  $('empty-cta').addEventListener('click', showCreate);
  $('cancel').addEventListener('click', showList);

  $('pool-form').addEventListener('submit', async e => {
    e.preventDefault();
    ['name', 'missionId', 'capacityKg'].forEach(id => { $(id + '-err').textContent = ''; });

    const body = {
      name: $('name').value,
      missionId: Number($('missionId').value),
      capacityKg: $('capacityKg').value,
    };
    const { ok, data } = await api('/api/pools', { method: 'POST', body });
    if (!ok) {
      for (const [id, msg] of Object.entries(data.fields ?? {})) {
        if ($(id + '-err')) $(id + '-err').textContent = msg;
      }
      return showBanner(data.error ?? 'Check the highlighted fields.', 'bad');
    }
    $('pool-form').reset();
    showBanner('Pool created — it is open for others to join', 'ok');
    showList();
  });


  (async function init() {
    const me = await api('/api/me');
    if (!me.ok) return;
    renderAccount(me.data.user);
    renderNav(me.data.user, 'pooling');
    showList();
  })();
})();
