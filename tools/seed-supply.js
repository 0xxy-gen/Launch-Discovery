// Additional supply for the demo, using real vehicles and real providers.
//
// A launch manifest is public information, so naming real vehicles is fair —
// the same reasoning seed-slots.js gives. What is NOT public is any given
// provider's spare capacity on a given flight, so every capacity figure and
// window below is ILLUSTRATIVE and says so in its own notes. Nothing here
// should be read as a real commercial offer, and none of it came from the
// providers named.
//
// seed-slots.js stays the source of truth for the transcribed spreadsheet.
// This file only adds breadth: orbits and countries that file does not reach.
import { findUserByEmail, createUser, createCompany, attachUser, updateCompany } from '../lib/db.js';
import { createLaunch, launchesForOwner } from '../lib/launches.js';
import { hashPassword } from '../lib/auth.js';

const PASSWORD = 'aether-demo-2026';
const passwordHash = await hashPassword(PASSWORD);

const PROVIDERS = {
  'Rocket Lab':               { email: 'rocketlab@demo.aether', country: 'United States', heritage: '10+' },
  'Isar Aerospace':           { email: 'isar@demo.aether', country: 'Germany', heritage: 'none' },
  'Firefly Aerospace':        { email: 'firefly@demo.aether', country: 'United States', heritage: '1-3' },
  'PLD Space':                { email: 'pld@demo.aether', country: 'Spain', heritage: 'none' },
  'Orbex':                    { email: 'orbex@demo.aether', country: 'United Kingdom', heritage: 'none' },
  'Rocket Factory Augsburg':  { email: 'rfa@demo.aether', country: 'Germany', heritage: 'none' },
  'Gilmour Space':            { email: 'gilmour@demo.aether', country: 'Australia', heritage: 'none' },
  'Perigee Aerospace':        { email: 'perigee@demo.aether', country: 'South Korea', heritage: 'none' },
  'Agnikul Cosmos':           { email: 'agnikul@demo.aether', country: 'India', heritage: '1-3' },
  'Skyroot Aerospace':        { email: 'skyroot@demo.aether', country: 'India', heritage: '1-3' },
  Arianespace:                { email: 'arianespace@demo.aether', country: 'France', heritage: '10+' },
  Avio:                       { email: 'avio@demo.aether', country: 'Italy', heritage: '10+' },
  'Mitsubishi Heavy Industries': { email: 'mhi@demo.aether', country: 'Japan', heritage: '10+' },
  KARI:                       { email: 'kari@demo.aether', country: 'South Korea', heritage: '1-3' },
  'D-Orbit':                  { email: 'dorbit@demo.aether', country: 'Italy', heritage: '10+' },
  Momentus:                   { email: 'momentus@demo.aether', country: 'United States', heritage: '1-3' },
  'Blue Origin':              { email: 'blueorigin@demo.aether', country: 'United States', heritage: '1-3' },
  MaiaSpace:                  { email: 'maiaspace@demo.aether', country: 'France', heritage: 'none' },
  Skyrora:                    { email: 'skyrora@demo.aether', country: 'United Kingdom', heritage: 'none' },
  'Exolaunch':                { email: 'exolaunch@demo.aether', country: 'Germany', heritage: '10+',
                                broker: true },
};

