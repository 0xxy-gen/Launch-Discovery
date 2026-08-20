// The mark beside a launch listing.
//
// A real logo is shown when the provider has uploaded one. Until then this
// draws a monogram rather than leaving a gap: we cannot ship other companies'
// trademarks with the app, and a marketplace that displayed them unasked would
// be implying a relationship that does not exist. Providers add their own on
// the profile page, and it appears here automatically.
//
// The name stays next to the mark. Falcon 9 and Electron are recognisable from
// a logo alone; Perigee Aerospace and Rocket Factory Augsburg are not, and the
// long tail is most of the list.
(function () {
  // Deterministic hue per name, so a provider keeps the same colour everywhere
  // and two adjacent cards rarely collide.
  function hue(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
    return h;
  }

  function initials(name) {
    const words = name.split(/[\s/&-]+/).filter(Boolean);

    // An all-caps name is already an acronym — ISRO, KARI, CASC, MIRA.
    if (words.length === 1 && words[0] === words[0].toUpperCase()) return words[0].slice(0, 4);

    if (words.length === 1) {
      // One word, so look for a camel-case seam: SpaceX -> SX, MaiaSpace -> MS.
      const parts = words[0].match(/[A-Z][a-z0-9]*/g);
      if (parts && parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
      return words[0].slice(0, 2).toUpperCase();
    }
    return words.slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  window.providerBadge = function providerBadge(name, logo) {
    const badge = document.createElement('span');
    badge.className = 'provider-badge';

    if (logo) {
      const img = document.createElement('img');
      img.src = logo;
      img.alt = '';               // the name sits beside it, so this is decorative
      badge.append(img);
      return badge;
    }

    const label = name || '?';
    badge.textContent = initials(label);
    badge.style.background = `hsl(${hue(label)} 62% 88%)`;
    badge.style.color = `hsl(${hue(label)} 70% 26%)`;
    badge.title = label;
    return badge;
  };
})();
