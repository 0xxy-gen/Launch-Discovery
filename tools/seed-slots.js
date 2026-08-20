// Available launch slots, transcribed from "for claude xoxo.numbers".
//
// The sheet gives mission, capacity, deployer, launch window, launcher and
// launcher company. It does not give a launch site, and gives an orbit for only
// two rows, so `inferred: true` marks every value this file supplies to satisfy
// fields the app requires. The sheet's own wording is kept verbatim in `notes`.
import { findUserByEmail, createUser, createCompany, attachUser, updateCompany } from '../lib/db.js';
import { createLaunch, launchesForOwner } from '../lib/launches.js';
import { hashPassword } from '../lib/auth.js';

const PASSWORD = 'aether-demo-2026';

const PROVIDERS = {
  SpaceX:      { email: 'spacex@demo.aether', country: 'United States' },
  ISRO:        { email: 'isro@demo.aether', country: 'India' },
  'Rocket Lab': { email: 'rocketlab@demo.aether', country: 'United States' },
  ExPace:      { email: 'expace@demo.aether', country: 'China' },
};

// capacity as written in the sheet, plus the kg the app needs to filter on
const SLOTS = [
  { mission: 'Transporter-22', provider: 'SpaceX', vehicle: 'Falcon 9',
    capacity: '16U', kg: 32, window: '2027-10', orbit: 'sso', alt: 525, inc: 97.5,
    brokers: 'RIDE! Space', deployer: 'Yes', sheetWindow: 'Q4 2027' },
  { mission: 'Transporter-19', provider: 'SpaceX', vehicle: 'Falcon 9',
    capacity: '16U', kg: 32, window: '2027-01', orbit: 'sso', alt: 525, inc: 97.5,
    brokers: 'RIDE! Space, Space BD, D-Orbit', deployer: 'Yes', sheetWindow: 'Q1 2027' },
  { mission: 'Transporter-20', provider: 'SpaceX', vehicle: 'Falcon 9',
    capacity: '16U', kg: 32, window: '2027-04', orbit: 'sso', alt: 525, inc: 97.5,
    brokers: 'Space BD', deployer: 'Yes', sheetWindow: 'Q2 2027' },
  { mission: 'Waymaker-1', provider: 'SpaceX', vehicle: 'Falcon 9',
    capacity: '1000-2000kg', kg: 2000, window: '2028-07', orbit: 'sso', alt: 525, inc: 97.5,
    brokers: 'SEOPS', deployer: 'Yes', sheetWindow: 'Q3 2028' },
  { mission: 'Bandwagon-6', provider: 'SpaceX', vehicle: 'Falcon 9',
    capacity: '', kg: 1500, window: '2027-06', orbit: 'leo_mid', alt: 550, inc: 45,
    brokers: 'RIDE! Space', deployer: '', sheetWindow: 'not stated' },
  { mission: 'PSLV Configuration 1', provider: 'ISRO', vehicle: 'PSLV',
    capacity: '150kg', kg: 150, window: '2027-04', orbit: 'sso', alt: 550, inc: 97.5,
    brokers: 'Space BD', deployer: 'No', quantity: 4,
    sheetWindow: 'Feb-July 2027 (target late April, might delay to Q4 or 2028)' },
  { mission: 'PSLV Configuration 2', provider: 'ISRO', vehicle: 'PSLV',
    capacity: 'Multiple CubeSats > ~400kg', kg: 400, window: '2027-04', orbit: 'sso', alt: 550, inc: 97.5,
    brokers: 'Space BD', deployer: 'No',
    sheetWindow: 'Feb-July 2027 (target late April, might delay to Q4 or 2028)' },
  { mission: 'PSLV (early 2028, unconfirmed)', provider: 'ISRO', vehicle: 'PSLV',
    capacity: '', kg: 400, window: '2028-02', orbit: 'sso', alt: 550, inc: 97.5,
    brokers: 'RIDE! Space', deployer: 'No', sheetWindow: 'Early 2028' },
  { mission: 'PSLV', provider: 'ISRO', vehicle: 'PSLV',
    capacity: '', kg: 400, window: '2027-02', orbit: 'sso', alt: 550, inc: 97.5,
    brokers: 'Auxos Global, Commercial Space Technologies (CST)', sheetWindow: 'Feb 2027' },
  { mission: 'SSLV', provider: 'ISRO', vehicle: 'SSLV',
    capacity: '', kg: 300, window: '2027-02', orbit: 'sso', alt: 500, inc: 97.4,
    brokers: 'Auxos Global, Commercial Space Technologies (CST)', sheetWindow: 'Feb 2027' },
  { mission: 'Skyroot', provider: 'ISRO', vehicle: 'Vikram-1',
    capacity: '', kg: 300, window: '2027-02', orbit: 'sso', alt: 500, inc: 97.4,
    brokers: 'Auxos Global, Commercial Space Technologies (CST)', sheetWindow: 'Feb 2027' },
  { mission: 'Neutron-2', provider: 'Rocket Lab', vehicle: 'Neutron',
    capacity: '', kg: 8000, window: '2027-12', orbit: 'leo_mid', alt: 500, inc: 45,
    brokers: 'Space BD', sheetWindow: '2027Q4 - 2028Q1' },
  // the only two rows that state an orbit outright
  { mission: 'KZ-11 (10:30 LTAN)', provider: 'ExPace', vehicle: 'Kuaizhou-11',
    capacity: '80kg', kg: 80, window: '2027-03', orbit: 'sso', alt: 500, inc: 97.4,
    deployer: 'Yes', sheetOrbit: '500km, SSO, 10:30AM', sheetWindow: 'March 2027' },
  { mission: 'KZ-11 (13:30 LTAN)', provider: 'ExPace', vehicle: 'Kuaizhou-11',
    capacity: '550kg', kg: 550, window: '2027-06', orbit: 'sso', alt: 500, inc: 97.4,
    deployer: 'Yes', sheetOrbit: '500km, SSO, 13:30PM', sheetWindow: 'June 2027' },
];

