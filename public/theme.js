// Loaded in <head> so the stored choice is applied before first paint —
// otherwise a light-mode user sees a black flash on every navigation.
(function () {
  const KEY = 'ld.theme';
  const root = document.documentElement;

  const system = () =>
    window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';

  const stored = () => {
    try { return localStorage.getItem(KEY); } catch { return null; }
  };

  function apply(theme) {
    if (theme === 'light') root.setAttribute('data-theme', 'light');
    else root.removeAttribute('data-theme');
  }

  // an explicit choice wins; otherwise follow the operating system
  apply(stored() ?? system());

  // and keep following it, for anyone who has not chosen
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', e => {
    if (!stored()) apply(e.matches ? 'light' : 'dark');
  });

  const SUN = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="8" cy="8" r="3.1"/><path d="M8 1v1.8M8 13.2V15M1 8h1.8M13.2 8H15M3.05 3.05l1.27 1.27M11.68 11.68l1.27 1.27M3.05 12.95l1.27-1.27M11.68 4.32l1.27-1.27"/></svg>';
  const MOON = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M13.5 9.6A5.8 5.8 0 016.4 2.5a5.9 5.9 0 107.1 7.1z"/></svg>';

  function mount() {
    if (document.getElementById('theme-toggle')) return;

    const button = document.createElement('button');
    button.id = 'theme-toggle';
    button.className = 'theme-toggle';
    button.type = 'button';

    const label = document.createElement('span');
    button.append(label);

    const paint = () => {
      const light = root.getAttribute('data-theme') === 'light';
      // the button offers the other mode, so it shows that one's icon
      button.innerHTML = light ? MOON : SUN;
      button.append(document.createTextNode(light ? 'Dark' : 'Light'));
      button.setAttribute('aria-label', `Switch to ${light ? 'dark' : 'light'} mode`);
      button.setAttribute('title', `Switch to ${light ? 'dark' : 'light'} mode`);
    };

    button.addEventListener('click', () => {
      const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      apply(next);
      try { localStorage.setItem(KEY, next); } catch { /* private mode */ }
      paint();
    });

    paint();
    document.body.appendChild(button);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
