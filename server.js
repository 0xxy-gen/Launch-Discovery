import express from 'express';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { COUNTRIES } from './lib/countries.js';
import { validateRegistration, validateLogin } from './lib/validate.js';
import { hashPassword, verifyPassword, newSessionToken, hashToken } from './lib/auth.js';
import {
  createUser, findUserByEmail, createSession, findSessionUser,
  deleteSession, purgeExpiredSessions, publicUser,
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

app.get('/api/countries', (req, res) => {
  res.set('Cache-Control', 'public, max-age=86400');
  res.json({ countries: COUNTRIES });
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
      organisation: values.organisation,
      role: values.role,
      country: values.country,
      linkedin: values.linkedin,
      dial: values.dial,
      phone: values.phone,
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

app.use(express.static(join(root, 'public'), { extensions: ['html'] }));

app.use((req, res) => res.status(404).json({ error: 'Not found.' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong.' });
});

app.listen(PORT, () => {
  console.log(`Launch Discovery running at http://localhost:${PORT}`);
});