// `operator` is set only where the seller is not the one flying — that is the
// broker case, and the whole reason the field exists.
const LAUNCHES = [
  // ── SSO, filling out the crowded shell ─────────────────────────────────
  { seller: 'Isar Aerospace', name: 'Spectrum SSO-3', vehicle: 'Spectrum',
    site: 'Andøya', orbit: 'sso', alt: 550, inc: 97.6, when: '2027-08', cap: 700, done: 180 },
  { seller: 'Firefly Aerospace', name: 'Alpha FLTA-9', vehicle: 'Alpha',
    site: 'Vandenberg SLC-2W', orbit: 'sso', alt: 530, inc: 97.5, when: '2027-05', cap: 630, done: 210 },
  { seller: 'Rocket Factory Augsburg', name: 'RFA One M3', vehicle: 'RFA One',
    site: 'SaxaVord', orbit: 'sso', alt: 500, inc: 97.4, when: '2028-01', cap: 1000, done: 120 },
  { seller: 'Skyrora', name: 'Skyrora XL first commercial', vehicle: 'Skyrora XL',
    site: 'SaxaVord', orbit: 'sso', alt: 500, inc: 97.4, when: '2028-04', cap: 300, done: 0 },
  { seller: 'Avio', name: 'Vega-C SSMS POC-6', vehicle: 'Vega-C',
    site: 'Kourou SLV', orbit: 'sso', alt: 560, inc: 97.6, when: '2027-11', cap: 1100, done: 640 },
  { seller: 'Agnikul Cosmos', name: 'Agnibaan orbital-2', vehicle: 'Agnibaan',
    site: 'Satish Dhawan', orbit: 'sso', alt: 520, inc: 97.5, when: '2027-09', cap: 100, done: 25 },

  // ── brokered: the seller is not the operator ───────────────────────────
  { seller: 'Exolaunch', name: 'Falcon 9 rideshare block — Q1 2028', vehicle: 'Falcon 9',
    operator: 'SpaceX', site: 'Vandenberg SLC-4E', orbit: 'sso', alt: 525, inc: 97.5,
    when: '2028-01', cap: 900, done: 310 },
  { seller: 'Exolaunch', name: 'Spectrum shared manifest', vehicle: 'Spectrum',
    operator: 'Isar Aerospace', site: 'Andøya', orbit: 'sso', alt: 545, inc: 97.5,
    when: '2028-03', cap: 400, done: 60 },
  { seller: 'D-Orbit', name: 'MIRA last-mile — SSO 550', vehicle: 'MIRA',
    operator: 'SpaceX', site: 'Vandenberg SLC-4E', orbit: 'sso', alt: 550, inc: 97.6,
    when: '2027-10', cap: 180, done: 45,
    extra: 'Orbital transfer vehicle. We fly as a Falcon 9 rideshare, then deliver you to a '
         + 'phased plane — useful if the host orbit is close but not exact.' },
  { seller: 'Momentus', name: 'Vigoride-12', vehicle: 'Vigoride',
    operator: 'SpaceX', site: 'Cape Canaveral SLC-40', orbit: 'sso', alt: 520, inc: 97.4,
    when: '2027-12', cap: 150, done: 30,
    extra: 'Transfer vehicle hosted on a Transporter mission.' },

  // ── polar, which the spreadsheet does not cover at all ─────────────────
  { seller: 'Rocket Lab', name: 'Electron — polar dedicated', vehicle: 'Electron',
    site: 'Mahia LC-1', orbit: 'leo_polar', alt: 500, inc: 90, when: '2027-06', cap: 250, done: 90 },
  { seller: 'Perigee Aerospace', name: 'HANBIT-Nano PN-3', vehicle: 'HANBIT-Nano',
    site: 'Jeju', orbit: 'leo_polar', alt: 500, inc: 90, when: '2028-02', cap: 90, done: 12 },
  { seller: 'KARI', name: 'KSLV-II Nuri flight 6', vehicle: 'KSLV-II (Nuri)',
    site: 'Naro', orbit: 'leo_polar', alt: 600, inc: 98, when: '2028-05', cap: 1500, done: 900 },

  // ── mid-inclination ────────────────────────────────────────────────────
  { seller: 'Gilmour Space', name: 'Eris Block 1 — TestFlight 3', vehicle: 'Eris Block 1',
    site: 'Bowen', orbit: 'leo_mid', alt: 500, inc: 45, when: '2027-11', cap: 215, done: 0 },
  { seller: 'Skyroot Aerospace', name: 'Vikram-1 commercial-2', vehicle: 'Vikram-1',
    site: 'Satish Dhawan', orbit: 'leo_mid', alt: 500, inc: 45, when: '2027-07', cap: 290, done: 80 },
  { seller: 'PLD Space', name: 'Miura 5 — flight 4', vehicle: 'Miura 5',
    site: 'Kourou', orbit: 'leo_mid', alt: 500, inc: 45, when: '2028-06', cap: 540, done: 100 },
  { seller: 'Orbex', name: 'Prime OP-2', vehicle: 'Prime',
    site: 'SaxaVord', orbit: 'leo_mid', alt: 500, inc: 45, when: '2028-03', cap: 180, done: 0 },

  // ── equatorial ─────────────────────────────────────────────────────────
  { seller: 'MaiaSpace', name: 'Maia — equatorial demo', vehicle: 'Maia',
    site: 'Kourou', orbit: 'leo_equat', alt: 500, inc: 5, when: '2028-07', cap: 500, done: 0 },

  // ── GTO and MEO, which demand already exists for ───────────────────────
  { seller: 'Arianespace', name: 'Ariane 6 — GTO shared', vehicle: 'Ariane 6',
    site: 'Kourou ELA-4', orbit: 'gto', alt: 35786, inc: 6, when: '2028-04', cap: 4500, done: 2600 },
  { seller: 'Mitsubishi Heavy Industries', name: 'H3 — GTO co-manifest', vehicle: 'H3',
    site: 'Tanegashima', orbit: 'gto', alt: 35786, inc: 6, when: '2028-02', cap: 3000, done: 1900 },
  { seller: 'Blue Origin', name: 'New Glenn NG-7 — MEO', vehicle: 'New Glenn',
    site: 'Cape Canaveral LC-36', orbit: 'meo', alt: 8000, inc: 55, when: '2028-06',
    cap: 7000, done: 5200 },
];

