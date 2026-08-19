(function () {
  const $ = id => document.getElementById(id);
  const listView = $('list-view'), editorView = $('editor-view');
  const form = $('launch-form'), rows = $('rows'), empty = $('empty'), banner = $('banner');

  const FIELDS = ['name', 'vehicle', 'site', 'orbitType', 'altitudeKm', 'inclinationDeg',
                  'windowMonth', 'capacityKg', 'committedKg', 'notes'];

  let editingId = null;
  let busy = false;

  async function api(path, { method = 'GET', body } = {}) {
    const res = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
    if (res.status === 401) { location.href = '/'; throw new Error('signed out'); }
    return { ok: res.ok, status: res.status, data: res.status === 204 ? {} : await res.json().catch(() => ({})) };
  }

  function showBanner(msg, kind) {
    banner.textContent = msg;
    banner.className = 'banner show ' + kind;
    if (kind === 'ok') setTimeout(() => { banner.className = 'banner'; }, 4000);
  }
  const setError = (id, msg) => {
    $(id + '-err').textContent = msg || '';
    $(id).setAttribute('aria-invalid', msg ? 'true' : 'false');
  };
  const clearErrors = () => FIELDS.forEach(id => setError(id, ''));

  const readForm = () => ({
    name: $('name').value, vehicle: $('vehicle').value, site: $('site').value,
    orbitType: $('orbitType').value, altitudeKm: $('altitudeKm').value,
    inclinationDeg: $('inclinationDeg').value, windowMonth: $('windowMonth').value,
    capacityKg: $('capacityKg').value, committedKg: $('committedKg').value,
    notes: $('notes').value,
  });

  function fillForm(l) {
    $('name').value = l?.name ?? '';
    $('vehicle').value = l?.vehicle ?? '';
    $('site').value = l?.site ?? '';
    $('orbitType').value = l?.orbitTypeValue ?? '';
    $('altitudeKm').value = l?.altitudeKm ?? '';
    $('inclinationDeg').value = l?.inclinationDeg ?? '';
    $('windowMonth').value = l?.windowMonth ?? '';
    $('capacityKg').value = l?.capacityKg ?? '';
    $('committedKg').value = l?.committedKg ?? '';
    $('notes').value = l?.notes ?? '';
  }

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  function renderList(launches) {
    rows.textContent = '';
    empty.hidden = launches.length > 0;

    const live = launches.filter(l => l.status === 'published').length;
    $('list-lede').textContent = launches.length
      ? `${launches.length} launch${launches.length === 1 ? '' : 'es'} · ${live} visible to payload owners`
      : 'List a flight with spare capacity and payload owners can find it.';

    for (const l of launches) {
      const card = el('div', 'row-card');
      const left = el('div');

      const title = el('div', 'row-title');
      title.append(el('h2', null, l.name));
      title.append(el('span', 'pill ' + l.status, l.status === 'published' ? 'Published' : 'Draft'));
      left.append(title);

      const facts = el('div', 'facts');
      [l.vehicle, l.site, l.orbitType, `${l.altitudeKm} km`, `${l.inclinationDeg}°`, l.windowMonth]
        .filter(Boolean).forEach(f => facts.append(el('span', null, f)));
      left.append(facts);

      const pct = Math.min(100, Math.round((l.committedKg / l.capacityKg) * 100));
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
      left.append(meter);

      const actions = el('div', 'row-actions');
      const toggle = el('button', 'ghost-sm', l.status === 'published' ? 'Unpublish' : 'Publish');
      toggle.addEventListener('click', () => setStatus(l.id, l.status === 'published' ? 'draft' : 'published'));
      const edit = el('button', 'ghost-sm', 'Edit');
      edit.addEventListener('click', () => openEditor(l));
      actions.append(toggle, edit);

      card.append(left, actions);
      rows.append(card);
    }
  }

  async function loadList() {
    const { ok, data } = await api('/api/my-launches');
    if (ok) renderList(data.launches);
  }

  async function setStatus(id, status) {
    const { ok, data } = await api(`/api/my-launches/${id}/status`, { method: 'POST', body: { status } });
    if (!ok) return showBanner(data.error ?? 'Could not change that.', 'bad');
    showBanner(status === 'published' ? 'Launch published' : 'Launch hidden', 'ok');
    loadList();
  }

  function showList() {
    editorView.hidden = true;
    listView.hidden = false;
    banner.className = 'banner';
    loadList();
  }

  function openEditor(launch) {
    editingId = launch?.id ?? null;
    clearErrors();
    fillForm(launch);
    $('editor-eyebrow').textContent = launch ? 'Edit launch' : 'New launch';
    $('save-publish').textContent = launch?.status === 'published' ? 'Save changes' : 'Publish';
    $('delete').hidden = !launch;
    listView.hidden = true;
    editorView.hidden = false;
    window.scrollTo(0, 0);
  }

  async function save(publish) {
    if (busy) return;
    busy = true;
    clearErrors();

    const body = { ...readForm(), publish };
    const res = editingId
      ? await api(`/api/my-launches/${editingId}`, { method: 'PUT', body })
      : await api('/api/my-launches', { method: 'POST', body });
    busy = false;

    if (!res.ok) {
      if (res.data.fields) {
        for (const [id, msg] of Object.entries(res.data.fields)) if ($(id)) setError(id, msg);
        return showBanner('Check the highlighted fields.', 'bad');
      }
      return showBanner(res.data.error ?? 'Could not save that.', 'bad');
    }

    const saved = res.data.launch;
    if (publish && saved.status !== 'published') {
      await api(`/api/my-launches/${saved.id}/status`, { method: 'POST', body: { status: 'published' } });
    }
    showBanner(publish ? 'Launch published' : 'Saved as a draft', 'ok');
    showList();
  }

  form.addEventListener('submit', e => { e.preventDefault(); save(true); });
  $('save-draft').addEventListener('click', () => save(false));
  $('delete').addEventListener('click', async () => {
    if (!editingId) return;
    const { ok } = await api(`/api/my-launches/${editingId}`, { method: 'DELETE' });
    if (ok) { showBanner('Launch deleted', 'ok'); showList(); }
  });
  $('new-launch').addEventListener('click', () => openEditor(null));
  $('empty-cta').addEventListener('click', () => openEditor(null));
  $('cancel').addEventListener('click', showList);
  FIELDS.forEach(id => $(id).addEventListener('input', () => setError(id, '')));

  $('signout').addEventListener('click', async () => {
    await api('/api/logout', { method: 'POST' }).catch(() => {});
    location.href = '/';
  });

  (async function init() {
    const [me, options] = await Promise.all([api('/api/me'), api('/api/options')]);
    if (!me.ok) return;
    $('whoami').textContent = `${me.data.user.email} · ${me.data.user.accountTypeLabel}`;
    renderNav(me.data.user, 'my-launches');
    for (const o of options.data.orbitTypes) $('orbitType').add(new Option(o.label, o.value));
    showList();
  })();
})();
