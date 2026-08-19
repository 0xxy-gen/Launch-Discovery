import { COUNTRY_NAMES, DIAL_CODES } from './countries.js';
import { ACCOUNT_TYPE_VALUES } from './account-types.js';
import { ORBIT_VALUES, RIDE_VALUES, FORM_VALUES } from './mission-options.js';

const EMAIL    = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const LINKEDIN = /^(https?:\/\/)?([\w-]+\.)?linkedin\.com\/.+/i;
const PHONE    = /^[\d][\d\s().-]{4,}$/;

const str = v => (typeof v === 'string' ? v.trim() : '');

// Returns { values, fields } — `fields` maps a form field to its first error,
// matching the ids the client uses so it can paint them inline.
// Signup asks the least it can: which side of the market you are on, plus
// credentials. Organisation, country and contact details are collected on the
// profile, at the point they are actually used — publishing a requirement.
export function validateRegistration(body = {}) {
  const fields = {};
  const email       = str(body.email).toLowerCase();
  const password    = typeof body.password === 'string' ? body.password : '';
  const accountType = str(body.accountType);

  if (!EMAIL.test(email) || email.length > 254) fields.email = 'Enter a valid email address.';

  if (!password) fields.password = 'Password is required.';
  else if (password.length < 8) fields.password = 'Use at least 8 characters.';
  else if (password.length > 200) fields.password = 'Password is too long.';

  if (!accountType) fields['account-type'] = 'Pick one to continue.';
  else if (!ACCOUNT_TYPE_VALUES.has(accountType)) fields['account-type'] = 'That is not one of the options.';

  return { fields, values: { email, password, accountType } };
}

// Everything the signup form no longer asks for. Organisation and country are
// required here because a published requirement carries its jurisdiction.
export function validateProfile(body = {}) {
  const fields = {};
  const organisation = str(body.organisation);
  const role         = str(body.role);
  const country      = str(body.country);
  const linkedin     = str(body.linkedin);
  const dial         = str(body.dial);
  const phone        = str(body.phone);

  if (!organisation) fields.organisation = 'Organisation is required.';
  else if (organisation.length > 120) fields.organisation = 'Organisation is too long.';

  if (!role) fields.role = 'Role is required.';
  else if (role.length > 120) fields.role = 'Role is too long.';

  if (!country) fields.country = 'Operating country is required.';
  else if (!COUNTRY_NAMES.has(country)) fields.country = 'Choose a country from the list.';

  if (linkedin && !LINKEDIN.test(linkedin)) fields.linkedin = 'Enter a LinkedIn profile URL.';
  else if (linkedin.length > 200) fields.linkedin = 'That URL is too long.';

  // Contact details are optional until a match is accepted.
  if (dial && !DIAL_CODES.has(dial)) fields.dial = 'Choose a code from the list.';
  if (phone && !PHONE.test(phone)) fields.phone = 'Enter a valid phone number.';
  else if (phone.length > 32) fields.phone = 'Phone number is too long.';
  if (phone && !dial) fields.dial = 'Country code is required.';

  return { fields, values: { organisation, role, country, linkedin, dial, phone } };
}

export function validateLogin(body = {}) {
  const fields = {};
  const email = str(body.email).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';

  if (!EMAIL.test(email)) fields.email = 'Enter a valid email address.';
  if (!password) fields.password = 'Password is required.';

  return { fields, values: { email, password } };
}

const num = v => (typeof v === 'number' ? v : Number(String(v).trim()));