const passwordHash = await hashPassword(PASSWORD);

function providerAccount(name) {
  const spec = PROVIDERS[name];
  let user = findUserByEmail(spec.email);
  if (user) return user;

  const company = createCompany('launch_provider');
  user = createUser({
    email: spec.email, passwordHash, accountType: 'launch_provider',
    organisation: '', role: 'Manifest', country: '', linkedin: '', dial: '', phone: '',
    firstName: name, lastName: 'Manifest',
  });
  attachUser(user.id, company.id, 'admin');
  updateCompany(company.id, {
    organisation: name, country: spec.country, linkedin: '', dial: '', phone: '',
    website: '', description: '', entityType: 'commercial', incorporatedIn: spec.country,
    sizeBand: '', foundedYear: null, fundingStage: '', flightHeritage: '10+',
    exportRegime: '', applications: [], logo: '',
  });
  console.log(`created ${spec.email.padEnd(24)} ${name}`);
  return findUserByEmail(spec.email);
}

function noteFor(slot) {
  const lines = [
    slot.capacity ? `Capacity as listed: ${slot.capacity}` : null,
    slot.deployer ? `Deployer: ${slot.deployer}` : null,
    slot.sheetOrbit ? `Deployment orbit: ${slot.sheetOrbit}` : null,
    `Launch window as listed: ${slot.sheetWindow}`,
    slot.quantity ? `Slots available: ${slot.quantity}` : null,
    slot.brokers ? `Also brokered by: ${slot.brokers}` : null,
    slot.sheetOrbit ? null : 'Altitude and inclination inferred — the source sheet does not state them.',
    'Launch site not stated in the source.',
  ].filter(Boolean);
  return lines.join('\n');
}

for (const slot of SLOTS) {
  const user = providerAccount(slot.provider);
  const existing = launchesForOwner(user.company_id).map(l => l.name);
  if (existing.includes(slot.mission)) continue;

  createLaunch(user.id, user.company_id, {
    name: slot.mission,
    vehicle: slot.vehicle,
    site: 'Not stated',
    orbitType: slot.orbit,
    altitudeKm: slot.alt,
    inclinationDeg: slot.inc,
    windowMonth: slot.window,
    capacityKg: slot.kg,
    committedKg: 0,
    notes: noteFor(slot),
  }, true);
  console.log(`  + ${slot.mission.padEnd(24)} ${slot.vehicle} · ${slot.window} · ${slot.kg} kg`);
}

console.log(`\n${SLOTS.length} slots seeded. Provider logins use: ${PASSWORD}`);
