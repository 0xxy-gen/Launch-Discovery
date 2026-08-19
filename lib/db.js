import { DatabaseSync } from 'node:sqlite';
import { accountTypeLabel } from './account-types.js';
import { completeness } from './company-options.js';
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

  -- A company outlives whoever signed up: missions, launches and pools belong
  -- to it, and people come and go.
  CREATE TABLE IF NOT EXISTS companies (
    id           INTEGER PRIMARY KEY,
    name         TEXT    NOT NULL DEFAULT '',
    account_type TEXT    NOT NULL,
    country      TEXT    NOT NULL DEFAULT '',
    linkedin     TEXT    NOT NULL DEFAULT '',
    dial         TEXT    NOT NULL DEFAULT '',
    phone        TEXT    NOT NULL DEFAULT '',
    created_at   INTEGER NOT NULL
  );

  -- An invite is a one-time link. Only its hash is stored, like a session.
  CREATE TABLE IF NOT EXISTS invites (
    token_hash  TEXT    PRIMARY KEY,
    company_id  INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    email       TEXT    NOT NULL,
    invited_by  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  INTEGER NOT NULL,
    expires_at  INTEGER NOT NULL,
    accepted_at INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_invites_company ON invites(company_id);
`);

const columnsOf = table => db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
const addColumn = (table, name, decl) => {
  if (!columnsOf(table).includes(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${decl}`);
};

// Databases created before account_type existed get the column added in place.
addColumn('users', 'account_type', "TEXT NOT NULL DEFAULT ''");
addColumn('users', 'company_id', 'INTEGER REFERENCES companies(id) ON DELETE CASCADE');
addColumn('users', 'company_role', "TEXT NOT NULL DEFAULT 'admin'");
addColumn('users', 'name', "TEXT NOT NULL DEFAULT ''");
addColumn('users', 'first_name', "TEXT NOT NULL DEFAULT ''");
addColumn('users', 'last_name', "TEXT NOT NULL DEFAULT ''");

// Onboarding detail. All optional except entity type, which decides whether the
// funding question is even asked.
for (const [column, decl] of [
  ['website', "TEXT NOT NULL DEFAULT ''"],
  ['description', "TEXT NOT NULL DEFAULT ''"],
  ['entity_type', "TEXT NOT NULL DEFAULT ''"],
  ['incorporated_in', "TEXT NOT NULL DEFAULT ''"],
  ['size_band', "TEXT NOT NULL DEFAULT ''"],
  ['founded_year', 'INTEGER'],
  ['funding_stage', "TEXT NOT NULL DEFAULT ''"],
  ['flight_heritage', "TEXT NOT NULL DEFAULT ''"],
  ['export_regime', "TEXT NOT NULL DEFAULT ''"],
  ['applications', "TEXT NOT NULL DEFAULT ''"],
  ['logo', "TEXT NOT NULL DEFAULT ''"],
]) addColumn('companies', column, decl);

// Split any existing single name into first and last, once.
const unsplit = db.prepare("SELECT id, name FROM users WHERE name != '' AND first_name = ''").all();
if (unsplit.length) {
  const set = db.prepare('UPDATE users SET first_name = ?, last_name = ? WHERE id = ?');
  for (const u of unsplit) {
    const parts = u.name.trim().split(/\s+/);
    set.run(parts[0] ?? '', parts.slice(1).join(' '), u.id);
  }
  console.log(`split ${unsplit.length} name(s) into first and last`);
}

