// Demo accounts and sample data for poking at the prototype.
//   npm run seed          create anything missing
//   npm run seed -- --reset   delete the demo accounts first, then recreate
import { db, createUser, findUserByEmail, updateProfile } from '../lib/db.js';
import { createMission, missionsForOwner } from '../lib/missions.js';
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
    user = createUser({
      email: account.email,
      passwordHash,
      accountType: account.accountType,
      organisation: '', role: '', country: '', linkedin: '', dial: '', phone: '',
    });
    user = updateProfile(user.id, account.profile);
    console.log(`created ${account.email.padEnd(22)} ${account.accountType}`);
  } else {
    console.log(`kept    ${account.email.padEnd(22)} ${account.accountType}`);
  }

  if (missionsForOwner(user.id).length === 0) {
    for (const { publish, ...m } of account.missions) createMission(user.id, m, publish);
    if (account.missions.length) console.log(`        + ${account.missions.length} mission(s)`);
  }
}

console.log(`\nAll demo accounts use the password: ${PASSWORD}`);
