import { COUNTRY_NAMES, DIAL_CODES } from './countries.js';
import { ACCOUNT_TYPE_VALUES } from './account-types.js';

const EMAIL    = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const LINKEDIN = /^(https?:\/\/)?([\w-]+\.)?linkedin\.com\/.+/i;
const PHONE    = /^[\d][\d\s().-]{4,}$/;

const str = v => (typeof v === 'string' ? v.trim() : '');

// Returns { values, fields } — `fields` maps a form field to its first error,
// matching the ids the client uses so it can paint them inline.
export function validateRegistration(body = {}) {
  const fields = {};
  const email        = str(body.email).toLowerCase();
  const password     = typeof body.password === 'string' ? body.password : '';
  const accountType  = str(body.accountType);
  const organisation = str(body.organisation);
  const role         = str(body.role);
  const country      = str(body.country);
  const linkedin     = str(body.linkedin);
  const dial         = str(body.dial);
  const phone        = str(body.phone);

  if (!EMAIL.test(email) || email.length > 254) fields.email = 'Enter a valid email address.';

  if (!password) fields.password = 'Password is required.';
  else if (password.length < 8) fields.password = 'Use at least 8 characters.';
  else if (password.length > 200) fields.password = 'Password is too long.';

  if (!accountType) fields['account-type'] = 'Account type is required.';
  else if (!ACCOUNT_TYPE_VALUES.has(accountType)) fields['account-type'] = 'Choose a type from the list.';

  if (!organisation) fields.org = 'Organisation is required.';
  else if (organisation.length > 120) fields.org = 'Organisation is too long.';

  if (!role) fields.role = 'Role is required.';
  else if (role.length > 120) fields.role = 'Role is too long.';

  // Country and dial code must come from the shared list, so a hand-rolled
  // request cannot store something the dropdowns would never produce.
  if (!country) fields.country = 'Operating country is required.';
  else if (!COUNTRY_NAMES.has(country)) fields.country = 'Choose a country from the list.';

  if (linkedin && !LINKEDIN.test(linkedin)) fields.linkedin = 'Enter a LinkedIn profile URL.';
  else if (linkedin.length > 200) fields.linkedin = 'That URL is too long.';

  if (!dial) fields.dial = 'Country code is required.';
  else if (!DIAL_CODES.has(dial)) fields.dial = 'Choose a code from the list.';

  if (!phone) fields.phone = 'Phone number is required.';
  else if (!PHONE.test(phone)) fields.phone = 'Enter a valid phone number.';
  else if (phone.length > 32) fields.phone = 'Phone number is too long.';

  return {
    fields,
    values: { email, password, accountType, organisation, role, country, linkedin, dial, phone },
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
