import express from 'express';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { COUNTRIES } from './lib/countries.js';
import { ACCOUNT_TYPES } from './lib/account-types.js';
import { ORBIT_TYPES, RIDE_TYPES, FORM_FACTORS } from './lib/mission-options.js';
import { ownerMission, previewMission, publicMission } from './lib/banding.js';
import {
  createPool, poolById, allPools, poolView, joinPool, leavePool, isMember,
} from './lib/pools.js';
import { compatibility } from './lib/compatibility.js';
import {
  createLaunch, updateLaunch, setLaunchStatus, launchById, launchesForOwner,
  deleteLaunch, browseLaunches, launchView, ownerLaunch,
} from './lib/launches.js';
import {
  createMission, updateMission, setMissionStatus,
  missionById, missionsForOwner, deleteMission, browsePublished,
} from './lib/missions.js';
import {
  validateRegistration, validateLogin, validateMission, validateProfile, validatePool, validateLaunch,
} from './lib/validate.js';
import { hashPassword, verifyPassword, newSessionToken, hashToken } from './lib/auth.js';
import {
  createUser, findUserByEmail, createSession, findSessionUser,
  deleteSession, purgeExpiredSessions, publicUser, updateProfile,
} from './lib/db.js';

const root = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3100);
const SESSION_TTL = 1000 * 60 * 60 * 24 * 14;   // 14 days
const COOKIE = 'ld_session';
const SECURE_COOKIES = process.env.NODE_ENV === 'production';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));

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
  });
});

app.get('/api/me', (req, res) => {
  const token = readCookie(req, COOKIE);
  const user = token && findSessionUser(hashToken(token));
  if (!user) return res.status(401).json({ error: 'Not signed in.' });
  res.json({ user: publicUser(user) });
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

    const user = createUser({
      email: values.email,
      passwordHash: await hashPassword(values.password),
      accountType: values.accountType,
      organisation: '', role: '', country: '', linkedin: '', dial: '', phone: '',
    });

    const token = newSessionToken();
    createSession(hashToken(token), user.id, SESSION_TTL);
    setSessionCookie(res, token);
    res.status(201).json({ user: publicUser(user) });
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

// ─── missions ───────────────────────────────────────────────────────────────

function currentUser(req) {
  const token = readCookie(req, COOKIE);
  return token ? findSessionUser(hashToken(token)) : undefined;
}

function requireUser(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'Not signed in.' });
  req.user = user;
  next();
}

// Ownership is checked on every mission route: the id in the URL is never
// trusted on its own, only rows belonging to the signed-in account are touched.
function ownedMission(req, res) {
  const mission = missionById(Number(req.params.id));
  if (!mission || mission.user_id !== req.user.id) {
    res.status(404).json({ error: 'Not found.' });
    return undefined;
  }
  return mission;
}

app.put('/api/profile', requireJson, requireUser, (req, res) => {
  const { fields, values } = validateProfile(req.body);
  if (Object.keys(fields).length) return res.status(400).json({ fields });
  res.json({ user: publicUser(updateProfile(req.user.id, values)) });
});

// Browsing other people's demand is competitor intelligence, which is the
// exact leak the banding exists to prevent — so the supply side only.
const CAN_BROWSE = new Set(['launch_provider', 'broker']);
const canBrowse = user => CAN_BROWSE.has(user.account_type);

app.get('/api/payloads', requireUser, (req, res) => {
  if (!canBrowse(req.user)) return res.status(403).json({ error: 'Not available on this account.' });

  const q = req.query;
  const num = v => (v === undefined || v === '' ? null : Number(v));
  const rows = browsePublished(req.user.id, {
    orbitType: q.orbit, rideType: q.ride, formFactor: q.form,
    massMin: num(q.massMin), massMax: num(q.massMax),
    fromMonth: q.from, toMonth: q.to,
  });

  // Only ever the banded view — the exact figures are not in this response.
  res.json({ payloads: rows.map(m => publicMission(m, { country: m.owner_country })) });
});

app.get('/api/missions', requireUser, (req, res) => {
  const missions = missionsForOwner(req.user.id).map(m => ownerMission(m, req.user));
  res.json({ missions });
});

