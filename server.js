import express from 'express';
import { join, dirname } from 'node:path';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { COUNTRIES } from './lib/countries.js';
import { ACCOUNT_TYPES } from './lib/account-types.js';
import {
  ENTITY_TYPES, COMPANY_SIZES, FUNDING_STAGES,
  FLIGHT_HERITAGE, EXPORT_REGIMES, APPLICATIONS,
} from './lib/company-options.js';
import { ORBIT_TYPES, RIDE_TYPES, FORM_FACTORS } from './lib/mission-options.js';
import { ownerMission, previewMission, publicMission } from './lib/banding.js';
import {
  createPool, poolById, allPools, poolView, joinPool, leavePool, isMember,
} from './lib/pools.js';
import { compatibility } from './lib/compatibility.js';
import { destinations } from './lib/destinations.js';
import { saveLaunch, unsaveLaunch, savedIds, savedLaunches } from './lib/saved.js';
import {
  postMessage, messagesFor, lastMessage, unreadCount, markThreadRead, threadsFor,
} from './lib/messages.js';
import { waitlistEntry, joinWaitlist, leaveWaitlist } from './lib/waitlist.js';
import {
  setMissionAlerts, runAlertsForLaunch, alertHits, alertUnread, markAlertsRead,
} from './lib/alerts.js';
import {
  createConstellation, constellationById, constellationsFor,
  renameConstellation, deleteConstellation, assignMission, summarise,
} from './lib/constellations.js';
import {
  createLaunch, updateLaunch, setLaunchStatus, launchById, launchesForOwner,
  deleteLaunch, browseLaunches, launchView, ownerLaunch, launchCountries, launchOrbits, launchBounds,
} from './lib/launches.js';
import {
  createMission, updateMission, setMissionStatus,
  missionById, missionsForOwner, deleteMission, browsePublished,
  duplicateMission, nextReference,
} from './lib/missions.js';
import {
  validateRegistration, validateLogin, validateMission, validateProfile, validatePool, validateLaunch,
} from './lib/validate.js';
import { hashPassword, verifyPassword, newSessionToken, hashToken } from './lib/auth.js';
import { setPerson } from './lib/db.js';
import {
  createUser, findUserByEmail, createSession, findSessionUser,
  deleteSession, purgeExpiredSessions, publicUser,
  createCompany, companyById, updateCompany, attachUser,
  peopleOf, removePerson, adminCount,
  createInvite, findInvite, pendingInvites, acceptInvite, revokeInvite,
} from './lib/db.js';

const root = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3100);
const SESSION_TTL = 1000 * 60 * 60 * 24 * 14;   // 14 days
const COOKIE = 'ld_session';
const SECURE_COOKIES = process.env.NODE_ENV === 'production';

// Whatever vehicle images are sitting in public/vehicles at start-up. The page
// swaps the drawn silhouette for a real image when one exists for that vehicle,
// so adding artwork is a matter of dropping files in and restarting.
function vehicleImages() {
  try {
    return Object.fromEntries(readdirSync(join(root, 'public', 'vehicles'))
      .filter(f => /\.(png|webp|svg|jpe?g)$/i.test(f))
      .map(f => [f.replace(/\.[^.]+$/, '').toLowerCase(), '/vehicles/' + f]));
  } catch {
    return {};
  }
}
const VEHICLE_IMAGES = vehicleImages();

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '600kb' }));   // company logos arrive as data URLs

// ─── cookies ────────────────────────────────────────────────────────────────

function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}

function setSessionCookie(res, token) {
  res.cookie(COOKIE, token, {
    httpOnly: true,            // unreachable from page scripts
    sameSite: 'lax',           // not sent on cross-site POSTs
    secure: SECURE_COOKIES,
    maxAge: SESSION_TTL,
    path: '/',
  });
}

// ─── guards ─────────────────────────────────────────────────────────────────

// A cross-site <form> post cannot set this header, so requiring it keeps the
// mutating routes out of reach of a simple CSRF attempt.
function requireJson(req, res, next) {
  if (!req.is('application/json')) {
    return res.status(415).json({ error: 'Send application/json.' });
  }
  next();
}

// Small in-memory limiter. Fine for a single process; swap for a shared store
// if this ever runs on more than one instance.
const attempts = new Map();
const WINDOW = 15 * 60 * 1000;

