(function () {
  const $ = id => document.getElementById(id);
  let me = null, threads = [], filter = 'all', current = null;

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

  function threadRow(t) {
    const row = el('button', 'thread' + (current === t.id ? ' current' : ''));
    row.type = 'button';

    const glyph = el('div', 'thread-glyph');
    glyph.innerHTML = ORBIT_GLYPH;
    row.append(glyph);

    row.append(el('div', 'thread-context', t.context));
    row.append(t.unread ? el('span', 'thread-dot') : el('span'));

    row.append(el('div', 'thread-name', t.name));
    row.append(el('span'));

    const last = t.last
      ? `${t.last.mine ? 'You' : t.last.organisation}: ${t.last.body}`
      : `${t.members} member${t.members === 1 ? '' : 's'} · no messages yet`;
    row.append(el('div', 'thread-last', last));
    row.append(el('div', 'thread-time', when(t.last?.at)));

    row.addEventListener('click', () => openThread(t));
    return row;
  }

  function renderThreads() {
    const host = $('threads');
    host.textContent = '';
    const shown = filter === 'unread' ? threads.filter(t => t.unread) : threads;

    if (!shown.length) {
      const empty = el('p', 'thread-context');
      empty.style.padding = '18px 12px';
      empty.textContent = filter === 'unread'
        ? 'Nothing unread.'
        : 'No conversations yet. Join a pool and its group chat appears here.';
      host.append(empty);
      return;
    }
    shown.forEach(t => host.append(threadRow(t)));
  }

  async function openThread(t) {
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