// Drives the "what providers see" panel as the form is typed into.
app.post('/api/missions/preview', requireJson, requireUser, (req, res) => {
  const { fields, values } = validateMission(req.body);
  res.json({ preview: previewMission(values, fields, req.user) });
});

// A published requirement carries the owner's jurisdiction, so it cannot go
// out before the profile says what that is.
const profileReady = user => Boolean(user.organisation && user.country);
const NEEDS_PROFILE = { error: 'Add your organisation and country before publishing.', needsProfile: true };

app.post('/api/missions', requireJson, requireUser, (req, res) => {
  const { fields, values } = validateMission(req.body);
  if (Object.keys(fields).length) return res.status(400).json({ fields });

  const publish = req.body.publish === true;
  if (publish && !profileReady(req.user)) return res.status(409).json(NEEDS_PROFILE);

  const mission = createMission(req.user.id, values, publish);
  res.status(201).json({ mission: ownerMission(mission, req.user) });
});

app.put('/api/missions/:id', requireJson, requireUser, (req, res) => {
  if (!ownedMission(req, res)) return;

  const { fields, values } = validateMission(req.body);
  if (Object.keys(fields).length) return res.status(400).json({ fields });

  const mission = updateMission(req.user.id, Number(req.params.id), values);
  res.json({ mission: ownerMission(mission, req.user) });
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
  const mission = setMissionStatus(req.user.id, Number(req.params.id), status);
  res.json({ mission: ownerMission(mission, req.user) });
});

app.delete('/api/missions/:id', requireUser, (req, res) => {
  if (!ownedMission(req, res)) return;
  deleteMission(req.user.id, Number(req.params.id));
  res.status(204).end();
});

// ─── launches ───────────────────────────────────────────────────────────────
// Supply is advertised rather than redacted, so the directory is open to every
// signed-in account and the provider is named on purpose.