function rateLimit(max) {
  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const entry = attempts.get(key);

    if (!entry || now > entry.resetAt) {
      attempts.set(key, { count: 1, resetAt: now + WINDOW });
      return next();
    }
    if (entry.count >= max) {
      const retry = Math.ceil((entry.resetAt - now) / 1000);
      res.set('Retry-After', String(retry));
      return res.status(429).json({ error: 'Too many attempts. Try again shortly.' });
    }
    entry.count += 1;
    next();
  };
}

setInterval(() => {
  purgeExpiredSessions();
  const now = Date.now();
  for (const [key, entry] of attempts) if (now > entry.resetAt) attempts.delete(key);
}, 60 * 60 * 1000).unref();

// Compared against when no account matches, so a wrong email costs the same
// time as a wrong password and neither can be probed for.
const DUMMY_HASH = await hashPassword(newSessionToken());

// ─── routes ─────────────────────────────────────────────────────────────────

// Everything the register form needs to build its dropdowns.
// no-cache, not max-age: the ETag makes repeat requests a cheap 304, and
// editing the account types or country list can never leave a client stale.
app.get('/api/options', (req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.json({
    countries: COUNTRIES,
    accountTypes: ACCOUNT_TYPES,
    orbitTypes: ORBIT_TYPES,
    rideTypes: RIDE_TYPES,
    formFactors: FORM_FACTORS,
    entityTypes: ENTITY_TYPES,
    companySizes: COMPANY_SIZES,
    fundingStages: FUNDING_STAGES,
    flightHeritage: FLIGHT_HERITAGE,
    exportRegimes: EXPORT_REGIMES,
    applications: APPLICATIONS,
    vehicleImages: VEHICLE_IMAGES,
  });
});

app.get('/api/me', (req, res) => {
  const token = readCookie(req, COOKIE);
  const user = token && findSessionUser(hashToken(token));
  if (!user) return res.status(401).json({ error: 'Not signed in.' });
  // the saved count rides along so the nav badge does not need its own request
  const unread = threadsFor(user.company_id)
    .reduce((n, p) => n + unreadCount(p.id, user.company_id), 0)
    + alertUnread(user.company_id);
  res.json({
    user: { ...publicUser(user), savedCount: savedIds(user.company_id).size, unreadCount: unread },
  });
});

app.post('/api/register', requireJson, rateLimit(20), async (req, res, next) => {
  try {
    const { fields, values } = validateRegistration(req.body);
    if (Object.keys(fields).length) return res.status(400).json({ fields });

    if (findUserByEmail(values.email)) {
      return res.status(409).json({
        error: 'An account with that email already exists',
        fields: { email: 'That email is already registered.' },
      });
    }

    // A new signup creates the company as well, with the signer as its admin.
    // Colleagues join later by invitation rather than making their own company.
    const company = createCompany(values.accountType);
    const user = createUser({
      email: values.email,
      passwordHash: await hashPassword(values.password),
      accountType: values.accountType,
      organisation: '', role: values.role, country: '', linkedin: '', dial: '', phone: '',
      firstName: values.firstName, lastName: values.lastName,
    });
    attachUser(user.id, company.id, 'admin');

    const token = newSessionToken();
    createSession(hashToken(token), user.id, SESSION_TTL);
    setSessionCookie(res, token);
    res.status(201).json({ user: publicUser(findUserByEmail(values.email)) });
  } catch (err) {
    next(err);
  }
});

