// Indicative $/kg bands by vehicle, for demo data only.
//
// Real launch pricing is negotiated per deal and almost never published, so
// nothing here came from a provider and none of it is a quote. The bands are
// set to the right order of magnitude — rideshare on a heavy vehicle costs a
// fraction of a dedicated small launcher, and a tug charges a premium for the
// last-mile transfer — so the sort ranks sensibly and the numbers do not
// insult anyone who prices launch for a living.
//
// A launch with no price is legitimate: "on request" is the honest state for
// most of the market, and the UI keeps it rather than inventing a figure.

const BANDS = new Map([
  // heavy lift, sold by the kilo as rideshare — the cheapest way up
  ['falcon 9',        [6000, 7500]],
  ['new glenn',       [3500, 5500]],
  ['ariane 6',        [5000, 9000]],
  ['h3',              [6000, 10000]],
  ['neutron',         [4500, 6500]],
  ['rocketco aurora', [6000, 9000]],

  // medium
  ['pslv',            [4000, 6000]],
  ['vega-c',          [8000, 12000]],
  ['spectrum',        [12000, 18000]],
  ['alpha',           [15000, 22000]],
  ['rfa one',         [10000, 15000]],
  ['miura 5',         [15000, 22000]],
  ['eris block 1',    [18000, 28000]],
  ['kuaizhou-11',     [8000, 14000]],
  ['kslv-ii (nuri)',  [10000, 16000]],
  ['maia',            [12000, 18000]],

  // small and dedicated — you pay for the whole vehicle whether you fill it
  ['electron',        [30000, 45000]],
  ['sslv',            [8000, 12000]],
  ['vikram-1',        [12000, 18000]],
  ['agnibaan',        [20000, 30000]],
  ['hanbit-nano',     [25000, 35000]],
  ['prime',           [25000, 35000]],
  ['skyrora xl',      [20000, 30000]],

  // transfer vehicles: the ride up plus the plane change afterwards
  ['mira',            [25000, 40000]],
  ['vigoride',        [25000, 40000]],
]);

// A broker carries the integration, paperwork and risk, and prices accordingly.
const BROKER_MARKUP = 1.2;

const key = v => String(v ?? '').trim().toLowerCase();

/** Returns [low, high] in $/kg, or null when the vehicle is not in the table. */
export function priceFor(vehicle, { broker = false } = {}) {
  const band = BANDS.get(key(vehicle));
  if (!band) return null;
  const m = broker ? BROKER_MARKUP : 1;
  return [Math.round(band[0] * m / 100) * 100, Math.round(band[1] * m / 100) * 100];
}

export const PRICE_VEHICLES = [...BANDS.keys()];