export function validateMission(body = {}) {
  const fields = {};
  const reference      = str(body.reference);
  const orbitType      = str(body.orbitType);
  const altitudeKm     = num(body.altitudeKm);
  const inclinationDeg = num(body.inclinationDeg);
  const payloadMassKg  = num(body.payloadMassKg);
  const windowMonth    = str(body.windowMonth);
  const rideType       = str(body.rideType);
  const formFactor     = str(body.formFactor);
  const propulsion     = Boolean(body.propulsion);
  const notes          = str(body.notes);

  if (!reference) fields.reference = 'Give it an internal name.';
  else if (reference.length > 120) fields.reference = 'That name is too long.';

  if (!ORBIT_VALUES.has(orbitType)) fields.orbitType = 'Choose an orbit.';
  if (!RIDE_VALUES.has(rideType)) fields.rideType = 'Choose a ride type.';
  if (!FORM_VALUES.has(formFactor)) fields.formFactor = 'Choose a form factor.';

  // Ranges are generous on purpose — they reject typos, not unusual missions.
  if (!Number.isFinite(altitudeKm) || altitudeKm < 150 || altitudeKm > 400000) {
    fields.altitudeKm = 'Enter an altitude in km (150 or above).';
  }
  if (!Number.isFinite(inclinationDeg) || inclinationDeg < 0 || inclinationDeg > 180) {
    fields.inclinationDeg = 'Enter an inclination between 0 and 180°.';
  }
  if (!Number.isFinite(payloadMassKg) || payloadMassKg <= 0 || payloadMassKg > 100000) {
    fields.payloadMassKg = 'Enter a payload mass in kg.';
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(windowMonth)) {
    fields.windowMonth = 'Choose a target month.';
  }
  if (notes.length > 2000) fields.notes = 'Keep notes under 2000 characters.';

  return {
    fields,
    values: { reference, orbitType, altitudeKm, inclinationDeg, payloadMassKg,
              windowMonth, rideType, formFactor, propulsion, notes },
  };
}

export function validatePool(body = {}) {
  const fields = {};
  const name = str(body.name);
  const capacityKg = num(body.capacityKg);
  const missionId = num(body.missionId);

  if (!name) fields.name = 'Give the pool a name.';
  else if (name.length > 120) fields.name = 'That name is too long.';

  if (!Number.isFinite(capacityKg) || capacityKg <= 0 || capacityKg > 100000) {
    fields.capacityKg = 'Enter the combined mass you are aiming for.';
  }
  if (!Number.isInteger(missionId)) fields.missionId = 'Choose which mission seeds the pool.';

  return { fields, values: { name, capacityKg, missionId } };
}

export function validateLaunch(body = {}) {
  const fields = {};
  const name           = str(body.name);
  const vehicle        = str(body.vehicle);
  const site           = str(body.site);
  const orbitType      = str(body.orbitType);
  const altitudeKm     = num(body.altitudeKm);
  const inclinationDeg = num(body.inclinationDeg);
  const windowMonth    = str(body.windowMonth);
  const capacityKg     = num(body.capacityKg);
  const committedKg    = body.committedKg === '' || body.committedKg == null ? 0 : num(body.committedKg);
  const notes          = str(body.notes);

  if (!name) fields.name = 'Give the launch a name.';
  else if (name.length > 120) fields.name = 'That name is too long.';

  if (!vehicle) fields.vehicle = 'Which vehicle?';
  else if (vehicle.length > 120) fields.vehicle = 'That is too long.';

  if (!site) fields.site = 'Which launch site?';
  else if (site.length > 120) fields.site = 'That is too long.';

  if (!ORBIT_VALUES.has(orbitType)) fields.orbitType = 'Choose an orbit.';

  if (!Number.isFinite(altitudeKm) || altitudeKm < 150 || altitudeKm > 400000) {
    fields.altitudeKm = 'Enter an altitude in km (150 or above).';
  }
  if (!Number.isFinite(inclinationDeg) || inclinationDeg < 0 || inclinationDeg > 180) {
    fields.inclinationDeg = 'Enter an inclination between 0 and 180°.';
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(windowMonth)) fields.windowMonth = 'Choose a target month.';

  if (!Number.isFinite(capacityKg) || capacityKg <= 0 || capacityKg > 200000) {
    fields.capacityKg = 'Enter the capacity available in kg.';
  }
  if (!Number.isFinite(committedKg) || committedKg < 0) {
    fields.committedKg = 'Enter how much is already committed, or leave it blank.';
  } else if (Number.isFinite(capacityKg) && committedKg > capacityKg) {
    fields.committedKg = 'Committed mass cannot exceed capacity.';
  }
  if (notes.length > 2000) fields.notes = 'Keep notes under 2000 characters.';

  return {
    fields,
    values: { name, vehicle, site, orbitType, altitudeKm, inclinationDeg,
              windowMonth, capacityKg, committedKg, notes },
  };
}