app.post('/api/login', requireJson, rateLimit(10), async (req, res, next) => {
  try {
    const { fields, values } = validateLogin(req.body);
    if (Object.keys(fields).length) return res.status(400).json({ fields });

    const user = findUserByEmail(values.email);
    const ok = user
      ? await verifyPassword(values.password, user.password_hash)
      : await verifyPassword(values.password, DUMMY_HASH);

    if (!user || !ok) return res.status(401).json({ error: 'Email or password is incorrect' });

    const token = newSessionToken();
    createSession(hashToken(token), user.id, SESSION_TTL);
    setSessionCookie(res, token);
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

app.post('/api/logout', (req, res) => {
  const token = readCookie(req, COOKIE);
  if (token) deleteSession(hashToken(token));
  res.clearCookie(COOKIE, { path: '/', httpOnly: true, sameSite: 'lax', secure: SECURE_COOKIES });
  res.status(204).end();
});

// Resolves the constellation a mission is being filed under. Returns null for
// ungrouped, or undefined once it has already answered with an error.
function groupFor(req, res) {
  const raw = req.body.constellationId;
  if (raw === null || raw === undefined || raw === '') return null;

  const group = constellationById(Number(raw));
  if (!group || group.company_id !== req.user.company_id) {
    res.status(400).json({ fields: { constellationId: 'Choose one of your own constellations.' } });
    return undefined;
  }
  return group.id;
}

// ─── missions ───────────────────────────────────────────────────────────────

function currentUser(req) {
  const token = readCookie(req, COOKIE);
  return token ? findSessionUser(hashToken(token)) : undefined;
}

function requireUser(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'Not signed in.' });
  req.user = { ...user, isAdmin: user.company_role === 'admin' };
  next();
}

// Ownership is checked on every mission route: the id in the URL is never
// trusted on its own, only rows belonging to the signed-in account are touched.
function ownedMission(req, res) {
  const mission = missionById(Number(req.params.id));
  if (!mission || mission.company_id !== req.user.company_id) {
    res.status(404).json({ error: 'Not found.' });
    return undefined;
  }
  return mission;
}

app.put('/api/profile', requireJson, requireUser, (req, res) => {
  const { fields, values } = validateProfile(req.body);
  if (Object.keys(fields).length) return res.status(400).json({ fields });
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Only an admin can edit the company.' });

  updateCompany(req.user.company_id, values);
  setPerson(req.user.id, values);
  res.json({ user: publicUser(findUserByEmail(req.user.email)) });
});

// ─── people ─────────────────────────────────────────────────────────────────
// Anyone working a launch campaign should be able to pick it up, so a company
// carries several accounts rather than one shared login.

const INVITE_TTL = 1000 * 60 * 60 * 24 * 14;

app.get('/api/people', requireUser, (req, res) => {
  res.json({
    people: peopleOf(req.user.company_id).map(p => ({
      id: p.id,
      email: p.email,
      name: p.name,
      firstName: p.first_name,
      lastName: p.last_name,
      role: p.role,
      companyRole: p.company_role,
      isYou: p.id === req.user.id,
      joinedAt: new Date(p.created_at).toISOString(),
    })),
    invites: pendingInvites(req.user.company_id).map(i => ({
      email: i.email,
      expiresAt: new Date(i.expires_at).toISOString(),
    })),
  });
});

app.post('/api/people/invite', requireJson, requireUser, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Only an admin can invite people.' });

  const email = String(req.body.email ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return res.status(400).json({ fields: { 'invite-email': 'Enter a valid email address.' } });
  }
  if (findUserByEmail(email)) {
    return res.status(409).json({ fields: { 'invite-email': 'That email already has an account.' } });
  }

  const token = newSessionToken();
  createInvite(hashToken(token), req.user.company_id, email, req.user.id, INVITE_TTL);

  // No mail is sent from a local build, so the link is handed back to be
  // passed on however the company already talks to its people.
  res.status(201).json({ email, link: `${req.protocol}://${req.get('host')}/join?token=${token}` });
});

app.delete('/api/people/invite', requireJson, requireUser, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Only an admin can do that.' });
  revokeInvite(req.user.company_id, String(req.body.email ?? '').trim().toLowerCase());
  res.status(204).end();
});

app.delete('/api/people/:id', requireUser, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Only an admin can remove people.' });

  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'You cannot remove yourself.' });
  if (!removePerson(req.user.company_id, id)) return res.status(404).json({ error: 'Not found.' });
  res.status(204).end();
});

// Accepting an invite: the invitee sets a password and lands inside the company
// that invited them, rather than creating a company of their own.
app.post('/api/join', requireJson, rateLimit(20), async (req, res, next) => {
  try {
    const token = String(req.body.token ?? '');
    const invite = token && findInvite(hashToken(token));
    if (!invite || invite.expires_at < Date.now()) {
      return res.status(400).json({ error: 'That invitation is no longer valid.' });
    }

    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (password.length < 8) {
      return res.status(400).json({ fields: { password: 'Use at least 8 characters.' } });
    }
    if (findUserByEmail(invite.email)) {
      return res.status(409).json({ error: 'That email already has an account.' });
    }

    const company = companyById(invite.company_id);
    const user = createUser({
      email: invite.email,
      passwordHash: await hashPassword(password),
      accountType: company.account_type,
      organisation: '', role: String(req.body.role ?? '').trim(), country: '',
      linkedin: '', dial: '', phone: '',
      firstName: String(req.body.firstName ?? '').trim(),
      lastName: String(req.body.lastName ?? '').trim(),
    });
    attachUser(user.id, company.id, 'member');
    acceptInvite(hashToken(token));

    const session = newSessionToken();
    createSession(hashToken(session), user.id, SESSION_TTL);
    setSessionCookie(res, session);
    res.status(201).json({ user: publicUser(findUserByEmail(invite.email)) });
  } catch (err) {
    next(err);
  }
});

