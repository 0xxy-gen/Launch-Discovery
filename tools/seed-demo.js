// Demo demand for the Launch Discovery marketplace.
//
// The operators here are INVENTED. Supply — the Launches tab — comes from a
// real spreadsheet via seed-slots.js, because a launch manifest is public
// information. Demand is not: putting a real company's name on a fabricated
// launch requirement would be inventing a competitor's commercial intent, and
// at an industry conference those people are in the room. So every operator
// below is fictional, with realistic profiles behind them.
import { db, findUserByEmail, createUser, createCompany, attachUser, updateCompany } from '../lib/db.js';
import { createMission, missionsForOwner } from '../lib/missions.js';
import { createConstellation, assignMission } from '../lib/constellations.js';
import { createPool, joinPool } from '../lib/pools.js';
import { postMessage } from '../lib/messages.js';
import { saveLaunch } from '../lib/saved.js';
import { hashPassword } from '../lib/auth.js';

const PASSWORD = 'aether-demo-2026';
const passwordHash = await hashPassword(PASSWORD);

const OPERATORS = [
  { key: 'kestrel', email: 'kestrel@demo.aether', name: 'Kestrel Orbital', country: 'United Kingdom',
    person: ['Priya', 'Raghavan'], role: 'Head of Launch', entity: 'commercial', funding: 'series_a',
    size: '11-50', founded: 2019, heritage: '1-3', regime: 'none', apps: ['eo'],
    website: 'kestrelorbital.example', about: 'Sub-metre optical imaging for maritime and infrastructure monitoring.' },
  { key: 'vantage', email: 'vantage@demo.aether', name: 'Vantage Geospatial', country: 'Canada',
    person: ['Marc', 'Thibodeau'], role: 'Director, Missions', entity: 'commercial', funding: 'series_b',
    size: '51-200', founded: 2016, heritage: '4-10', regime: 'ear', apps: ['eo', 'defence'],
    website: 'vantagegeo.example', about: 'Hyperspectral constellation serving agriculture and forestry analytics.' },
  { key: 'nimbus', email: 'nimbus@demo.aether', name: 'Nimbus Connect', country: 'Netherlands',
    person: ['Sanne', 'de Vries'], role: 'Mission Manager', entity: 'commercial', funding: 'pre_seed',
    size: '1-10', founded: 2023, heritage: 'none', regime: 'none', apps: ['iot'],
    website: 'nimbusconnect.example', about: 'Low-power IoT backhaul for logistics and remote sensing networks.' },
  { key: 'karoo', email: 'karoo@demo.aether', name: 'Karoo Earth Observation', country: 'South Africa',
    person: ['Thandiwe', 'Mokoena'], role: 'Programme Lead', entity: 'commercial', funding: 'grant',
    size: '11-50', founded: 2020, heritage: '1-3', regime: 'none', apps: ['eo', 'science'],
    website: 'karooeo.example', about: 'Wildfire and water-stress monitoring across southern Africa.' },
  { key: 'anagata', email: 'anagata@demo.aether', name: 'Anagata Space', country: 'Indonesia',
    person: ['Bagus', 'Wirawan'], role: 'Founder', entity: 'commercial', funding: 'pre_seed',
    size: '1-10', founded: 2024, heritage: 'none', regime: 'unsure', apps: ['tech_demo'],
    website: 'anagata.example', about: 'Deployable antenna demonstrator for regional broadband.' },
  { key: 'solstice', email: 'solstice@demo.aether', name: 'Solstice Robotics', country: 'Germany',
    person: ['Lena', 'Brandt'], role: 'VP Spacecraft', entity: 'commercial', funding: 'series_a',
    size: '51-200', founded: 2018, heritage: '1-3', regime: 'eu_dual', apps: ['isam'],
    website: 'solsticerobotics.example', about: 'Rendezvous and docking vehicles for in-orbit inspection and refuelling.' },
  { key: 'tidewater', email: 'tidewater@demo.aether', name: 'Tidewater Analytics', country: 'United States',
    person: ['Dana', 'Okoro'], role: 'Launch Procurement', entity: 'commercial', funding: 'revenue',
    size: '51-200', founded: 2015, heritage: '10+', regime: 'itar', apps: ['eo', 'defence'],
    website: 'tidewateranalytics.example', about: 'Radar imaging for maritime domain awareness.' },
  { key: 'coimbra', email: 'coimbra@demo.aether', name: 'Coimbra Space Institute', country: 'Portugal',
    person: ['Inês', 'Ferreira'], role: 'Principal Investigator', entity: 'academic', funding: '',
    size: '11-50', founded: 1998, heritage: '1-3', regime: 'none', apps: ['science', 'tech_demo'],
    website: 'csi.example', about: 'Ionospheric science payloads flown with university partners.' },
  { key: 'lyra', email: 'lyra@demo.aether', name: 'Lyra Space Systems', country: 'Japan',
    person: ['Kenji', 'Watanabe'], role: 'Manifest Lead', entity: 'commercial', funding: 'series_b',
    size: '201-1000', founded: 2014, heritage: '10+', regime: 'none', apps: ['comms'],
    website: 'lyraspace.example', about: 'Optical inter-satellite relay for LEO constellations.' },
];

