(function () {
  const $ = id => document.getElementById(id);

  const listView = $('list-view'), editorView = $('editor-view'), profileView = $('profile-view');
  const form = $('mission-form'), banner = $('banner');
  const rows = $('rows'), empty = $('empty');

  const FIELDS = ['constellationId', 'reference', 'orbitType', 'altitudeKm', 'inclinationDeg',
                  'payloadMassKg', 'formFactor', 'windowMonth', 'rideType', 'notes'];

  let constellations = [];
  let editingId = null;   // null while creating
  let busy = false;
  let me = null;
  let afterProfile = null;   // what to do once the profile is saved

  // ─── api ──────────────────────────────────────────────────────────────────

  async function api(path, { method = 'GET', body } = {}) {
    const res = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
    if (res.status === 401) { location.href = '/'; throw new Error('signed out'); }
    const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  function showBanner(msg, kind) {
    banner.textContent = msg;
    banner.className = 'banner show ' + kind;
    if (kind === 'ok') setTimeout(() => { banner.className = 'banner'; }, 4000);
  }
  const clearBanner = () => { banner.className = 'banner'; };

  const setError = (id, msg) => {
    $(id + '-err').textContent = msg || '';
    $(id).setAttribute('aria-invalid', msg ? 'true' : 'false');
  };
  const clearErrors = () => FIELDS.forEach(id => setError(id, ''));

  // ─── form <-> payload ─────────────────────────────────────────────────────

  function readForm() {
    return {
      constellationId: $('constellationId').value || null,
      reference: $('reference').value,
      orbitType: $('orbitType').value,
      altitudeKm: $('altitudeKm').value,
      inclinationDeg: $('inclinationDeg').value,
      payloadMassKg: $('payloadMassKg').value,
      formFactor: $('formFactor').value,
      windowMonth: $('windowMonth').value,
      rideType: $('rideType').value,
      propulsion: $('propulsion').checked,
      notes: $('notes').value,
    };
  }

  function fillForm(m) {
    $('constellationId').value = m?.constellationId ?? '';
    $('reference').value = m?.reference ?? '';
    $('orbitType').value = m?.orbitType ?? '';
    $('altitudeKm').value = m?.altitudeKm ?? '';
    $('inclinationDeg').value = m?.inclinationDeg ?? '';
    $('payloadMassKg').value = m?.payloadMassKg ?? '';
    $('formFactor').value = m?.formFactor ?? '';
    $('windowMonth').value = m?.windowMonth ?? '';
    $('rideType').value = m?.rideType ?? '';
    $('propulsion').checked = Boolean(m?.propulsion);
    $('notes').value = m?.notes ?? '';
  }

  // ─── live preview, computed server-side so it cannot drift ────────────────

  const blank = '—';
  function paintPreview(p) {
    const put = (id, value) => {
      const el = $(id);
      el.textContent = value ?? blank;
      el.classList.toggle('blank', !value);
    };
    $('p-ref').textContent = p.ref;
    $('p-jur').textContent = p.jurisdiction;
    put('p-orbit', p.orbitType);
    put('p-alt', p.altitudeBand);
    put('p-inc', p.inclinationBand);
    put('p-mass', p.massBand);
    put('p-form', p.formFactor);
    put('p-prop', p.propulsion ? 'Yes' : 'No');
    put('p-ride', p.rideType);
    put('p-window', p.window);
  }

  let previewTimer;
  function schedulePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(async () => {
      const { ok, data } = await api('/api/missions/preview', { method: 'POST', body: readForm() });
      if (ok) paintPreview(data.preview);
    }, 200);
  }

  // ─── list ─────────────────────────────────────────────────────────────────

  function factList(p) {
    return [
      p.orbitType, p.altitudeBand, p.inclinationBand,
      p.massBand, p.formFactor, p.rideType, p.window,
    ].filter(Boolean);
  }

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  function missionCard(m) {
    const card = el('div', 'row-card');
    const left = el('div');

    const title = el('div', 'row-title');
    title.append(el('h2', undefined, m.reference));
    const pill = el('span', 'pill ' + m.status,
      m.status === 'published' ? m.published.ref : 'Draft');
    title.append(pill);

    const facts = el('div', 'facts');
    for (const f of factList(m.published)) facts.append(el('span', undefined, f));

    left.append(title, facts);

    const actions = el('div', 'row-actions');
    const toggle = el('button', 'ghost-sm', m.status === 'published' ? 'Unpublish' : 'Publish');
    toggle.addEventListener('click', () => setStatus(m.id, m.status === 'published' ? 'draft' : 'published'));
    const copy = el('button', 'ghost-sm', 'Duplicate');
    copy.title = 'Create the next satellite from this one';
    copy.addEventListener('click', () => duplicate(m));
    const edit = el('button', 'ghost-sm', 'Edit');
    edit.addEventListener('click', () => openEditor(m));
    actions.append(toggle, copy, edit);

    card.append(left, actions);
    return card;
  }

  async function duplicate(m) {
    const { ok, data } = await api(`/api/missions/${m.id}/duplicate`, { method: 'POST', body: {} });
    if (!ok) return showBanner(data.error ?? 'Could not duplicate that.', 'bad');
    showBanner(`${data.mission.reference} created as a draft — rename it if you like`, 'ok');
    await loadList();
    openEditor(data.mission);
  }

  function summaryLine(s) {
    if (!s) return 'No missions yet';
    return [
      `${s.count} mission${s.count === 1 ? '' : 's'}`,
      `${s.totalMassKg} kg total`,
      s.altitude,
      s.inclination,
      s.window,
      `${s.published} published`,
    ].join(' · ');
  }

  function renderList(missions, groups) {
    rows.textContent = '';
    $('groups').textContent = '';
    empty.hidden = missions.length > 0 || groups.length > 0;

    const published = missions.filter(m => m.status === 'published').length;
    $('list-lede').textContent = missions.length
      ? `${missions.length} requirement${missions.length === 1 ? '' : 's'} · ${published} visible to providers`
      : 'Publish a requirement and providers can find it without learning who you are.';

    // one container per constellation, then whatever is not in one
    for (const group of groups) {
      const members = missions.filter(m => m.constellationId === group.id);
      const block = el('div', 'group');

      const head = el('div', 'group-head');
      const left = el('div');

      const title = el('div', 'group-title');
      const caret = el('span', 'caret');
      caret.innerHTML =
        '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6l5 5 5-5"/></svg>';
      title.append(caret, el('h2', undefined, group.name), el('span', 'group-kind', 'Constellation'));
      left.append(title);
      left.append(el('p', 'group-summary', summaryLine(group.summary)));
      head.append(left);

      const actions = el('div', 'group-actions');

      // The obvious next action inside a constellation is another satellite.
      if (members.length) {
        const add = el('button', 'ghost-sm', 'Add satellite');
        add.addEventListener('click', e => { e.stopPropagation(); duplicate(members.at(-1)); });
        actions.append(add);
      }

      const rename = el('button', 'ghost-sm', 'Rename');
      rename.addEventListener('click', async e => {
        e.stopPropagation();
        const name = prompt('Constellation name', group.name);
        if (!name || name.trim() === group.name) return;
        const { ok } = await api(`/api/constellations/${group.id}`,
          { method: 'PUT', body: { name: name.trim(), notes: group.notes } });
        if (ok) loadList();
      });

      const remove = el('button', 'ghost-sm', 'Ungroup');
      remove.title = 'Removes the grouping. The satellites stay.';
      remove.addEventListener('click', async e => {
        e.stopPropagation();
        const { ok } = await api(`/api/constellations/${group.id}`, { method: 'DELETE' });
        if (ok) { showBanner(`${group.name} ungrouped — its satellites are still here`, 'ok'); loadList(); }
      });

      actions.append(rename, remove);
      head.append(actions);

      const body = el('div', 'group-body');
      if (members.length) {
        members.forEach(m => body.append(missionCard(m)));
      } else {
        body.append(el('div', 'group-empty',
          'Nothing filed here yet — set the constellation on a requirement, or duplicate one into it.'));
      }

      head.addEventListener('click', () => block.classList.toggle('collapsed'));
      block.append(head, body);
      $('groups').append(block);
    }

    const loose = missions.filter(m => !m.constellationId);
    if (loose.length && groups.length) {
      $('groups').append(el('p', 'ungrouped-label', 'Not in a constellation'));
    }
    loose.forEach(m => rows.append(missionCard(m)));
  }

  async function loadList() {
    const { ok, data } = await api('/api/missions');
    if (!ok) return;

    constellations = data.constellations;
    const select = $('constellationId');
    select.textContent = '';
    select.add(new Option('Not part of one', ''));
    constellations.forEach(c => select.add(new Option(c.name, c.id)));

    renderList(data.missions, data.constellations);
  }

  async function setStatus(id, status) {
    const { ok, data } = await api(`/api/missions/${id}/status`, { method: 'POST', body: { status } });
    if (!ok) {
      if (data.needsProfile) return showProfile(() => setStatus(id, status));
      return showBanner(data.error ?? 'Could not change that.', 'bad');
    }
    showBanner(status === 'published' ? 'Requirement published' : 'Requirement hidden from providers', 'ok');
    loadList();
  }

  // ─── views ────────────────────────────────────────────────────────────────

  function showList() {
    editorView.hidden = true;
    profileView.hidden = true;
    listView.hidden = false;
    clearBanner();
    loadList();
  }

  // Asked for at the moment it matters, not at signup.
  function showProfile(next) {
    afterProfile = next ?? showList;
    $('organisation').value = me.organisation ?? '';
    $('role').value = me.role ?? '';
    $('country').value = me.country ?? '';
    $('linkedin').value = me.linkedin ?? '';
    $('dial').value = me.dial ?? '';
    $('phone').value = me.phone ?? '';
    $('profile-back').hidden = !me.profileComplete;
    listView.hidden = true;
    editorView.hidden = true;
    profileView.hidden = false;
    window.scrollTo(0, 0);
  }

  function openEditor(mission) {
    editingId = mission?.id ?? null;
    profileView.hidden = true;
    clearErrors();
    clearBanner();
    fillForm(mission);
    $('editor-eyebrow').textContent = mission ? 'Edit requirement' : 'New requirement';
    $('save-publish').textContent = mission?.status === 'published' ? 'Save changes' : 'Publish';
    $('delete').hidden = !mission;
    listView.hidden = true;
    editorView.hidden = false;
    window.scrollTo(0, 0);
    schedulePreview();
  }

  // ─── save ─────────────────────────────────────────────────────────────────

  async function save(publish) {
    if (busy) return;
    busy = true;
    clearErrors();
    clearBanner();

    const body = { ...readForm(), publish };
    pendingForm = readForm();
    const res = editingId
      ? await api(`/api/missions/${editingId}`, { method: 'PUT', body })
      : await api('/api/missions', { method: 'POST', body });
    busy = false;

    if (!res.ok) {
      if (res.data.fields) {
        for (const [id, msg] of Object.entries(res.data.fields)) if ($(id)) setError(id, msg);
        showBanner('Check the highlighted fields.', 'bad');
      } else if (res.data.needsProfile) {
        showProfile(() => { showBanner('Now publish your requirement.', 'ok'); openEditorAgain(); });
      } else {
        showBanner(res.data.error ?? 'Could not save that.', 'bad');
      }
      return;
    }

    const saved = res.data.mission;
    // An edit keeps whatever visibility it had; publishing is its own action.
    if (publish && saved.status !== 'published') {
      await api(`/api/missions/${saved.id}/status`, { method: 'POST', body: { status: 'published' } });
    }
    showBanner(publish ? 'Requirement published' : 'Saved as a draft', 'ok');
    showList();
  }

  form.addEventListener('submit', e => { e.preventDefault(); save(true); });
  $('save-draft').addEventListener('click', () => save(false));

  $('delete').addEventListener('click', async () => {
    if (!editingId) return;
    const { ok } = await api(`/api/missions/${editingId}`, { method: 'DELETE' });
    if (ok) { showBanner('Requirement deleted', 'ok'); showList(); }
  });

  $('new-constellation').addEventListener('click', async () => {
    const name = prompt('Name this constellation', '');
    if (!name || !name.trim()) return;
    const { ok, data } = await api('/api/constellations', { method: 'POST', body: { name: name.trim() } });
    if (!ok) return showBanner(data.fields?.['constellation-name'] ?? 'Could not create that.', 'bad');
    showBanner(`${data.constellation.name} created`, 'ok');
    loadList();
  });

  $('new-mission').addEventListener('click', () => openEditor(null));
  $('empty-cta').addEventListener('click', () => openEditor(null));
  $('cancel').addEventListener('click', showList);

  FIELDS.forEach(id => {
    $(id).addEventListener('input', () => { setError(id, ''); schedulePreview(); });
    $(id).addEventListener('change', schedulePreview);
  });
  $('propulsion').addEventListener('change', schedulePreview);

  // keeps whatever was typed, so a bounce through the profile loses nothing
  let pendingForm = null;
  function openEditorAgain() {
    openEditor(null);
    if (pendingForm) fillForm(pendingForm);
    schedulePreview();
  }

  $('profile-form').addEventListener('submit', async e => {
    e.preventDefault();
    ['organisation', 'role', 'country', 'linkedin', 'dial', 'phone'].forEach(id => setError(id, ''));

    const body = {
      organisation: $('organisation').value, role: $('role').value, country: $('country').value,
      linkedin: $('linkedin').value, dial: $('dial').value, phone: $('phone').value,
    };
    const { ok, data } = await api('/api/profile', { method: 'PUT', body });
    if (!ok) {
      for (const [id, msg] of Object.entries(data.fields ?? {})) if ($(id)) setError(id, msg);
      return showBanner('Check the highlighted fields.', 'bad');
    }
    me = data.user;
    const next = afterProfile ?? showList;
    afterProfile = null;
    next();
  });

  $('profile-back').addEventListener('click', showList);


  // ─── boot ─────────────────────────────────────────────────────────────────

  (async function init() {
    const [meRes, options] = await Promise.all([api('/api/me'), api('/api/options')]);
    if (!meRes.ok) return;

    me = meRes.data.user;
    renderAccount(me);
    renderNav(me, 'missions');

    const fill = (id, list) => {
      for (const o of list) $(id).add(new Option(o.label, o.value));
    };
    fill('orbitType', options.data.orbitTypes);
    fill('rideType', options.data.rideTypes);
    fill('formFactor', options.data.formFactors);
    for (const c of options.data.countries) {
      $('country').add(new Option(`${c.flag}  ${c.name}`, c.name));
      $('dial').add(new Option(`${c.flag}  ${c.dial} · ${c.name}`, c.dial));
    }

    showList();
  })();
})();
