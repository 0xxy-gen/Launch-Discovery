(function () {
  const STEPS = [
    ['A provider expresses interest',
     'They see your banded satellite on the Payloads tab and ask to be introduced. You see the request without either side being named.'],
    ['You accept, or you do not',
     'Accepting is what reveals identities and exact figures — in both directions at once. Declining reveals nothing, and they are not told who declined.'],
    ['The conversation opens here',
     'Only after both sides have agreed. Documents and commercial terms never appear in the browse listings at all.'],
  ];

  async function api(path) {
    const res = await fetch(path, { credentials: 'same-origin' });
    if (res.status === 401) { location.href = '/'; throw new Error('signed out'); }
    return { ok: res.ok, data: await res.json().catch(() => ({})) };
  }

  (async function init() {
    const host = document.getElementById('steps');
    STEPS.forEach(([title, body], i) => {
      const step = document.createElement('div');
      step.className = 'step';

      const n = document.createElement('div');
      n.className = 'step-n';
      n.textContent = String(i + 1);

      const text = document.createElement('div');
      const h = document.createElement('h3');
      h.textContent = title;
      const p = document.createElement('p');
      p.textContent = body;
      text.append(h, p);

      step.append(n, text);
      host.append(step);
    });

    const me = await api('/api/me');
    if (!me.ok) return;
    renderAccount(me.data.user);
    renderNav(me.data.user, 'messages');
  })();
})();