// Clustered on purpose: several operators heading for the same shell in the
// same quarter is what makes Aether Pooling show anything.
const SATELLITES = [
  // ── SSO 500–600 km, Q1 2027 ────────────────────────────────────────────
  { op: 'kestrel', ref: 'Kestrel-1', orbit: 'sso', alt: 550, inc: 97.6, mass: 180, when: '2027-02',
    ride: 'rideshare', form: 'micro', prop: true, notes: 'Deployer TBC. Needs 15° sun angle at separation.' },
  { op: 'vantage', ref: 'Vantage-3', orbit: 'sso', alt: 565, inc: 97.6, mass: 240, when: '2027-03',
    ride: 'rideshare', form: 'espa', prop: true, notes: 'ESPA grande port preferred.' },
  { op: 'nimbus', ref: 'Nimbus-A1', orbit: 'sso', alt: 520, inc: 97.5, mass: 12, when: '2027-01',
    ride: 'rideshare', form: 'cubesat_12u', prop: false, notes: 'First flight. Flexible on altitude.' },
  { op: 'karoo', ref: 'Karoo-1', orbit: 'sso', alt: 540, inc: 97.5, mass: 95, when: '2027-03',
    ride: 'rideshare', form: 'micro', prop: false, notes: '' },
  { op: 'coimbra', ref: 'CSI-Pathfinder', orbit: 'sso', alt: 510, inc: 97.4, mass: 6, when: '2027-02',
    ride: 'rideshare', form: 'cubesat_3u', prop: false, notes: 'Student-built. Launch grant confirmed.' },

  // ── SSO 500–600 km, Q2 2027 ────────────────────────────────────────────
  { op: 'kestrel', ref: 'Kestrel-2', orbit: 'sso', alt: 550, inc: 97.6, mass: 180, when: '2027-05',
    ride: 'rideshare', form: 'micro', prop: true, notes: 'Second plane of the Kestrel constellation.' },
  { op: 'anagata', ref: 'Anagata-1', orbit: 'sso', alt: 505, inc: 97.4, mass: 24, when: '2027-04',
    ride: 'rideshare', form: 'cubesat_12u', prop: false, notes: 'Antenna deployment demo.' },
  { op: 'lyra', ref: 'Lyra-2', orbit: 'sso', alt: 580, inc: 97.7, mass: 310, when: '2027-06',
    ride: 'rideshare', form: 'espa', prop: true, notes: '' },
  { op: 'tidewater', ref: 'Tidewater-4', orbit: 'sso', alt: 545, inc: 97.5, mass: 145, when: '2027-05',
    ride: 'rideshare', form: 'micro', prop: true, notes: 'ITAR-controlled payload; US-licensed providers only.' },

  // ── LEO mid-inclination, Q2 2027 ───────────────────────────────────────
  { op: 'solstice', ref: 'Solstice-D1', orbit: 'leo_mid', alt: 520, inc: 45, mass: 420, when: '2027-06',
    ride: 'dedicated', form: 'mini', prop: true, notes: 'Servicing demonstrator. Hydrazine, hazardous handling.' },
  { op: 'tidewater', ref: 'Tidewater-5', orbit: 'leo_mid', alt: 550, inc: 45, mass: 150, when: '2027-05',
    ride: 'rideshare', form: 'micro', prop: true, notes: '' },
  { op: 'nimbus', ref: 'Nimbus-B2', orbit: 'leo_mid', alt: 530, inc: 45, mass: 15, when: '2027-06',
    ride: 'rideshare', form: 'cubesat_12u', prop: false, notes: '' },

  // ── SSO, Q1 2028 ───────────────────────────────────────────────────────
  { op: 'vantage', ref: 'Vantage-4', orbit: 'sso', alt: 570, inc: 97.6, mass: 250, when: '2028-02',
    ride: 'rideshare', form: 'espa', prop: true, notes: '' },
  { op: 'karoo', ref: 'Karoo-2', orbit: 'sso', alt: 545, inc: 97.5, mass: 100, when: '2028-01',
    ride: 'rideshare', form: 'micro', prop: false, notes: '' },

  // ── outliers, so the directory is not all one shell ────────────────────
  { op: 'lyra', ref: 'Lyra-GTO1', orbit: 'gto', alt: 35786, inc: 6, mass: 1800, when: '2028-03',
    ride: 'dedicated', form: 'custom', prop: true, notes: 'Relay node. Dedicated or large rideshare.' },
  { op: 'solstice', ref: 'Solstice-M1', orbit: 'meo', alt: 8000, inc: 55, mass: 600, when: '2028-06',
    ride: 'dedicated', form: 'mini', prop: true, notes: '', draft: true },
];

