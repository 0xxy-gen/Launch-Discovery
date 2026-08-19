// A publish confirmation that lists the actual values about to become visible,
// rather than asking "are you sure?" about nothing in particular.
window.confirmPublish = function confirmPublish({ title, lead, visible, hidden, audience, action }) {
  return new Promise(resolve => {
    const back = document.createElement('div');
    back.className = 'modal-back';

    const box = document.createElement('div');
    box.className = 'modal';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');

    const h = document.createElement('h2');
    h.textContent = title;
    box.append(h);

    const p = document.createElement('p');
    p.className = 'modal-lead';
    p.textContent = lead;
    box.append(p);

    const seen = document.createElement('div');
    seen.className = 'modal-panel';
    const seenHead = document.createElement('p');
    seenHead.className = 'modal-head';
    seenHead.textContent = audience;
    seen.append(seenHead);
    const list = document.createElement('ul');
    visible.filter(Boolean).forEach(v => {
      const li = document.createElement('li');
      li.textContent = v;
      list.append(li);
    });
    seen.append(list);
    box.append(seen);

    if (hidden?.length) {
      const kept = document.createElement('div');
      kept.className = 'modal-panel kept';
      const keptHead = document.createElement('p');
      keptHead.className = 'modal-head';
      keptHead.textContent = 'Stays private';
      kept.append(keptHead);
      const keptList = document.createElement('ul');
      hidden.forEach(v => {
        const li = document.createElement('li');
        li.textContent = v;
        keptList.append(li);
      });
      kept.append(keptList);
      box.append(kept);
    }

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const cancel = document.createElement('button');
    cancel.className = 'ghost-sm';
    cancel.type = 'button';
    cancel.textContent = 'Cancel';

    const go = document.createElement('button');
    go.className = 'primary';
    go.type = 'button';
    go.textContent = action ?? 'Publish';

    actions.append(cancel, go);
    box.append(actions);
    back.append(box);
    document.body.append(back);
    go.focus();

    const close = answer => {
      document.removeEventListener('keydown', onKey);
      back.remove();
      resolve(answer);
    };
    const onKey = e => { if (e.key === 'Escape') close(false); };

    cancel.addEventListener('click', () => close(false));
    go.addEventListener('click', () => close(true));
    back.addEventListener('click', e => { if (e.target === back) close(false); });
    document.addEventListener('keydown', onKey);
  });
};

// An in-page replacement for window.prompt, which is a native browser dialog:
// it looks nothing like the app and blocks the page while it is open.
window.promptDialog = function promptDialog({ title, lead, label, value = '', placeholder = '', action = 'Save' }) {
  return new Promise(resolve => {
    const back = document.createElement('div');
    back.className = 'modal-back';

    const box = document.createElement('form');
    box.className = 'modal';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');

    const h = document.createElement('h2');
    h.textContent = title;
    box.append(h);

    if (lead) {
      const p = document.createElement('p');
      p.className = 'modal-lead';
      p.textContent = lead;
      box.append(p);
    }

    const field = document.createElement('div');
    field.className = 'field';
    const lab = document.createElement('label');
    lab.textContent = label;
    lab.htmlFor = 'prompt-input';
    const input = document.createElement('input');
    input.id = 'prompt-input';
    input.type = 'text';
    input.value = value;
    input.placeholder = placeholder;
    input.autocomplete = 'off';
    field.append(lab, input);
    box.append(field);

    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const cancel = document.createElement('button');
    cancel.className = 'ghost-sm';
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    const go = document.createElement('button');
    go.className = 'primary';
    go.type = 'submit';
    go.textContent = action;
    actions.append(cancel, go);
    box.append(actions);

    back.append(box);
    document.body.append(back);
    input.focus();
    input.select();

    const close = answer => {
      document.removeEventListener('keydown', onKey);
      back.remove();
      resolve(answer);
    };
    const onKey = e => { if (e.key === 'Escape') close(null); };

    box.addEventListener('submit', e => {
      e.preventDefault();
      const trimmed = input.value.trim();
      close(trimmed || null);
    });
    cancel.addEventListener('click', () => close(null));
    back.addEventListener('click', e => { if (e.target === back) close(null); });
    document.addEventListener('keydown', onKey);
  });
};
