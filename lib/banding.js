// Exact values are fingerprints. "180 kg to 550 km SSO in March 2027" names a
// specific company to anyone in the industry, and tells a provider exactly how
// to price it. Bands keep a requirement searchable without identifying it.
//
// The private numbers never leave the server unless the owner is asking for
// their own record, or a match has been accepted.

import { orbitLabel, rideLabel, formLabel } from './mission-options.js';

const MASS_BANDS = [
  { under: 10,   label: 'Under 10 kg' },
  { under: 50,   label: '10–50 kg' },
  { under: 100,  label: '50–100 kg' },
  { under: 250,  label: '100–250 kg' },
  { under: 500,  label: '250–500 kg' },
  { under: 1000, label: '500–1000 kg' },
  { under: 2500, label: '1000–2500 kg' },
];

export function massBand(kg) {
  const band = MASS_BANDS.find(b => kg < b.under);
  return band ? band.label : 'Over 2500 kg';
}

// 100 km buckets — fine enough to match against, coarse enough that a specific
// mission profile does not fall out of it.
export function altitudeBand(km) {
  const low = Math.floor(km / 100) * 100;
  return `${low}–${low + 100} km`;
}

// 5° buckets. SSO inclinations cluster tightly around 97–99°, so anything
// narrower would be the same as publishing the exact value.
export function inclinationBand(deg) {
  const low = Math.floor(deg / 5) * 5;
  return `${low}–${low + 5}°`;
}

// A month is enough to identify a campaign; a quarter is enough to plan around.
export function windowQuarter(yyyymm) {
  const [year, month] = String(yyyymm).split('-').map(Number);
  return `Q${Math.floor((month - 1) / 3) + 1} ${year}`;
}

// Stable pseudonym. Derived from the row id so it never changes, and offset so
// it does not read as a sequence anyone can count.
export function missionRef(id) {
  return `LD-${(id * 7919 + 10007).toString(36).toUpperCase().padStart(4, '0')}`;
}

/** What a launch provider is allowed to see before a match is accepted. */
export function publicMission(m, owner) {
  return {
    ref: missionRef(m.id),
    orbitType: orbitLabel(m.orbit_type),
    altitudeBand: altitudeBand(m.altitude_km),
    inclinationBand: inclinationBand(m.inclination_deg),
    massBand: massBand(m.payload_mass_kg),
    window: windowQuarter(m.window_month),
    rideType: rideLabel(m.ride_type),
    formFactor: formLabel(m.form_factor),
    propulsion: Boolean(m.propulsion),
    jurisdiction: owner?.country ?? '',
    postedAt: m.published_at ? new Date(m.published_at).toISOString() : null,
  };
}

/** Everything the owner sees about their own requirement. */
export function ownerMission(m, owner) {
  return {
    id: m.id,
    constellationId: m.constellation_id ?? null,
    reference: m.reference,
    orbitType: m.orbit_type,
    altitudeKm: m.altitude_km,
    inclinationDeg: m.inclination_deg,
    payloadMassKg: m.payload_mass_kg,
    windowMonth: m.window_month,
    rideType: m.ride_type,
    formFactor: m.form_factor,
    propulsion: Boolean(m.propulsion),
    notes: m.notes,
    status: m.status,
    alertsOn: Boolean(m.alerts_on),
    createdAt: new Date(m.created_at).toISOString(),
    publishedAt: m.published_at ? new Date(m.published_at).toISOString() : null,
    // the same record as providers would see it
    published: publicMission(m, owner),
  };
}

/** Live preview while typing: bands the fields that are valid, nulls the rest.
 *  Computed here rather than in the browser so the preview cannot drift from
 *  what a provider will actually be shown. */
export function previewMission(v, invalid, owner) {
  const ok = key => !invalid[key];
  return {
    ref: 'LD-••••',
    orbitType: ok('orbitType') ? orbitLabel(v.orbitType) : null,
    altitudeBand: ok('altitudeKm') ? altitudeBand(v.altitudeKm) : null,
    inclinationBand: ok('inclinationDeg') ? inclinationBand(v.inclinationDeg) : null,
    massBand: ok('payloadMassKg') ? massBand(v.payloadMassKg) : null,
    window: ok('windowMonth') ? windowQuarter(v.windowMonth) : null,
    rideType: ok('rideType') ? rideLabel(v.rideType) : null,
    formFactor: ok('formFactor') ? formLabel(v.formFactor) : null,
    propulsion: Boolean(v.propulsion),
    jurisdiction: owner?.country ?? '',
    postedAt: null,
  };
}