const CONSTELLATIONS = [
  { op: 'kestrel', name: 'Kestrel', members: ['Kestrel-1', 'Kestrel-2'] },
  { op: 'vantage', name: 'Vantage Tier-2', members: ['Vantage-3', 'Vantage-4'] },
];

const POOLS = [
  {
    name: 'SSO 550 · Q1 2027',
    lead: 'kestrel', seed: 'Kestrel-1',
    join: [['nimbus', 'Nimbus-A1'], ['karoo', 'Karoo-1'], ['coimbra', 'CSI-Pathfinder']],
    messages: [
      ['kestrel', 'Opening this for the Q1 window. Kestrel-1 is 180 kg to 550 km, 97.6°, February. Happy to lead on the provider conversation if we get to 400 kg or so.'],
      ['nimbus', 'Nimbus-A1 is 12 kg at 520 km, January. We can take anything from 500 to 560 km — altitude is not tight for us.'],
      ['karoo', 'Karoo-1, 95 kg, 540 km, March. Our funding milestone lands in January so March is firm, not aspirational.'],
      ['coimbra', 'CSI-Pathfinder is 6 kg, 510 km, February. Student build, launch grant already confirmed.'],
      ['kestrel', 'That is 293 kg between the four of us. Worth approaching Transporter-19 as a block — the listed spare is only 32 kg so we would need the next one, but a combined manifest is a stronger conversation.'],
    ],
  },
  {
    name: 'Mid-inclination 520 · Q2 2027',
    lead: 'solstice', seed: 'Solstice-D1',
    join: [['tidewater', 'Tidewater-5'], ['nimbus', 'Nimbus-B2']],
    messages: [
      ['solstice', 'Solstice-D1 is 420 kg, 45°, June. We carry hydrazine so we need a provider comfortable with hazardous handling — flagging early.'],
      ['tidewater', 'Tidewater-5, 150 kg, 550 km, 45°, May. Ours is ITAR-controlled, so US-licensed providers only. Worth both of us saying that up front.'],
      ['nimbus', 'Nimbus-B2 is 15 kg and we are flexible. Bandwagon-6 looks like the obvious target for this plane.'],
    ],
  },
];

// ── build ───────────────────────────────────────────────────────────────────

const accounts = new Map();

