import { DatabaseSync } from 'node:sqlite';
import { accountTypeLabel } from './account-types.js';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = process.env.DB_FILE ?? join(root, 'data', 'app.db');

mkdirSync(dirname(file), { recursive: true });

export const db = new DatabaseSync(file);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY,
    email         TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    account_type  TEXT    NOT NULL DEFAULT '',
    organisation  TEXT    NOT NULL,
    role          TEXT    NOT NULL,
    country       TEXT    NOT NULL,
    linkedin      TEXT    NOT NULL DEFAULT '',
    dial          TEXT    NOT NULL,
    phone         TEXT    NOT NULL,
    created_at    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT    PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user    ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
`);

// Databases created before account_type existed get the column added in place.
const columns = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
if (!columns.includes('account_type')) {
  db.exec("ALTER TABLE users ADD COLUMN account_type TEXT NOT NULL DEFAULT ''");
}

const stmt = {
  insertUser: db.prepare(`
    INSERT INTO users (email, password_hash, account_type, organisation, role, country, linkedin, dial, phone, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  userByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  userById:    db.prepare('SELECT * FROM users WHERE id = ?'),

  insertSession: db.prepare(
    'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'),
  sessionByHash: db.prepare('SELECT * FROM sessions WHERE token_hash = ? AND expires_at > ?'),
  deleteSession: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
  purgeExpired:  db.prepare('DELETE FROM sessions WHERE expires_at <= ?'),
};

export function createUser(u) {
  const info = stmt.insertUser.run(
    u.email, u.passwordHash, u.accountType, u.organisation, u.role,
    u.country, u.linkedin, u.dial, u.phone, Date.now());
  return stmt.userById.get(info.lastInsertRowid);
}

export const findUserByEmail = email => stmt.userByEmail.get(email);
export const findUserById    = id    => stmt.userById.get(id);

export function createSession(tokenHash, userId, ttlMs) {
  const now = Date.now();
  stmt.insertSession.run(tokenHash, userId, now, now + ttlMs);
}

export function findSessionUser(tokenHash) {
  const session = stmt.sessionByHash.get(tokenHash, Date.now());
  return session ? stmt.userById.get(session.user_id) : undefined;
}

export const deleteSession = tokenHash => stmt.deleteSession.run(tokenHash);
export const purgeExpiredSessions = () => stmt.purgeExpired.run(Date.now());

// What the client is allowed to see — never the password hash.
export const publicUser = u => ({
  email: u.email,
  accountType: u.account_type,
  accountTypeLabel: accountTypeLabel(u.account_type),
  organisation: u.organisation,
  role: u.role,
  country: u.country,
  linkedin: u.linkedin,
  dial: u.dial,
  phone: u.phone,
  createdAt: new Date(u.created_at).toISOString(),
});
