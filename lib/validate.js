import { COUNTRY_NAMES, DIAL_CODES } from './countries.js';
import { ACCOUNT_TYPE_VALUES } from './account-types.js';
import { ORBIT_VALUES, RIDE_VALUES, FORM_VALUES } from './mission-options.js';
import {
  ENTITY_VALUES, SIZE_VALUES, FUNDING_VALUES,
  HERITAGE_VALUES, EXPORT_VALUES, APPLICATION_VALUES,
} from './company-options.js';

const EMAIL    = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const LINKEDIN = /^(https?:\/\/)?([\w-]+\.)?linkedin\.com\/.+/i;
const PHONE    = /^[\d][\d\s().-]{4,}$/;

const str = v => (typeof v === 'string' ? v.trim() : '');
const num = v => (typeof v === 'number' ? v : Number(String(v).trim()));

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
  const firstName   = str(body.firstName);
  const lastName    = str(body.lastName);
  const role        = str(body.role);

  if (!EMAIL.test(email) || email.length > 254) fields.email = 'Enter a valid email address.';

  // The person, not the company: a company account is set up in the next step
  // and can carry several people.
  if (!firstName) fields.firstName = 'Enter your first name.';
  else if (firstName.length > 80) fields.firstName = 'That is too long.';

  if (!lastName) fields.lastName = 'Enter your last name.';
  else if (lastName.length > 80) fields.lastName = 'That is too long.';

  if (!role) fields.role = 'What do you do?';
  else if (role.length > 120) fields.role = 'That is too long.';

  if (!password) fields.password = 'Password is required.';
  else if (password.length < 8) fields.password = 'Use at least 8 characters.';
  else if (password.length > 200) fields.password = 'Password is too long.';

  if (!accountType) fields['account-type'] = 'Pick one to continue.';
  else if (!ACCOUNT_TYPE_VALUES.has(accountType)) fields['account-type'] = 'That is not one of the options.';

  return { fields, values: { email, password, accountType, firstName, lastName, role } };
}