app.get('/api/join', (req, res) => {
  const token = String(req.query.token ?? '');
  const invite = token && findInvite(hashToken(token));
  if (!invite || invite.expires_at < Date.now()) {
    return res.status(404).json({ error: 'That invitation is no longer valid.' });
  }
  const company = companyById(invite.company_id);
  res.json({ email: invite.email, organisation: company.name, accountType: company.account_type });
});

// Open to every signed-in account. Owners reading each other's requirements is
// how pools form — "somebody else is going to my orbit" — and the banding is
// what makes that safe to show. Your own company's rows are always excluded.
app.get('/api/payloads', requireUser, (req, res) => {
  const q = req.query;
  const num = v => (v === undefined || v === '' ? null : Number(v));
  const rows = browsePublished(req.user.company_id, {
    orbitType: q.orbit, rideType: q.ride, formFactor: q.form,
    massMin: num(q.massMin), massMax: num(q.massMax),
    fromMonth: q.from, toMonth: q.to,
  });

  // Only ever the banded view — the exact figures are not in this response.
  res.json({ payloads: rows.map(m => publicMission(m, { country: m.owner_country })) });
});

app.get('/api/missions', requireUser, (req, res) => {
  const missions = missionsForOwner(req.user.company_id).map(m => ownerMission(m, req.user));

  // Each group carries the shape of what is inside it: a constellation only
  // means anything as the altitude, inclination and window of its members.
  const constellations = constellationsFor(req.user.company_id).map(c => {
    const members = missions.filter(m => m.constellationId === c.id);
    return {
      id: c.id,
      name: c.name,
      notes: c.notes,
      summary: summarise(members),
    };
  });

  res.json({ missions, constellations });
});

// ─── constellations ─────────────────────────────────────────────────────────

app.post('/api/constellations', requireJson, requireUser, (req, res) => {
  const name = String(req.body.name ?? '').trim();
  if (!name) return res.status(400).json({ fields: { 'constellation-name': 'Give it a name.' } });
  if (name.length > 120) {
    return res.status(400).json({ fields: { 'constellation-name': 'That name is too long.' } });
  }
  const created = createConstellation(req.user.company_id, name, String(req.body.notes ?? '').trim());
  res.status(201).json({ constellation: { id: created.id, name: created.name, notes: created.notes } });
});

app.put('/api/constellations/:id', requireJson, requireUser, (req, res) => {
  const name = String(req.body.name ?? '').trim();
  if (!name) return res.status(400).json({ error: 'Give it a name.' });
  if (!renameConstellation(req.user.company_id, Number(req.params.id), name, String(req.body.notes ?? '').trim())) {
    return res.status(404).json({ error: 'Not found.' });
  }
  res.status(204).end();
});

// The missions inside survive: the column is ON DELETE SET NULL, so they
// return to the ungrouped list rather than disappearing with the group.
app.delete('/api/constellations/:id', requireUser, (req, res) => {
  if (!deleteConstellation(req.user.company_id, Number(req.params.id))) {
    return res.status(404).json({ error: 'Not found.' });
  }
  res.status(204).end();
});

// Drives the "what providers see" panel as the form is typed into.
app.post('/api/missions/preview', requireJson, requireUser, (req, res) => {
  const { fields, values } = validateMission(req.body);
  res.json({ preview: previewMission(values, fields, req.user) });
});

// A published requirement carries the owner's jurisdiction, so it cannot go
// out before the profile says what that is.
const profileReady = user => {
  const c = companyById(user.company_id);
  return Boolean(c?.name && c?.country);
};
const NEEDS_PROFILE = { error: 'Add your organisation and country before publishing.', needsProfile: true };

app.post('/api/missions', requireJson, requireUser, (req, res) => {
  const { fields, values } = validateMission(req.body);
  if (Object.keys(fields).length) return res.status(400).json({ fields });

  const publish = req.body.publish === true;
  if (publish && !profileReady(req.user)) return res.status(409).json(NEEDS_PROFILE);

  const group = groupFor(req, res);
  if (group === undefined) return;

  const mission = createMission(req.user.id, req.user.company_id, values, publish);
  if (group !== null) assignMission(req.user.company_id, mission.id, group);
  res.status(201).json({ mission: ownerMission(mission, req.user) });
});