app.get('/api/launches', requireUser, (req, res) => {
  const q = req.query;
  const num = v => (v === undefined || v === '' ? null : Number(v));
  const rows = browseLaunches({
    orbitType: q.orbit, fromMonth: q.from, toMonth: q.to, minAvailable: num(q.minAvailable),
  });

  // for a payload owner, which of their missions could actually fly on each
  const mine = missionsForOwner(req.user.id);
  const launches = rows.map(l => ({
    ...launchView(l),
    candidates: mine.map(m => {
      const { ok, reasons } = compatibility(l, m);
      return { id: m.id, reference: m.reference, mass: m.payload_mass_kg, ok, reasons };
    }),
  }));

  res.json({ launches });
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
  if (!launch || launch.user_id !== req.user.id) {
    res.status(404).json({ error: 'Not found.' });
    return undefined;
  }
  return launch;
}

app.get('/api/my-launches', requireUser, requireProvider, (req, res) => {
  res.json({ launches: launchesForOwner(req.user.id).map(ownerLaunch) });
});

app.post('/api/my-launches', requireJson, requireUser, requireProvider, (req, res) => {
  const { fields, values } = validateLaunch(req.body);
  if (Object.keys(fields).length) return res.status(400).json({ fields });

  const publish = req.body.publish === true;
  if (publish && !profileReady(req.user)) return res.status(409).json(NEEDS_PROFILE);

  res.status(201).json({ launch: ownerLaunch(createLaunch(req.user.id, values, publish)) });
});

app.put('/api/my-launches/:id', requireJson, requireUser, requireProvider, (req, res) => {
  if (!ownedLaunch(req, res)) return;
  const { fields, values } = validateLaunch(req.body);
  if (Object.keys(fields).length) return res.status(400).json({ fields });
  res.json({ launch: ownerLaunch(updateLaunch(req.user.id, Number(req.params.id), values)) });
});

app.post('/api/my-launches/:id/status', requireJson, requireUser, requireProvider, (req, res) => {
  if (!ownedLaunch(req, res)) return;
  const status = req.body.status;
  if (status !== 'published' && status !== 'draft') {
    return res.status(400).json({ error: 'Status must be draft or published.' });
  }
  if (status === 'published' && !profileReady(req.user)) return res.status(409).json(NEEDS_PROFILE);
  res.json({ launch: ownerLaunch(setLaunchStatus(req.user.id, Number(req.params.id), status)) });
});

app.delete('/api/my-launches/:id', requireUser, requireProvider, (req, res) => {
  if (!ownedLaunch(req, res)) return;
  deleteLaunch(req.user.id, Number(req.params.id));
  res.status(204).end();
});

// ─── pooling ────────────────────────────────────────────────────────────────
// Owners coordinating with each other, which is the one place the anonymity
// model inverts — so it is opt-in, and only members see who is inside.

const CAN_POOL = new Set(['payload_owner', 'broker']);
const canPool = user => CAN_POOL.has(user.account_type);

function requirePooling(req, res, next) {
  if (!canPool(req.user)) return res.status(403).json({ error: 'Not available on this account.' });
  next();
}

app.get('/api/pools', requireUser, requirePooling, (req, res) => {
  const mine = missionsForOwner(req.user.id);

  const pools = allPools().map(pool => {
    const view = poolView(pool, req.user.id);
    // which of your missions could actually fly on this, and why not
    view.candidates = mine.map(m => {
      const { ok, reasons } = compatibility(pool, m);
      return { id: m.id, reference: m.reference, ok, reasons };
    });
    return view;
  });

  res.json({ pools, missions: mine.map(m => ({ id: m.id, reference: m.reference })) });
});

app.post('/api/pools', requireJson, requireUser, requirePooling, (req, res) => {
  const { fields, values } = validatePool(req.body);
  if (Object.keys(fields).length) return res.status(400).json({ fields });

  const seed = missionById(values.missionId);
  if (!seed || seed.user_id !== req.user.id) {
    return res.status(400).json({ fields: { missionId: 'Choose one of your own missions.' } });
  }

  // The target comes from the seeding mission, so the creator is by definition
  // compatible with their own pool.
  const pool = createPool(req.user.id, {
    name: values.name,
    orbitType: seed.orbit_type,
    altitudeKm: seed.altitude_km,
    inclinationDeg: seed.inclination_deg,
    windowMonth: seed.window_month,
    capacityKg: values.capacityKg,
  });
  joinPool(pool.id, seed.id, req.user.id);

  res.status(201).json({ pool: poolView(pool, req.user.id) });
});

app.post('/api/pools/:id/join', requireJson, requireUser, requirePooling, (req, res) => {
  const pool = poolById(Number(req.params.id));
  if (!pool) return res.status(404).json({ error: 'Not found.' });
  if (isMember(pool.id, req.user.id)) return res.status(409).json({ error: 'You are already in this pool.' });

  const mission = missionById(Number(req.body.missionId));
  if (!mission || mission.user_id !== req.user.id) {
    return res.status(400).json({ error: 'Choose one of your own missions.' });
  }

  // Compatibility is physics, not preference — enforced here, not just in the UI.
  const { ok, reasons } = compatibility(pool, mission);
  if (!ok) return res.status(409).json({ error: reasons[0], reasons });

  joinPool(pool.id, mission.id, req.user.id);
  res.json({ pool: poolView(pool, req.user.id) });
});

app.post('/api/pools/:id/leave', requireJson, requireUser, requirePooling, (req, res) => {
  const pool = poolById(Number(req.params.id));
  if (!pool) return res.status(404).json({ error: 'Not found.' });
  leavePool(pool.id, req.user.id);
  res.json({ pool: poolView(pool, req.user.id) });
});

// ─── pages ──────────────────────────────────────────────────────────────────

app.get('/', (req, res, next) => {
  if (currentUser(req)) return res.redirect('/missions');
  next();
});

app.get('/missions', (req, res) => {
  if (!currentUser(req)) return res.redirect('/');
  res.sendFile(join(root, 'public', 'missions.html'));
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
  const user = currentUser(req);
  if (!user) return res.redirect('/');
  if (!canPool(user)) return res.redirect('/missions');
  res.sendFile(join(root, 'public', 'pooling.html'));
});

app.get('/payloads', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.redirect('/');
  if (!canBrowse(user)) return res.redirect('/missions');
  res.sendFile(join(root, 'public', 'payloads.html'));
});

app.use(express.static(join(root, 'public'), { extensions: ['html'] }));

app.use((req, res) => res.status(404).json({ error: 'Not found.' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong.' });
});

app.listen(PORT, () => {
  console.log(`Launch Discovery running at http://localhost:${PORT}`);
});
