(function () {
  const $ = id => document.getElementById(id);

  const PLANNED = [
    {
      icon: 'M3 10.5l4 4 8-9',
      title: 'Watch for capacity that fits',
      body: 'Re-check every new launch against your missions on the orbit, window and spare-mass rules the Launches page already applies, and tell you when one lands.',
    },
    {
      icon: 'M9 2.5v13M2.5 9h13',
      title: 'Find pool partners',
      body: 'Notice when somebody else publishes a requirement compatible with yours, and suggest opening a pool before either of you has committed to a provider.',
    },
    {
      icon: 'M2.5 9h13M9 2.5l6.5 6.5L9 15.5',
      title: 'Track a manifest filling up',
      body: 'Follow the launches you are interested in and flag when spare capacity drops below what your payload needs, while there is still time to move.',
    },
    {
      icon: 'M9 5.5v4.5M9 13h.01M9 1.5l7.5 13h-15z',
      title: 'Flag schedule risk',
      body: 'Watch for a launch slipping past your window, or a pool that has stopped growing, and say so rather than leaving you to notice.',
    },
  ];

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

  function showBanner(msg, kind) {
    const banner = $('banner');
    banner.textContent = msg;
    banner.className = 'banner show ' + kind;
    if (kind === 'ok') setTimeout(() => { banner.className = 'banner'; }, 4000);
  }

  function renderPlanned() {
    const host = $('planned');
    for (const item of PLANNED) {
      const row = document.createElement('div');
      row.className = 'planned-item';

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 18 18');
      svg.setAttribute('width', '18');
      svg.setAttribute('height', '18');
      svg.setAttribute('fill', 'none');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', item.icon);
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.6');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      svg.append(path);

      const text = document.createElement('div');
      const h = document.createElement('h3');
      h.textContent = item.title;
      const p = document.createElement('p');
      p.textContent = item.body;
      text.append(h, p);

      row.append(svg, text);
      host.append(row);
    }
  }

  function paint(state) {
    $('join-view').hidden = state.joined;
    $('joined-view').hidden = !state.joined;
    if (!state.joined) return;

    $('joined-when').textContent = state.joinedAt
      ? `Requested ${new Date(state.joinedAt).toLocaleDateString()}`
      : '';
    $('joined-note').hidden = !state.note;
    $('joined-note').textContent = state.note;
  }

  $('waitlist-form').addEventListener('submit', async e => {
    e.preventDefault();
    $('note-err').textContent = '';

    const { ok, data } = await api('/api/waitlist', { method: 'POST', body: { note: $('note').value } });
    if (!ok) {
      if (data.fields?.note) $('note-err').textContent = data.fields.note;
      return showBanner(data.error ?? 'Could not add you.', 'bad');
    }
    showBanner('You are on the waitlist', 'ok');
    paint({ joined: true, note: data.note, joinedAt: new Date().toISOString() });
  });

  $('leave').addEventListener('click', async () => {
    const { ok } = await api('/api/waitlist', { method: 'DELETE' });
    if (!ok) return;
    $('note').value = '';
    paint({ joined: false });
    showBanner('Removed from the waitlist', 'ok');
  });

  (async function init() {
    renderPlanned();
    const [me, state] = await Promise.all([api('/api/me'), api('/api/waitlist')]);
    if (!me.ok) return;
    renderAccount(me.data.user);
    renderNav(me.data.user, 'agents');
    paint(state.data);
  })();
})();
