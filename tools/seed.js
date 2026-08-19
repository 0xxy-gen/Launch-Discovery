// Demo accounts and sample data for poking at the prototype.
//   npm run seed          create anything missing
//   npm run seed -- --reset   delete the demo accounts first, then recreate
import { db, createUser, findUserByEmail, createCompany, attachUser, updateCompany } from '../lib/db.js';
import { createMission, missionsForOwner } from '../lib/missions.js';
import { createLaunch, launchesForOwner } from '../lib/launches.js';
import { hashPassword } from '../lib/auth.js';

const PASSWORD = 'aether-demo-2026';

const ACCOUNTS = [
  {
    email: 'satco@demo.aether',
    accountType: 'payload_owner',
    profile: { organisation: 'SatCo Systems', role: 'Mission Manager', country: 'United Kingdom',
               linkedin: '', dial: '+44', phone: '7700 900123' },
    missions: [
      { reference: 'Aurora-1', orbitType: 'sso', altitudeKm: 550, inclinationDeg: 97.6,
        payloadMassKg: 180, windowMonth: '2027-03', rideType: 'rideshare', formFactor: 'micro',
        propulsion: true, notes: 'Deployer TBC. Needs 15° sun angle at separation.', publish: true },
      { reference: 'Aurora-2', orbitType: 'sso', altitudeKm: 585, inclinationDeg: 97.7,
        payloadMassKg: 195, windowMonth: '2027-06', rideType: 'rideshare', formFactor: 'micro',
        propulsion: true, notes: 'Follow-on to Aurora-1.', publish: false },
    ],
  },
  {
    email: 'cubes@demo.aether',
    accountType: 'payload_owner',
    profile: { organisation: 'Northfield University', role: 'Principal Investigator',
               country: 'Netherlands', linkedin: '', dial: '', phone: '' },
    missions: [
      { reference: 'NF-CUBE', orbitType: 'sso', altitudeKm: 520, inclinationDeg: 97.5,
        payloadMassKg: 8, windowMonth: '2027-04', rideType: 'rideshare', formFactor: 'cubesat_12u',
        propulsion: false, notes: 'Student mission, flexible on altitude.', publish: true },
    ],
  },
  {
    email: 'orbital@demo.aether',
    accountType: 'payload_owner',
    profile: { organisation: 'Meridian Imaging', role: 'Head of Programmes', country: 'Germany',
               linkedin: '', dial: '+49', phone: '3012345678' },
    missions: [
      { reference: 'MER-3', orbitType: 'leo_mid', altitudeKm: 500, inclinationDeg: 45,
        payloadMassKg: 320, windowMonth: '2028-01', rideType: 'dedicated', formFactor: 'espa',
        propulsion: true, notes: '', publish: true },
    ],
  },
  {
    email: 'rocketco@demo.aether',
    accountType: 'launch_provider',
    profile: { organisation: 'RocketCo', role: 'Head of Sales', country: 'United States',
               linkedin: '', dial: '+1', phone: '2025550143' },
    missions: [],
    launches: [
      { name: 'Transporter-14', vehicle: 'Falcon 9', site: 'Vandenberg SLC-4E',
        orbitType: 'sso', altitudeKm: 525, inclinationDeg: 97.5, windowMonth: '2027-04',
        capacityKg: 3500, committedKg: 2100,
        notes: 'ESPA and 15-inch ports available. Integration cut-off L-8 weeks.', publish: true },
      { name: 'RC-7 dedicated', vehicle: 'RocketCo Vega', site: 'Kourou ELV',
        orbitType: 'leo_mid', altitudeKm: 500, inclinationDeg: 45, windowMonth: '2028-02',
        capacityKg: 1200, committedKg: 300, notes: '', publish: true },
      { name: 'Transporter-16', vehicle: 'Falcon 9', site: 'Cape Canaveral SLC-40',
        orbitType: 'sso', altitudeKm: 560, inclinationDeg: 97.6, windowMonth: '2027-10',
        capacityKg: 3500, committedKg: 0, notes: 'Manifest opening soon.', publish: false },
    ],
  },
  {
    email: 'broker@demo.aether',
    accountType: 'broker',
    profile: { organisation: 'Vector Rideshare', role: 'Manifest Lead', country: 'France',
               linkedin: '', dial: '+33', phone: '145550188' },
    missions: [],
  },
];

if (process.argv.includes('--reset')) {
  const stmt = db.prepare('DELETE FROM users WHERE email = ?');
  for (const a of ACCOUNTS) stmt.run(a.email);
  console.log('removed existing demo accounts');
}

const passwordHash = await hashPassword(PASSWORD);

for (const account of ACCOUNTS) {
  let user = findUserByEmail(account.email);

  if (!user) {
    const company = createCompany(account.accountType);
    user = createUser({
      email: account.email,
      passwordHash,
      accountType: account.accountType,
      organisation: '', role: account.profile.role, country: '', linkedin: '', dial: '', phone: '',
    });
    attachUser(user.id, company.id, 'admin');
    updateCompany(company.id, account.profile);
    user = findUserByEmail(account.email);
    console.log(`created ${account.email.padEnd(22)} ${account.accountType}`);
  } else {
    console.log(`kept    ${account.email.padEnd(22)} ${account.accountType}`);
  }

  if (missionsForOwner(user.company_id).length === 0) {
    for (const { publish, ...m } of account.missions) createMission(user.id, user.company_id, m, publish);
    if (account.missions.length) console.log(`        + ${account.missions.length} mission(s)`);
  }

  if (account.launches?.length && launchesForOwner(user.company_id).length === 0) {
    for (const { publish, ...l } of account.launches) createLaunch(user.id, user.company_id, l, publish);
    console.log(`        + ${account.launches.length} launch(es)`);
  }
}

// A second person inside SatCo, so the people list shows what it is for.
const satco = findUserByEmail('satco@demo.aether');
if (satco && !findUserByEmail('eng@demo.aether')) {
  const colleague = createUser({
    email: 'eng@demo.aether',
    passwordHash,
    accountType: 'payload_owner',
    organisation: '', role: 'Systems Engineer', country: '', linkedin: '', dial: '', phone: '',
  });
  attachUser(colleague.id, satco.company_id, 'member');
  console.log('created eng@demo.aether     member of SatCo Systems');
}

console.log(`\nAll demo accounts use the password: ${PASSWORD}`);