// One-time backfill: every account that predates companies becomes the admin
// of a company of one, carrying its own organisation details across.
const orphans = db.prepare('SELECT * FROM users WHERE company_id IS NULL').all();
if (orphans.length) {
  const insertCompany = db.prepare(`
    INSERT INTO companies (name, account_type, country, linkedin, dial, phone, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const attach = db.prepare("UPDATE users SET company_id = ?, company_role = 'admin' WHERE id = ?");
  for (const u of orphans) {
    const info = insertCompany.run(
      u.organisation ?? '', u.account_type, u.country ?? '',
      u.linkedin ?? '', u.dial ?? '', u.phone ?? '', u.created_at);
    attach.run(info.lastInsertRowid, u.id);
  }
  console.log(`migrated ${orphans.length} account(s) into companies`);
}

for (const table of ['missions', 'launches', 'pools']) {
  const exists = db.prepare(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
  if (!exists) continue;
  const ownerColumn = table === 'pools' ? 'created_by' : 'user_id';
  if (!columnsOf(table).includes('company_id')) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN company_id INTEGER`);
    db.exec(`UPDATE ${table} SET company_id =
             (SELECT company_id FROM users WHERE users.id = ${table}.${ownerColumn})`);
    console.log(`moved ${table} to company ownership`);
  }
}
if (db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='pool_members'").get()
    && !columnsOf('pool_members').includes('company_id')) {
  db.exec('ALTER TABLE pool_members ADD COLUMN company_id INTEGER');
  db.exec(`UPDATE pool_members SET company_id =
           (SELECT company_id FROM users WHERE users.id = pool_members.user_id)`);
  console.log('moved pool_members to company ownership');
}