// Everything the signup form no longer asks for. Organisation and country are
// required here because a published requirement carries its jurisdiction.
export function validateProfile(body = {}) {
  const fields = {};
  const organisation   = str(body.organisation);
  const firstName      = str(body.firstName);
  const lastName       = str(body.lastName);
  const role           = str(body.role);
  const country        = str(body.country);
  const linkedin       = str(body.linkedin);
  const dial           = str(body.dial);
  const phone          = str(body.phone);
  const website        = str(body.website);
  const description    = str(body.description);
  const entityType     = str(body.entityType);
  const incorporatedIn = str(body.incorporatedIn);
  const sizeBand       = str(body.sizeBand);
  const fundingStage   = str(body.fundingStage);
  const flightHeritage = str(body.flightHeritage);
  const exportRegime   = str(body.exportRegime);
  const applications   = Array.isArray(body.applications) ? body.applications.map(str) : [];
  const logo           = typeof body.logo === 'string' ? body.logo : '';
  const foundedRaw     = body.foundedYear;
  const foundedYear    = foundedRaw === '' || foundedRaw == null ? null : Number(foundedRaw);

  // ── required: the least a counterparty needs before talking to you ────────
  if (!organisation) fields.organisation = 'Organisation is required.';
  else if (organisation.length > 120) fields.organisation = 'Organisation is too long.';

  if (!firstName) fields.firstName = 'Enter your first name.';
  else if (firstName.length > 80) fields.firstName = 'That is too long.';

  if (!lastName) fields.lastName = 'Enter your last name.';
  else if (lastName.length > 80) fields.lastName = 'That is too long.';

  if (!role) fields.role = 'Role is required.';
  else if (role.length > 120) fields.role = 'Role is too long.';

  if (!country) fields.country = 'Operating country is required.';
  else if (!COUNTRY_NAMES.has(country)) fields.country = 'Choose a country from the list.';

  if (!entityType) fields.entityType = 'What kind of organisation is this?';
  else if (!ENTITY_VALUES.has(entityType)) fields.entityType = 'Choose one from the list.';

  // ── optional depth ────────────────────────────────────────────────────────
  if (incorporatedIn && !COUNTRY_NAMES.has(incorporatedIn)) {
    fields.incorporatedIn = 'Choose a country from the list.';
  }
  if (sizeBand && !SIZE_VALUES.has(sizeBand)) fields.sizeBand = 'Choose one from the list.';
  if (flightHeritage && !HERITAGE_VALUES.has(flightHeritage)) fields.flightHeritage = 'Choose one from the list.';
  if (exportRegime && !EXPORT_VALUES.has(exportRegime)) fields.exportRegime = 'Choose one from the list.';

  // Funding only means anything for a commercial company.
  if (fundingStage) {
    if (entityType !== 'commercial') fields.fundingStage = 'Only asked of commercial companies.';
    else if (!FUNDING_VALUES.has(fundingStage)) fields.fundingStage = 'Choose one from the list.';
  }

  if (applications.some(a => !APPLICATION_VALUES.has(a))) {
    fields.applications = 'One of those is not on the list.';
  }
  if (foundedYear !== null) {
    const thisYear = new Date().getFullYear();
    if (!Number.isInteger(foundedYear) || foundedYear < 1900 || foundedYear > thisYear) {
      fields.foundedYear = `Enter a year between 1900 and ${thisYear}.`;
    }
  }
  if (website && !/^(https?:\/\/)?[\w-]+(\.[\w-]+)+/.test(website)) {
    fields.website = 'Enter a web address.';
  } else if (website.length > 200) fields.website = 'That is too long.';

  if (description.length > 600) fields.description = 'Keep it under 600 characters.';

  // The logo arrives as a data URL the browser has already resized. Anything
  // else, or anything oversized, is refused rather than stored.
  if (logo) {
    if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(logo)) {
      fields.logo = 'That file could not be read as an image.';
    } else if (logo.length > 400_000) {
      fields.logo = 'That image is too large.';
    }
  }

  if (linkedin && !LINKEDIN.test(linkedin)) fields.linkedin = 'Enter a LinkedIn profile URL.';
  else if (linkedin.length > 200) fields.linkedin = 'That URL is too long.';

  if (dial && !DIAL_CODES.has(dial)) fields.dial = 'Choose a code from the list.';
  if (phone && !PHONE.test(phone)) fields.phone = 'Enter a valid phone number.';
  else if (phone.length > 32) fields.phone = 'Phone number is too long.';
  if (phone && !dial) fields.dial = 'Country code is required.';

  return {
    fields,
    values: {
      organisation, firstName, lastName, role, country, linkedin, dial, phone,
      website, description, entityType, incorporatedIn, sizeBand,
      foundedYear, fundingStage: entityType === 'commercial' ? fundingStage : '',
      flightHeritage, exportRegime, applications, logo,
    },
  };
}

export function validateLogin(body = {}) {
  const fields = {};
  const email = str(body.email).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';

  if (!EMAIL.test(email)) fields.email = 'Enter a valid email address.';
  if (!password) fields.password = 'Password is required.';

  return { fields, values: { email, password } };
}

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
  const rawCapacity = body.capacityKg;
  const capacityKg = rawCapacity === '' || rawCapacity == null ? 0 : num(rawCapacity);
  const missionId = num(body.missionId);

  if (!name) fields.name = 'Give the group a name.';
  else if (name.length > 120) fields.name = 'That name is too long.';

  // Optional: a group is about who is going where and when, not tonnage.
  if (capacityKg && (!Number.isFinite(capacityKg) || capacityKg < 0 || capacityKg > 100000)) {
    fields.capacityKg = 'Enter a mass in kg, or leave it blank.';
  }
  if (!Number.isInteger(missionId)) fields.missionId = 'Choose which mission seeds the pool.';

  return { fields, values: { name, capacityKg, missionId } };
}

export function validateLaunch(body = {}) {
  const fields = {};
  const name           = str(body.name);
  const vehicle        = str(body.vehicle);
  const operator       = str(body.operator);
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

  // Optional: blank means the seller flies it themselves.
  if (operator.length > 120) fields.operator = 'That is too long.';

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
    values: { name, vehicle, operator, site, orbitType, altitudeKm, inclinationDeg,
              windowMonth, capacityKg, committedKg, notes },
  };
}
