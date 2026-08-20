import { db } from './db.js';
import { orbitLabel } from './mission-options.js';

// A launch is the supply-side object: a real flight with a date, a vehicle and
// spare capacity. Unlike a requirement it is a sales offering, so nothing here
// is banded — a provider wants it seen.

const stmt = {
  insert: db.prepare(`
    INSERT INTO launches (user_id, company_id, name, vehicle, operator, site, orbit_type, altitude_km,
                          inclination_deg, window_month, capacity_kg, committed_kg, notes,
                          status, created_at, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  update: db.prepare(`
    UPDATE launches SET name = ?, vehicle = ?, operator = ?, site = ?, orbit_type = ?, altitude_km = ?,
                        inclination_deg = ?, window_month = ?, capacity_kg = ?, committed_kg = ?, notes = ?
    WHERE id = ? AND company_id = ?`),
  setStatus: db.prepare(
    'UPDATE launches SET status = ?, published_at = ? WHERE id = ? AND company_id = ?'),
  byId:    db.prepare('SELECT * FROM launches WHERE id = ?'),
  byOwner: db.prepare('SELECT * FROM launches WHERE company_id = ? ORDER BY window_month'),
  remove:  db.prepare('DELETE FROM launches WHERE id = ? AND company_id = ?'),
};

const cols = l => [
  l.name, l.vehicle, l.operator ?? '', l.site, l.orbitType, l.altitudeKm, l.inclinationDeg,
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
  if (filter.country) { where.push('u.country = ?'); params.push(filter.country); }

  return db.prepare(`
    SELECT l.*, u.name AS provider, u.country AS provider_country
    FROM launches l
    JOIN companies u ON u.id = l.company_id
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
    // the seller you would contact, and — when they differ — whose vehicle it is
    provider: l.provider ?? null,
    providerCountry: l.provider_country ?? null,
    operator: l.operator || null,
    resold: Boolean(l.operator && l.operator !== (l.provider ?? '')),
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

/** The provider countries that actually have published launches, so the filter
 *  never offers an option with nothing behind it. */
export const launchCountries = () => db.prepare(`
  SELECT c.country AS country, COUNT(*) AS n
  FROM launches l
  JOIN companies c ON c.id = l.company_id
  WHERE l.status = 'published' AND c.country != ''
  GROUP BY c.country
  ORDER BY c.country
`).all();