app.put('/api/missions/:id', requireJson, requireUser, (req, res) => {
  if (!ownedMission(req, res)) return;

  const { fields, values } = validateMission(req.body);
  if (Object.keys(fields).length) return res.status(400).json({ fields });

  const group = groupFor(req, res);
  if (group === undefined) return;

  updateMission(req.user.company_id, Number(req.params.id), values);
  assignMission(req.user.company_id, Number(req.params.id), group);
  res.json({ mission: ownerMission(missionById(Number(req.params.id)), req.user) });
});

// Publishing is its own route, not a field on the update — flipping a
// requirement between private and visible should be one deliberate action.
app.post('/api/missions/:id/status', requireJson, requireUser, (req, res) => {
  if (!ownedMission(req, res)) return;

  const status = req.body.status;
  if (status !== 'published' && status !== 'draft') {
    return res.status(400).json({ error: 'Status must be draft or published.' });
  }
  if (status === 'published' && !profileReady(req.user)) return res.status(409).json(NEEDS_PROFILE);
  const mission = setMissionStatus(req.user.company_id, Number(req.params.id), status);
  res.json({ mission: ownerMission(mission, req.user) });
});

// Copies everything and lands in the same constellation as a draft, so a
// second satellite is one click rather than a re-typed form.
app.post('/api/missions/:id/duplicate', requireJson, requireUser, (req, res) => {
  const source = ownedMission(req, res);
  if (!source) return;

  const existing = missionsForOwner(req.user.company_id).map(m => m.reference);
  const reference = String(req.body.reference ?? '').trim()
    || nextReference(existing, source.reference);

  const copy = duplicateMission(req.user.id, req.user.company_id, source, reference);
  res.status(201).json({ mission: ownerMission(copy, req.user) });
});

app.delete('/api/missions/:id', requireUser, (req, res) => {
  if (!ownedMission(req, res)) return;
  deleteMission(req.user.company_id, Number(req.params.id));
  res.status(204).end();
});

// ─── launches ───────────────────────────────────────────────────────────────
// Supply is advertised rather than redacted, so the directory is open to every
// signed-in account and the provider is named on purpose.

app.get('/api/launches', requireUser, (req, res) => {
  const q = req.query;
  const num = v => (v === undefined || v === '' ? null : Number(v));
  // orbit and country arrive comma-separated; empty means no constraint
  const list = v => (typeof v === 'string' ? v.split(',').map(x => x.trim()).filter(Boolean) : []);
  const rows = browseLaunches({
    orbitTypes: list(q.orbit), fromMonth: q.from, toMonth: q.to,
    minAvailable: num(q.minAvailable), countries: list(q.country),
    priceMin: num(q.priceMin), priceMax: num(q.priceMax),
    altMin: num(q.altMin), altMax: num(q.altMax),
  });

  // for a payload owner, which of their missions could actually fly on each
  const mine = missionsForOwner(req.user.company_id);
  const saved = savedIds(req.user.company_id);
  const launches = rows.map(l => ({
    ...launchView(l),
    saved: saved.has(l.id),
    candidates: mine.map(m => {
      const { ok, reasons } = compatibility(l, m);
      return { id: m.id, reference: m.reference, mass: m.payload_mass_kg, ok, reasons };
    }),
  }));

  res.json({
    launches, countries: launchCountries(), orbits: launchOrbits(), bounds: launchBounds(),
  });
});

// ─── saved launches ─────────────────────────────────────────────────────────

app.get('/api/saved', requireUser, (req, res) => {
  res.json({
    launches: savedLaunches(req.user.company_id).map(l => ({
      ...launchView(l),
      saved: true,
      savedAt: new Date(l.saved_at).toISOString(),
    })),
  });
});

app.post('/api/saved/:id', requireJson, requireUser, (req, res) => {
  const launch = launchById(Number(req.params.id));
  if (!launch || launch.status !== 'published') return res.status(404).json({ error: 'Not found.' });
  saveLaunch(req.user.company_id, launch.id, req.user.id);
  res.status(201).json({ saved: true });
});

app.delete('/api/saved/:id', requireUser, (req, res) => {
  unsaveLaunch(req.user.company_id, Number(req.params.id));
  res.status(204).end();
});

const SELLS_LAUNCH = new Set(['launch_provider', 'broker']);
function requireProvider(req, res, next) {
  if (!SELLS_LAUNCH.has(req.user.account_type)) {
    return res.status(403).json({ error: 'Not available on this account.' });
  }
  next();
}

function ownedLaunch(req, res) {
  const launch = launchById(Number(req.params.id));
  if (!launch || launch.company_id !== req.user.company_id) {
    res.status(404).json({ error: 'Not found.' });
    return undefined;
  }
  return launch;
}

