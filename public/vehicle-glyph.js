// A silhouette for the launch vehicle.
//
// Drawn here rather than sourced, so nothing depends on someone else's artwork
// and there is no trademark to misuse. They are deliberately generic: the shape
// says "small launcher" or "heavy lift", not "this exact rocket". Anything more
// specific would be a claim the drawing cannot honestly make.
//
// Size class is a property of the VEHICLE, not of the block on offer. A Falcon 9
// with 32 kg of spare ports is still heavy lift, and drawing it as a small
// launcher would be wrong in front of anyone who knows the hardware. Capacity is
// only the fallback for a vehicle this list has never heard of.
(function () {
  const svg = (paths, w, h) =>
    `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" fill="none"
       stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"
       stroke-linecap="round" aria-hidden="true">${paths}</svg>`;

  // Ogive nose, straight body, swept fins, bell nozzle — the parts that read as
  // a rocket at a glance. Height and width vary by class; everything else is
  // proportional to them so the three sizes look like the same family.
  const rocket = (h, w) => {
    const cx = 12;
    const hw = w / 2;
    const top = 21 - h;               // nose tip
    const shoulder = top + h * 0.34;  // where the nose meets the body
    const base = 18;                  // bottom of the barrel
    const finH = h * 0.26;
    const finW = w * 0.62;
    const nz = w * 0.3;

    return svg(`
      <path d="M${cx} ${top}
               C${cx + hw * 0.75} ${top + h * 0.14} ${cx + hw} ${shoulder - h * 0.08} ${cx + hw} ${shoulder}
               L${cx + hw} ${base}
               L${cx - hw} ${base}
               L${cx - hw} ${shoulder}
               C${cx - hw} ${shoulder - h * 0.08} ${cx - hw * 0.75} ${top + h * 0.14} ${cx} ${top} Z"/>
      <path d="M${cx - hw} ${base - finH} L${cx - hw - finW} ${base + 1.5} L${cx - hw} ${base} Z"/>
      <path d="M${cx + hw} ${base - finH} L${cx + hw + finW} ${base + 1.5} L${cx + hw} ${base} Z"/>
      <path d="M${cx - nz} ${base} L${cx - nz - 0.7} ${base + 2} L${cx + nz + 0.7} ${base + 2} L${cx + nz} ${base} Z"/>
    `, 24, 24);
  };

  // A tug is not a launcher — it rides up on someone else's rocket and moves
  // you afterwards, so it gets a bus with solar panels instead.
  const tug = () => svg(`
    <rect x="9" y="8" width="6" height="8" rx="1"/>
    <path d="M9 10.5H4.5v3H9M15 10.5h4.5v3H15"/>
    <path d="M12 16v2.5M10.6 18.5h2.8"/>
  `, 24, 24);

  const TUGS = /mira|vigoride|blue ring|helios|otv|orbital transfer/i;

  // Lift class of the real vehicles, keyed by the name as it is listed.
  const CLASS = new Map([
    ['falcon 9', 'heavy'], ['falcon heavy', 'heavy'], ['ariane 6', 'heavy'],
    ['new glenn', 'heavy'], ['h3', 'heavy'], ['lvm3 (gslv mk iii)', 'heavy'],
    ['long march series', 'heavy'], ['neutron', 'heavy'], ['terran r', 'heavy'],
    ['rocketco aurora', 'heavy'],

    ['pslv', 'medium'], ['vega-c', 'medium'], ['spectrum', 'medium'],
    ['alpha', 'medium'], ['rfa one', 'medium'], ['miura 5', 'medium'],
    ['eris block 1', 'medium'], ['kuaizhou-11', 'medium'], ['gslv mk ii', 'medium'],
    ['kslv-ii (nuri)', 'medium'], ['maia', 'medium'], ['kinetica 1 (lijian-1)', 'medium'],

    ['electron', 'small'], ['sslv', 'small'], ['vikram-1', 'small'],
    ['agnibaan', 'small'], ['hanbit-nano', 'small'], ['hanbit-micro', 'small'],
    ['hanbit-mini', 'small'], ['prime', 'small'], ['skyrora xl', 'small'],
    ['eris - 100kg', 'small'],
  ]);

  // Filled in from /api/options: vehicle slug -> image path. A real image beats
  // anything drawn here, so it wins whenever one has been dropped in.
  let images = {};
  window.setVehicleImages = map => { images = map ?? {}; };

  const slug = v => String(v ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  window.vehicleGlyph = function vehicleGlyph(vehicle, capacityKg) {
    const span = document.createElement('span');
    span.className = 'vehicle-glyph';

    const src = images[slug(vehicle)];
    if (src) {
      const img = document.createElement('img');
      img.src = src;
      img.alt = '';
      img.loading = 'lazy';
      span.classList.add('has-image');
      span.title = vehicle;
      span.append(img);
      return span;
    }

    if (TUGS.test(vehicle ?? '')) {
      span.innerHTML = tug();
      span.title = 'Orbital transfer vehicle';
      return span;
    }

    // vehicle first; capacity only decides for something not on the list
    let cls = CLASS.get(String(vehicle ?? '').trim().toLowerCase());
    if (!cls) {
      const kg = Number(capacityKg) || 0;
      cls = kg >= 2000 ? 'heavy' : kg >= 350 ? 'medium' : 'small';
    }

    if (cls === 'heavy')       { span.innerHTML = rocket(16, 7.6); span.title = 'Heavy lift'; }
    else if (cls === 'medium') { span.innerHTML = rocket(12.5, 5.6); span.title = 'Medium launcher'; }
    else                       { span.innerHTML = rocket(9.5, 4);   span.title = 'Small launcher'; }
    return span;
  };
})();
