(function () {
  const $ = id => document.getElementById(id);
  let me = null, threads = [], filter = 'all', current = null, query = '';

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

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  // same clock a chat app uses: time today, weekday this week, date beyond
  function when(iso) {
    if (!iso) return '';
    const then = new Date(iso), now = new Date();
    const sameDay = then.toDateString() === now.toDateString();
    if (sameDay) return then.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (now - then < 6 * 864e5) return then.toLocaleDateString([], { weekday: 'short' });
    return then.toLocaleDateString([], { day: 'numeric', month: 'short' });
  }

  const ORBIT_GLYPH =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.4">' +
    '<circle cx="12" cy="12" r="4.5"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-30 12 12)"/></svg>';

  const BELL_GLYPH =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.4">' +
    '<path d="M18 8a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7"/><path d="M10.5 20a2 2 0 0 0 3 0"/></svg>';

  function threadRow(t) {
    const row = el('button', 'thread' + (current === t.id ? ' current' : ''));
    row.type = 'button';

    const glyph = el('div', 'thread-glyph');
    glyph.innerHTML = t.kind === 'alerts' ? BELL_GLYPH : ORBIT_GLYPH;
    row.append(glyph);

    row.append(highlight(el('div', 'thread-context'), t.context));
    if (t.unread) row.append(el('span', 'thread-dot'));

    row.append(highlight(el('div', 'thread-name'), t.name));

    const last = t.last
      ? `${t.last.mine ? 'You' : t.last.organisation}: ${t.last.body}`
      : `${t.members} member${t.members === 1 ? '' : 's'} · no messages yet`;
    row.append(highlight(el('div', 'thread-last'), last));
    row.append(el('div', 'thread-time', when(t.last?.at)));

    row.addEventListener('click', () => openThread(t));
    return row;
  }

  const matches = t => {
    if (!query) return true;
    const q = query.toLowerCase();
    return t.name.toLowerCase().includes(q)
      || t.context.toLowerCase().includes(q)
      || (t.last?.body ?? '').toLowerCase().includes(q)
      || (t.last?.organisation ?? '').toLowerCase().includes(q);
  };

  // highlight the matched run rather than leaving the reader to find it
  function highlight(node, text) {
    node.textContent = '';
    const q = query.toLowerCase();
    const at = q ? text.toLowerCase().indexOf(q) : -1;
    if (at === -1) { node.textContent = text; return node; }
    node.append(document.createTextNode(text.slice(0, at)));
    const mark = document.createElement('mark');
    mark.textContent = text.slice(at, at + q.length);
    node.append(mark, document.createTextNode(text.slice(at + q.length)));
    return node;
  }

  function renderThreads() {
    const host = $('threads');
    host.textContent = '';
    const shown = threads.filter(t => (filter === 'unread' ? t.unread : true)).filter(matches);

    if (!shown.length) {
      host.append(el('p', 'thread-none',
        query ? `Nothing matches “${query}”.`
        : filter === 'unread' ? 'Nothing unread.'
        : 'No conversations yet. Join a pool and its group chat appears here.'));
      return;
    }
    shown.forEach(t => host.append(threadRow(t)));
  }

  async function renderDetail(threadId) {
    const pane = $('detail');
    const { ok, data } = await api(`/api/threads/${threadId}/detail`);
    if (!ok) return;
    const pool = data.pool;

    pane.textContent = '';

    const hero = el('div', 'detail-hero');
    const glyph = el('div', 'detail-glyph');
    glyph.innerHTML = ORBIT_GLYPH;
    const heroText = el('div');
    heroText.append(el('div', 'detail-orbit', pool.orbitType));
    heroText.append(el('div', 'detail-where',
      `${pool.altitudeKm} km · ${pool.inclinationDeg}° · ${pool.windowMonth}`));
    hero.append(glyph, heroText);
    pane.append(hero);

    const totals = el('div', 'detail-section');
    totals.append(el('h3', undefined, 'This group'));
    const row = (label, value) => {
      const r = el('div', 'detail-row');
      r.append(el('span', undefined, label), el('b', undefined, value));
      return r;
    };
    totals.append(row('Members', String(pool.memberCount)));
    totals.append(row('Combined mass', `${pool.totalMassKg} kg`));
    totals.append(row('Jurisdictions', pool.jurisdictions.join(', ') || '—'));
    if (pool.isLead) totals.append(row('Your role', 'Started this group'));
    pane.append(totals);

    const members = el('div', 'detail-section');
    members.append(el('h3', undefined, 'Who is in it'));
    for (const m of pool.members) {
      const card = el('div', 'member');
      const top = el('div', 'member-top');
      const org = el('div', 'member-org');
      org.textContent = m.organisation || 'Unnamed organisation';
      if (m.isYou) org.append(el('span', 'member-you', 'You'));
      top.append(org, el('span', 'member-country', m.country || ''));
      card.append(top);
      card.append(el('div', 'member-figures',
        `${m.payloadMassKg} kg · ${m.altitudeKm} km · ${m.inclinationDeg}° · ${m.windowMonth}`));
      members.append(card);
    }
    pane.append(members);

    const actions = el('div', 'detail-actions');
    const go = el('a', 'go', 'Open in Aether Pooling');
    go.href = '/pooling';
    actions.append(go);

    const leave = el('button', 'leave', 'Leave this group');
    leave.type = 'button';
    leave.addEventListener('click', async () => {
      const sure = await confirmPublish({
        title: `Leave ${pool.name}?`,
        lead: 'You stop seeing the group chat and the other members stop seeing your figures.',
        audience: 'What happens',
        visible: [
          'Your satellite is removed from the group',
          'The conversation disappears from your inbox',
          'Your satellite stays published and stays yours',
        ],
        action: 'Leave',
      });
      if (!sure) return;
      const res = await api(`/api/pools/${pool.id}/leave`, { method: 'POST', body: {} });
      if (!res.ok) return;
      current = null;
      $('detail').textContent = '';
      $('detail').append(el('p', 'detail-empty', 'You left the group.'));
      await load();
      location.reload();
    });
    actions.append(leave);
    pane.append(actions);
  }

  // Alerts arrive in the inbox but are not a conversation — there is nobody on
  // the other end — so the thread reads as a list of matches with a way through
  // to each launch, and carries no composer.
  async function openAlerts(t) {
    current = t.id;
    renderThreads();

    const pane = $('pane');
    pane.textContent = '';

    const head = el('div', 'thread-head');
    head.append(el('h2', undefined, 'Launch alerts'));
    head.append(el('p', undefined, 'Sent when a published launch matches one of your satellites.'));
    pane.append(head);

    const list = el('div', 'messages');
    pane.append(list);

    const { ok, data } = await api('/api/threads/alerts/detail');
    if (!ok) return;

    // The right column normally explains the pool. Here it explains which
    // satellites are being watched and how much each has attracted.
    const pane2 = $('detail');
    pane2.textContent = '';
    const counts = new Map();
    for (const h of data.hits) counts.set(h.missionRef, (counts.get(h.missionRef) ?? 0) + 1);

    const section = el('div', 'detail-section');
    section.append(el('h3', undefined, 'Watching'));
    for (const [ref, n] of counts) {
      const r = el('div', 'detail-row');
      r.append(el('span', undefined, ref));
      r.append(el('strong', undefined, `${n} match${n === 1 ? '' : 'es'}`));
      section.append(r);
    }
    pane2.append(section);

    const hint = el('p', 'detail-empty',
      'Alerts follow each satellite. Turn them on or off from My Missions.');
    pane2.append(hint);

    for (const h of data.hits) {
      const msg = el('div', 'msg alert-msg');
      msg.append(el('div', 'msg-who', `Aether · ${when(h.at)}`));

      const body = el('div', 'msg-body');
      body.append(el('div', 'alert-lead',
        `${h.launch} can fly ${h.missionRef}.`));

      const facts = el('div', 'alert-facts');
      [
        `${h.provider}${h.providerCountry ? ' · ' + h.providerCountry : ''}`,
        h.vehicle,
        `${h.orbitType.toUpperCase()} · ${h.altitudeKm} km · ${h.inclinationDeg}°`,
        h.windowMonth,
        `${h.spareKg} kg spare (you need ${h.massKg} kg)`,
      ].filter(Boolean).forEach(f => facts.append(el('span', undefined, f)));
      body.append(facts);

      const go = el('a', 'ghost-sm alert-go', 'View launch');
      go.href = `/launches?launch=${h.launchId}`;
      body.append(go);

      msg.append(body);
      list.append(msg);
    }

    // reading clears the badge, so refresh the counts the nav is showing
    load();
  }

  async function openThread(t) {
    if (t.kind === 'alerts') return openAlerts(t);
    current = t.id;
    renderThreads();

    const pane = $('pane');
    pane.textContent = '';

    const head = el('div', 'thread-head');
    head.append(el('h2', undefined, t.name));
    head.append(el('p', undefined, `${t.context} · ${t.members} member${t.members === 1 ? '' : 's'}`));
    pane.append(head);

    const list = el('div', 'messages');
    pane.append(list);

    const composer = el('form', 'composer');
    const box = document.createElement('textarea');
    box.placeholder = 'Message the group…';
    box.rows = 1;
    const send = el('button', 'primary', 'Send');
    send.type = 'submit';
    composer.append(box, send);
    pane.append(composer);

    renderDetail(t.id);

    const { ok, data } = await api(`/api/threads/${t.id}`);
    if (ok) {
      if (!data.messages.length) {
        const none = el('p', 'thread-context');
        none.textContent = 'No messages yet — say what you are flying and when.';
        list.append(none);
      }
      data.messages.forEach(m => {
        const msg = el('div', 'msg' + (m.mine ? ' mine' : ''));
        msg.append(el('div', 'msg-who',
          `${m.mine ? 'You' : m.organisation}${m.author ? ' · ' + m.author : ''} · ${when(m.at)}`));
        msg.append(el('div', 'msg-body', m.body));
        list.append(msg);
      });
      list.scrollTop = list.scrollHeight;
    }

    composer.addEventListener('submit', async e => {
      e.preventDefault();
      const body = box.value.trim();
      if (!body) return;
      box.value = '';
      const res = await api(`/api/threads/${t.id}`, { method: 'POST', body: { body } });
      if (!res.ok) return;
      await load();
      openThread(threads.find(x => x.id === t.id) ?? t);
    });

    // Enter sends, Shift+Enter makes a new line
    box.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        composer.requestSubmit();
      }
    });
    box.focus();
  }

  $('search').addEventListener('input', e => {
    query = e.target.value.trim();
    $('search-clear').hidden = !query;
    renderThreads();
  });
  $('search-clear').addEventListener('click', () => {
    $('search').value = '';
    query = '';
    $('search-clear').hidden = true;
    renderThreads();
    $('search').focus();
  });

  document.querySelectorAll('.pill-btn').forEach(button => {
    button.addEventListener('click', () => {
      filter = button.dataset.filter;
      document.querySelectorAll('.pill-btn').forEach(b => b.classList.toggle('on', b === button));
      renderThreads();
    });
  });

  async function load() {
    const { ok, data } = await api('/api/threads');
    if (!ok) return;
    threads = data.threads;
    renderThreads();

    const unread = data.unreadTotal;
    $('unread-line') && ($('unread-line').textContent =
      unread ? `You have ${unread} unread message${unread === 1 ? '' : 's'}` : 'You have no new messages');
  }

  (async function init() {
    const meRes = await api('/api/me');
    if (!meRes.ok) return;
    me = meRes.data.user;
    renderAccount(me);
    renderNav(me, 'messages');

    const first = (me.firstName || me.organisation || me.email.split('@')[0]);
    $('hello').innerHTML = `<span class="lite">Hello</span> <b>${''}</b>`;
    $('hello').lastElementChild.textContent = first;

    await load();
  })();
})();