const ILLUSTRATIVE =
  'Illustrative listing — capacity, window and site are demo data, not a published '
  + 'manifest, and did not come from the provider named.';

function account(name) {
  const spec = PROVIDERS[name];
  const existing = findUserByEmail(spec.email);
  if (existing) return existing;

  const company = createCompany(spec.broker ? 'broker' : 'launch_provider');
  const user = createUser({
    email: spec.email, passwordHash,
    accountType: spec.broker ? 'broker' : 'launch_provider',
    organisation: '', role: 'Manifest Lead', country: '', linkedin: '', dial: '', phone: '',
    firstName: 'Demo', lastName: 'Account',
  });
  attachUser(user.id, company.id, 'admin');
  updateCompany(company.id, {
    organisation: name, country: spec.country, linkedin: '', dial: '', phone: '',
    website: '', description: '', entityType: 'commercial', incorporatedIn: spec.country,
    sizeBand: '', foundedYear: null, fundingStage: '', flightHeritage: spec.heritage,
    exportRegime: '', applications: [], logo: '',
  });
  console.log(`created ${spec.email.padEnd(26)} ${name}`);
  return findUserByEmail(spec.email);
}

let added = 0;
for (const l of LAUNCHES) {
  const user = account(l.seller);
  if (launchesForOwner(user.company_id).some(x => x.name === l.name)) continue;

  createLaunch(user.id, user.company_id, {
    name: l.name,
    vehicle: l.vehicle,
    operator: l.operator ?? '',
    site: l.site,
    orbitType: l.orbit,
    altitudeKm: l.alt,
    inclinationDeg: l.inc,
    windowMonth: l.when,
    capacityKg: l.cap,
    committedKg: l.done,
    notes: [l.extra, l.operator ? `Sold by ${l.seller}; flown by ${l.operator}.` : null, ILLUSTRATIVE]
      .filter(Boolean).join('\n'),
  }, true);
  added += 1;
  console.log(`  + ${l.name.padEnd(34)} ${l.vehicle.padEnd(16)} ${l.orbit.padEnd(10)} ${l.when}  ${l.cap - l.done} kg spare`);
}

console.log(`\n${added} launches added across ${Object.keys(PROVIDERS).length} providers.`);
