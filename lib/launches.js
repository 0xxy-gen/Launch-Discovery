import { db } from './db.js';
import { orbitLabel } from './mission-options.js';

// A launch is the supply-side object: a real flight with a date, a vehicle and
// spare capacity. Unlike a requirement it is a sales offering, so nothing here
// is banded — a provider wants it seen.
db.exec(`
  CREATE TABLE IF NOT EXISTS launches (
    id              INTEGER PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id      INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    name            TEXT    NOT NULL,
    vehicle         TEXT    NOT NULL,
    site            TEXT    NOT NULL,
    orbit_type      TEXT    NOT NULL,
    altitude_km     REAL    NOT NULL,
    inclination_deg REAL    NOT NULL,
    window_month    TEXT    NOT NULL,
    capacity_kg     REAL    NOT NULL,
    committed_kg    REAL    NOT NULL DEFAULT 0,
    notes           TEXT    NOT NULL DEFAULT '',
    status          TEXT    NOT NULL DEFAULT 'draft',
    created_at      INTEGER NOT NULL,
    published_at    INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_launches_user    ON launches(user_id);
  CREATE INDEX IF NOT EXISTS idx_launches_company ON launches(company_id);
  CREATE INDEX IF NOT EXISTS idx_launches_status ON launches(status);
`);

const stmt = {
  insert: db.prepare(`
    INSERT INTO launches (user_id, company_id, name, vehicle, site, orbit_type, altitude_km, inclination_deg,
                          window_month, capacity_kg, committed_kg, notes, status, created_at, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  update: db.prepare(`
    UPDATE launches SET name = ?, vehicle = ?, site = ?, orbit_type = ?, altitude_km = ?,
                        inclination_deg = ?, window_month = ?, capacity_kg = ?, committed_kg = ?, notes = ?
    WHERE id = ? AND company_id = ?`),
  setStatus: db.prepare(
    'UPDATE launches SET status = ?, published_at = ? WHERE id = ? AND company_id = ?'),
  byId:    db.prepare('SELECT * FROM launches WHERE id = ?'),
  byOwner: db.prepare('SELECT * FROM launches WHERE company_id = ? ORDER BY window_month'),
  remove:  db.prepare('DELETE FROM launches WHERE id = ? AND company_id = ?'),
};

const cols = l => [
  l.name, l.vehicle, l.site, l.orbitType, l.altitudeKm, l.inclinationDeg,
  l.windowMonth, l.capacityKg, l.committedKg, l.notes,
];

// `userId` records who listed it; `companyId` owns it.
export function createLaunch(userId, companyId, l, publish) {
  const now = Date.now();
  const info = stmt.insert.run(
    userId, companyId, ...cols(l), publish ? 'published' : 'draft', now, publish ? now : null);
  return stmt.byId.get(info.lastInsertRowid);
}

export function updateLaunch(companyId, id, l) {
  stmt.update.run(...cols(l), id, companyId);
  return stmt.byId.get(id);
}

export function setLaunchStatus(companyId, id, status) {
  stmt.setStatus.run(status, status === 'published' ? Date.now() : null, id, companyId);
  return stmt.byId.get(id);
}

export const launchById      = id => stmt.byId.get(id);
export const launchesForOwner = companyId => stmt.byOwner.all(companyId);
export const deleteLaunch    = (companyId, id) => stmt.remove.run(id, companyId).changes > 0;

export function browseLaunches(filter = {}) {
  const where = ["l.status = 'published'"];
  const params = [];

  if (filter.orbitType) { where.push('l.orbit_type = ?'); params.push(filter.orbitType); }
  if (filter.fromMonth) { where.push('l.window_month >= ?'); params.push(filter.fromMonth); }
  if (filter.toMonth)   { where.push('l.window_month <= ?'); params.push(filter.toMonth); }
  if (filter.minAvailable != null) {
    where.push('(l.capacity_kg - l.committed_kg) >= ?');
    params.push(filter.minAvailable);
  }

  return db.prepare(`
    SELECT l.*, c.name AS provider, c.country AS provider_country
    FROM launches l
    JOIN companies c ON c.id = l.company_id
    WHERE ${where.join(' AND ')}
    ORDER BY l.window_month
    LIMIT 200
  `).all(...params);
}

/** Supply is advertised, not redacted — the provider is named on purpose. */
export function launchView(l) {
  return {
    id: l.id,
    name: l.name,
    vehicle: l.vehicle,
    site: l.site,
    provider: l.provider ?? null,
    providerCountry: l.provider_country ?? null,
    orbitType: orbitLabel(l.orbit_type),
    altitudeKm: l.altitude_km,
    inclinationDeg: l.inclination_deg,
    windowMonth: l.window_month,
    capacityKg: l.capacity_kg,
    committedKg: l.committed_kg,
    availableKg: Math.max(0, l.capacity_kg - l.committed_kg),
    notes: l.notes,
  };
}

export const ownerLaunch = l => ({
  ...launchView(l),
  orbitTypeValue: l.orbit_type,
  status: l.status,
  publishedAt: l.published_at ? new Date(l.published_at).toISOString() : null,
});