app.get('/api/my-launches', requireUser, requireProvider, (req, res) => {
  res.json({ launches: launchesForOwner(req.user.company_id).map(ownerLaunch) });
});

app.post('/api/my-launches', requireJson, requireUser, requireProvider, (req, res) => {
  const { fields, values } = validateLaunch(req.body);
  if (Object.keys(fields).length) return res.status(400).json({ fields });

  const publish = req.body.publish === true;
  if (publish && !profileReady(req.user)) return res.status(409).json(NEEDS_PROFILE);

  const launch = createLaunch(req.user.id, req.user.company_id, values, publish);
  runAlertsForLaunch(launch);
  res.status(201).json({ launch: ownerLaunch(launch) });
});

app.put('/api/my-launches/:id', requireJson, requireUser, requireProvider, (req, res) => {
  if (!ownedLaunch(req, res)) return;
  const { fields, values } = validateLaunch(req.body);
  if (Object.keys(fields).length) return res.status(400).json({ fields });
  const launch = updateLaunch(req.user.company_id, Number(req.params.id), values);
  runAlertsForLaunch(launch);   // an edit can bring a launch into range
  res.json({ launch: ownerLaunch(launch) });
});

app.post('/api/my-launches/:id/status', requireJson, requireUser, requireProvider, (req, res) => {
  if (!ownedLaunch(req, res)) return;
  const status = req.body.status;
  if (status !== 'published' && status !== 'draft') {
    return res.status(400).json({ error: 'Status must be draft or published.' });
  }
  if (status === 'published' && !profileReady(req.user)) return res.status(409).json(NEEDS_PROFILE);
  const launch = setLaunchStatus(req.user.company_id, Number(req.params.id), status);
  runAlertsForLaunch(launch);
  res.json({ launch: ownerLaunch(launch) });
});

app.delete('/api/my-launches/:id', requireUser, requireProvider, (req, res) => {
  if (!ownedLaunch(req, res)) return;
  deleteLaunch(req.user.company_id, Number(req.params.id));
  res.status(204).end();
});

// ─── launch alerts ──────────────────────────────────────────────────────────
// The satellite is the alert criteria, so there is nothing to configure beyond
// a switch. Turning it on backfills against launches already listed.

app.post('/api/missions/:id/alerts', requireJson, requireUser, (req, res) => {
  const on = req.body.on === true;
  const mission = setMissionAlerts(req.user.company_id, Number(req.params.id), on);
  if (!mission) return res.status(404).json({ error: 'Not found.' });
  res.json({ mission: ownerMission(mission, req.user), unread: alertUnread(req.user.company_id) });
});

// ─── pooling ────────────────────────────────────────────────────────────────
// Owners coordinating with each other, which is the one place the anonymity
// model inverts — so it is opt-in, and only members see who is inside.

// Where people are going, derived from the published satellites themselves.
app.get('/api/destinations', requireUser, (req, res) => {
  const all = destinations(req.user.company_id);
  res.json({
    yours: all.filter(d => d.yours),
    others: all.filter(d => !d.yours),
  });
});

app.get('/api/pools', requireUser, (req, res) => {
  const mine = missionsForOwner(req.user.company_id);

  const pools = allPools().map(pool => {
    const view = poolView(pool, req.user.company_id);
    // which of your missions could actually fly on this, and why not
    view.candidates = mine.map(m => {
      const { ok, reasons } = compatibility(pool, m);
      return { id: m.id, reference: m.reference, ok, reasons };
    });
    return view;
  });

  res.json({ pools, missions: mine.map(m => ({ id: m.id, reference: m.reference })) });
});

app.post('/api/pools', requireJson, requireUser, (req, res) => {
  const { fields, values } = validatePool(req.body);
  if (Object.keys(fields).length) return res.status(400).json({ fields });

  const seed = missionById(values.missionId);
  if (!seed || seed.company_id !== req.user.company_id) {
    return res.status(400).json({ fields: { missionId: 'Choose one of your own missions.' } });
  }

  // The target comes from the seeding mission, so the creator is by definition
  // compatible with their own pool.
  const pool = createPool(req.user.id, req.user.company_id, {
    name: values.name,
    orbitType: seed.orbit_type,
    altitudeKm: seed.altitude_km,
    inclinationDeg: seed.inclination_deg,
    windowMonth: seed.window_month,
    capacityKg: values.capacityKg,
  });
  joinPool(pool.id, seed.id, req.user.id, req.user.company_id);

  res.status(201).json({ pool: poolView(pool, req.user.company_id) });
});