for (const op of OPERATORS) {
  let user = findUserByEmail(op.email);
  if (!user) {
    const company = createCompany('payload_owner');
    user = createUser({
      email: op.email, passwordHash, accountType: 'payload_owner',
      organisation: '', role: op.role, country: '', linkedin: '', dial: '', phone: '',
      firstName: op.person[0], lastName: op.person[1],
    });
    attachUser(user.id, company.id, 'admin');
    updateCompany(company.id, {
      organisation: op.name, country: op.country, linkedin: '', dial: '', phone: '',
      website: op.website, description: op.about, entityType: op.entity,
      incorporatedIn: op.country, sizeBand: op.size, foundedYear: op.founded,
      fundingStage: op.funding, flightHeritage: op.heritage, exportRegime: op.regime,
      applications: op.apps, logo: '',
    });
    user = findUserByEmail(op.email);
    console.log(`created ${op.email.padEnd(24)} ${op.name}`);
  }
  accounts.set(op.key, user);
}

const missions = new Map();
for (const sat of SATELLITES) {
  const user = accounts.get(sat.op);
  const already = missionsForOwner(user.company_id).find(m => m.reference === sat.ref);
  if (already) { missions.set(sat.ref, already); continue; }

  const mission = createMission(user.id, user.company_id, {
    reference: sat.ref, orbitType: sat.orbit, altitudeKm: sat.alt, inclinationDeg: sat.inc,
    payloadMassKg: sat.mass, windowMonth: sat.when, rideType: sat.ride,
    formFactor: sat.form, propulsion: sat.prop, notes: sat.notes,
  }, !sat.draft);
  missions.set(sat.ref, mission);
  console.log(`  + ${sat.ref.padEnd(16)} ${sat.mass} kg · ${sat.alt} km · ${sat.when}${sat.draft ? ' (draft)' : ''}`);
}

for (const c of CONSTELLATIONS) {
  const user = accounts.get(c.op);
  const existing = db.prepare('SELECT 1 FROM constellations WHERE company_id = ? AND name = ?')
    .get(user.company_id, c.name);
  if (existing) continue;
  const group = createConstellation(user.company_id, c.name);
  for (const ref of c.members) assignMission(user.company_id, missions.get(ref).id, group.id);
  console.log(`  ~ constellation ${c.name} (${c.members.length} satellites)`);
}

const MINUTE = 60_000;
for (const spec of POOLS) {
  if (db.prepare('SELECT 1 FROM pools WHERE name = ?').get(spec.name)) continue;

  const lead = accounts.get(spec.lead);
  const seed = missions.get(spec.seed);
  const pool = createPool(lead.id, lead.company_id, {
    name: spec.name,
    orbitType: seed.orbit_type, altitudeKm: seed.altitude_km,
    inclinationDeg: seed.inclination_deg, windowMonth: seed.window_month,
    capacityKg: 0,
  });
  joinPool(pool.id, seed.id, lead.id, lead.company_id);

  for (const [key, ref] of spec.join) {
    const user = accounts.get(key);
    joinPool(pool.id, missions.get(ref).id, user.id, user.company_id);
  }

  // stagger the timestamps backwards so the thread does not read as one instant
  const stamp = db.prepare('UPDATE messages SET created_at = ? WHERE id = ?');
  const base = Date.now() - spec.messages.length * 90 * MINUTE;
  spec.messages.forEach(([key, body], i) => {
    const user = accounts.get(key);
    const info = postMessage(pool.id, user.company_id, user.id, body);
    stamp.run(base + i * 90 * MINUTE, info.lastInsertRowid);
  });

  console.log(`  ~ pool ${spec.name} (${spec.join.length + 1} members, ${spec.messages.length} messages)`);
}

// a couple of shortlisted flights, so the saved page is not empty
const shortlists = [['kestrel', 'Transporter-19'], ['kestrel', 'Transporter-20'], ['solstice', 'Bandwagon-6']];
for (const [key, launchName] of shortlists) {
  const user = accounts.get(key);
  const launch = db.prepare("SELECT id FROM launches WHERE name = ? AND status = 'published'").get(launchName);
  if (launch) saveLaunch(user.company_id, launch.id, user.id);
}

console.log(`\n${OPERATORS.length} operators, ${SATELLITES.length} satellites, ${POOLS.length} pools.`);
console.log(`All demo accounts use the password: ${PASSWORD}`);