const stmt = {
  insertUser: db.prepare(`
    INSERT INTO users (email, password_hash, account_type, organisation, role, country, linkedin, dial, phone, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  userByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  setName:     db.prepare('UPDATE users SET name = ? WHERE id = ?'),
  updateProfile: db.prepare(`
    UPDATE users SET organisation = ?, role = ?, country = ?, linkedin = ?, dial = ?, phone = ?
    WHERE id = ?`),
  userById:    db.prepare('SELECT * FROM users WHERE id = ?'),

  insertSession: db.prepare(
    'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'),
  sessionByHash: db.prepare('SELECT * FROM sessions WHERE token_hash = ? AND expires_at > ?'),
  deleteSession: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
  purgeExpired:  db.prepare('DELETE FROM sessions WHERE expires_at <= ?'),
};

// ── companies and their people ──────────────────────────────────────────────

const company = {
  insert: db.prepare(`
    INSERT INTO companies (name, account_type, country, linkedin, dial, phone, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`),
  byId: db.prepare('SELECT * FROM companies WHERE id = ?'),
  update: db.prepare(`
    UPDATE companies SET name = ?, country = ?, linkedin = ?, dial = ?, phone = ?,
                         website = ?, description = ?, entity_type = ?, incorporated_in = ?,
                         size_band = ?, founded_year = ?, funding_stage = ?,
                         flight_heritage = ?, export_regime = ?, applications = ?, logo = ?
    WHERE id = ?`),
  people: db.prepare(`
    SELECT id, email, name, first_name, last_name, role, company_role, created_at, linkedin, phone
    FROM users WHERE company_id = ? ORDER BY created_at`),
  attach: db.prepare('UPDATE users SET company_id = ?, company_role = ? WHERE id = ?'),
  detach: db.prepare('DELETE FROM users WHERE id = ? AND company_id = ?'),
  setPerson: db.prepare(`
    UPDATE users SET first_name = ?, last_name = ?, name = ?, role = ?,
                     linkedin = ?, dial = ?, phone = ?
    WHERE id = ?`),
  adminCount: db.prepare(
    "SELECT COUNT(*) AS n FROM users WHERE company_id = ? AND company_role = 'admin'"),
};

export function createCompany(accountType) {
  const info = company.insert.run('', accountType, '', '', '', '', Date.now());
  return company.byId.get(info.lastInsertRowid);
}

export const companyById = id => company.byId.get(id);
export const peopleOf = companyId => company.people.all(companyId);
export const attachUser = (userId, companyId, role) => company.attach.run(companyId, role, userId);
export const removePerson = (companyId, userId) => company.detach.run(userId, companyId).changes > 0;
// LinkedIn and a phone number belong to the person, not the company.
export const setPerson = (userId, p) =>
  company.setPerson.run(
    p.firstName, p.lastName, [p.firstName, p.lastName].filter(Boolean).join(' '),
    p.role, p.linkedin, p.dial, p.phone, userId);
export const adminCount = companyId => company.adminCount.get(companyId).n;

export function updateCompany(companyId, p) {
  company.update.run(
    p.organisation, p.country, '', '', '',
    p.website, p.description, p.entityType, p.incorporatedIn,
    p.sizeBand, p.foundedYear, p.fundingStage,
    p.flightHeritage, p.exportRegime, (p.applications ?? []).join(','), p.logo ?? '',
    companyId);
  return company.byId.get(companyId);
}

// ── invites ─────────────────────────────────────────────────────────────────

const invite = {
  insert: db.prepare(`
    INSERT INTO invites (token_hash, company_id, email, invited_by, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)`),
  byHash: db.prepare('SELECT * FROM invites WHERE token_hash = ? AND accepted_at IS NULL'),
  pending: db.prepare(
    'SELECT email, created_at, expires_at FROM invites WHERE company_id = ? AND accepted_at IS NULL'),
  accept: db.prepare('UPDATE invites SET accepted_at = ? WHERE token_hash = ?'),
  revoke: db.prepare('DELETE FROM invites WHERE company_id = ? AND email = ? AND accepted_at IS NULL'),
};

export function createInvite(tokenHash, companyId, email, invitedBy, ttlMs) {
  const now = Date.now();
  invite.insert.run(tokenHash, companyId, email, invitedBy, now, now + ttlMs);
}
export const findInvite = tokenHash => invite.byHash.get(tokenHash);
export const pendingInvites = companyId => invite.pending.all(companyId);
export const acceptInvite = tokenHash => invite.accept.run(Date.now(), tokenHash);
export const revokeInvite = (companyId, email) => invite.revoke.run(companyId, email).changes > 0;

export function createUser(u) {
  const info = stmt.insertUser.run(
    u.email, u.passwordHash, u.accountType, u.organisation, u.role,
    u.country, u.linkedin, u.dial, u.phone, Date.now());
  // `name` arrived with the company split, after the insert was written
  if (u.firstName || u.lastName) {
    company.setPerson.run(
      u.firstName ?? '', u.lastName ?? '',
      [u.firstName, u.lastName].filter(Boolean).join(' '),
      u.role ?? '', u.linkedin ?? '', u.dial ?? '', u.phone ?? '', info.lastInsertRowid);
  }
  return stmt.userById.get(info.lastInsertRowid);
}

export function updateProfile(userId, p) {
  stmt.updateProfile.run(p.organisation, p.role, p.country, p.linkedin, p.dial, p.phone, userId);
  return stmt.userById.get(userId);
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
// The person, merged with the company they act for. Field names are kept from
// before the split so the pages did not all have to change at once.
export function publicUser(u) {
  const c = company.byId.get(u.company_id) ?? {};
  return {
    email: u.email,
    name: u.name,
    firstName: u.first_name,
    lastName: u.last_name,
    role: u.role,
    companyId: u.company_id,
    companyRole: u.company_role,          // admin or member
    isAdmin: u.company_role === 'admin',
    accountType: c.account_type ?? u.account_type,
    accountTypeLabel: accountTypeLabel(c.account_type ?? u.account_type),
    organisation: c.name ?? '',
    country: c.country ?? '',
    linkedin: u.linkedin ?? '',
    dial: u.dial ?? '',
    phone: u.phone ?? '',
    website: c.website ?? '',
    description: c.description ?? '',
    entityType: c.entity_type ?? '',
    incorporatedIn: c.incorporated_in ?? '',
    sizeBand: c.size_band ?? '',
    foundedYear: c.founded_year ?? null,
    fundingStage: c.funding_stage ?? '',
    flightHeritage: c.flight_heritage ?? '',
    exportRegime: c.export_regime ?? '',
    applications: String(c.applications ?? '').split(',').filter(Boolean),
    logo: c.logo ?? '',
    completeness: completeness(c, u),
    // nothing can be published until the company says who and where it is
    // The minimum to publish: who you are, where you operate, what kind of body.
    profileComplete: Boolean(c.name && c.country && c.entity_type),
    createdAt: new Date(u.created_at).toISOString(),
  };
}