app.post('/api/pools/:id/join', requireJson, requireUser, (req, res) => {
  const pool = poolById(Number(req.params.id));
  if (!pool) return res.status(404).json({ error: 'Not found.' });
  if (isMember(pool.id, req.user.company_id)) return res.status(409).json({ error: 'You are already in this pool.' });

  const mission = missionById(Number(req.body.missionId));
  if (!mission || mission.company_id !== req.user.company_id) {
    return res.status(400).json({ error: 'Choose one of your own missions.' });
  }

  // Compatibility is physics, not preference — enforced here, not just in the UI.
  const { ok, reasons } = compatibility(pool, mission);
  if (!ok) return res.status(409).json({ error: reasons[0], reasons });

  joinPool(pool.id, mission.id, req.user.id, req.user.company_id);
  res.json({ pool: poolView(pool, req.user.company_id) });
});

app.post('/api/pools/:id/leave', requireJson, requireUser, (req, res) => {
  const pool = poolById(Number(req.params.id));
  if (!pool) return res.status(404).json({ error: 'Not found.' });
  leavePool(pool.id, req.user.company_id);
  res.json({ pool: poolView(pool, req.user.company_id) });
});

// ─── agents waitlist ────────────────────────────────────────────────────────
// Aether Agents is not built. The page collects interest, and the note field
// is the useful part — it says what people actually want an agent to do.

app.get('/api/waitlist', requireUser, (req, res) => {
  const entry = waitlistEntry(req.user.company_id);
  res.json({
    joined: Boolean(entry),
    note: entry?.note ?? '',
    joinedAt: entry ? new Date(entry.created_at).toISOString() : null,
  });
});

app.post('/api/waitlist', requireJson, requireUser, (req, res) => {
  const note = String(req.body.note ?? '').trim();
  if (note.length > 1000) return res.status(400).json({ fields: { note: 'Keep it under 1000 characters.' } });

  joinWaitlist(req.user.company_id, req.user.id, note);
  res.status(201).json({ joined: true, note });
});

app.delete('/api/waitlist', requireUser, (req, res) => {
  leaveWaitlist(req.user.company_id);
  res.status(204).end();
});

// ─── inbox ──────────────────────────────────────────────────────────────────
// One thread per pool the company belongs to. Introductions between a provider
// and an owner will land here too, once accepting a match is built.

app.get('/api/threads', requireUser, (req, res) => {
  const threads = threadsFor(req.user.company_id).map(pool => {
    const last = lastMessage(pool.id);
    const view = poolView(pool, req.user.company_id);
    return {
      id: pool.id,
      kind: 'pool',
      name: pool.name,
      context: `${view.orbitType} · ${view.altitudeKm} km · ${view.windowMonth}`,
      members: view.memberCount,
      unread: unreadCount(pool.id, req.user.company_id),
      last: last && {
        body: last.body,
        organisation: last.organisation,
        mine: last.company_id === req.user.company_id,
        at: new Date(last.created_at).toISOString(),
      },
      lastAt: last ? last.created_at : pool.created_at,
    };
  });

  // Alerts are a thread from Aether rather than a separate notification centre:
  // the inbox is already where a message about a launch would arrive.
  const hits = alertHits(req.user.company_id);
  if (hits.length) {
    const newest = hits[0];
    const refs = [...new Set(hits.map(h => h.missionRef))];
    threads.push({
      id: 'alerts',
      kind: 'alerts',
      name: 'Launch alerts',
      context: refs.length === 1 ? refs[0] : `${refs.length} satellites`,
      members: 0,
      unread: alertUnread(req.user.company_id),
      last: {
        body: `${newest.launch} matches ${newest.missionRef} — `
          + `${newest.spareKg} kg spare, ${newest.windowMonth}.`,
        organisation: 'Aether',
        mine: false,
        at: newest.at,
      },
      lastAt: newest.createdAt,
    });
  }

  threads.sort((a, b) => b.lastAt - a.lastAt);
  res.json({ threads, unreadTotal: threads.reduce((n, t) => n + t.unread, 0) });
});

// The alerts thread reads rather than converses, so it has its own detail route
// instead of pretending to be a pool.
app.get('/api/threads/alerts/detail', requireUser, (req, res) => {
  const hits = alertHits(req.user.company_id);
  markAlertsRead(req.user.company_id);
  res.json({ kind: 'alerts', name: 'Launch alerts', hits });
});

function ownThread(req, res) {
  const id = Number(req.params.id);
  const mine = threadsFor(req.user.company_id).some(p => p.id === id);
  if (!mine) {
    res.status(404).json({ error: 'Not found.' });
    return undefined;
  }
  return id;
}

app.get('/api/threads/:id', requireUser, (req, res) => {
  const id = ownThread(req, res);
  if (id === undefined) return;

  const messages = messagesFor(id).map(m => ({
    id: m.id,
    body: m.body,
    organisation: m.organisation,
    author: m.author || m.author_email,
    mine: m.company_id === req.user.company_id,
    at: new Date(m.created_at).toISOString(),
  }));
  markThreadRead(id, req.user.company_id);
  res.json({ messages });
});

// The context panel beside a conversation: what this group is actually about.
app.get('/api/threads/:id/detail', requireUser, (req, res) => {
  const id = ownThread(req, res);
  if (id === undefined) return;

  const pool = poolById(id);
  const view = poolView(pool, req.user.company_id);
  res.json({
    pool: {
      id: pool.id,
      name: pool.name,
      orbitType: view.orbitType,
      altitudeKm: view.altitudeKm,
      inclinationDeg: view.inclinationDeg,
      windowMonth: view.windowMonth,
      memberCount: view.memberCount,
      totalMassKg: view.totalMassKg,
      jurisdictions: view.jurisdictions,
      isLead: view.isLead,
      // members carry exact figures — that disclosure is what joining bought
      members: view.members ?? [],
    },
  });
});

app.post('/api/threads/:id', requireJson, requireUser, (req, res) => {
  const id = ownThread(req, res);
  if (id === undefined) return;

  const body = String(req.body.body ?? '').trim();
  if (!body) return res.status(400).json({ error: 'Write something first.' });
  if (body.length > 4000) return res.status(400).json({ error: 'That message is too long.' });

  postMessage(id, req.user.company_id, req.user.id, body);
  markThreadRead(id, req.user.company_id);
  res.status(201).json({ ok: true });
});

// ─── pages ──────────────────────────────────────────────────────────────────

// Where an account lands: its own inventory, or the company form if the
// profile is still empty.
const homeFor = user =>
  (SELLS_LAUNCH.has(user.account_type) ? '/my-launches' : '/missions');

app.get('/', (req, res, next) => {
  const user = currentUser(req);
  if (!user) return next();
  res.redirect(profileReady(user) ? homeFor(user) : '/profile?new=1');
});

app.get('/missions', (req, res) => {
  if (!currentUser(req)) return res.redirect('/');
  res.sendFile(join(root, 'public', 'missions.html'));
});

app.get('/join', (req, res) => {
  res.sendFile(join(root, 'public', 'join.html'));
});

app.get('/agents', (req, res) => {
  if (!currentUser(req)) return res.redirect('/');
  res.sendFile(join(root, 'public', 'agents.html'));
});

app.get('/messages', (req, res) => {
  if (!currentUser(req)) return res.redirect('/');
  res.sendFile(join(root, 'public', 'messages.html'));
});

app.get('/saved', (req, res) => {
  if (!currentUser(req)) return res.redirect('/');
  res.sendFile(join(root, 'public', 'saved.html'));
});

app.get('/settings', (req, res) => {
  if (!currentUser(req)) return res.redirect('/');
  res.sendFile(join(root, 'public', 'settings.html'));
});

app.get('/profile', (req, res) => {
  if (!currentUser(req)) return res.redirect('/');
  res.sendFile(join(root, 'public', 'profile.html'));
});

app.get('/launches', (req, res) => {
  if (!currentUser(req)) return res.redirect('/');
  res.sendFile(join(root, 'public', 'launches.html'));
});

app.get('/my-launches', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.redirect('/');
  if (!SELLS_LAUNCH.has(user.account_type)) return res.redirect('/missions');
  res.sendFile(join(root, 'public', 'my-launches.html'));
});

app.get('/pooling', (req, res) => {
  if (!currentUser(req)) return res.redirect('/');
  res.sendFile(join(root, 'public', 'pooling.html'));
});

app.get('/payloads', (req, res) => {
  if (!currentUser(req)) return res.redirect('/');
  res.sendFile(join(root, 'public', 'payloads.html'));
});

// no-cache, not no-store: the browser still revalidates cheaply with an ETag,
// but it can never serve a stale script after a deploy or an edit.
app.use(express.static(join(root, 'public'), {
  extensions: ['html'],
  setHeaders: res => res.set('Cache-Control', 'no-cache'),
}));

app.use((req, res) => res.status(404).json({ error: 'Not found.' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong.' });
});

app.listen(PORT, () => {
  console.log(`Launch Discovery running at http://localhost:${PORT}`);
});
