import { db } from './db.js';

db.exec(`
  CREATE TABLE IF NOT EXISTS missions (
    id               INTEGER PRIMARY KEY,
    user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id       INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    reference        TEXT    NOT NULL,
    orbit_type       TEXT    NOT NULL,
    altitude_km      REAL    NOT NULL,
    inclination_deg  REAL    NOT NULL,
    payload_mass_kg  REAL    NOT NULL,
    window_month     TEXT    NOT NULL,
    ride_type        TEXT    NOT NULL,
    form_factor      TEXT    NOT NULL,
    propulsion       INTEGER NOT NULL DEFAULT 0,
    constellation_id INTEGER REFERENCES constellations(id) ON DELETE SET NULL,
    notes            TEXT    NOT NULL DEFAULT '',
    status           TEXT    NOT NULL DEFAULT 'draft',
    created_at       INTEGER NOT NULL,
    published_at     INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_missions_user    ON missions(user_id);
  CREATE INDEX IF NOT EXISTS idx_missions_company ON missions(company_id);
  CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status);
`);

const stmt = {
  insert: db.prepare(`
    INSERT INTO missions (user_id, company_id, reference, orbit_type, altitude_km, inclination_deg,
                          payload_mass_kg, window_month, ride_type, form_factor,
                          propulsion, notes, status, created_at, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  update: db.prepare(`
    UPDATE missions SET reference = ?, orbit_type = ?, altitude_km = ?, inclination_deg = ?,
                        payload_mass_kg = ?, window_month = ?, ride_type = ?, form_factor = ?,
                        propulsion = ?, notes = ?
    WHERE id = ? AND company_id = ?`),
  setStatus: db.prepare(
    'UPDATE missions SET status = ?, published_at = ? WHERE id = ? AND company_id = ?'),
  byId:     db.prepare('SELECT * FROM missions WHERE id = ?'),
  byOwner:  db.prepare('SELECT * FROM missions WHERE company_id = ? ORDER BY created_at DESC'),
  remove:   db.prepare('DELETE FROM missions WHERE id = ? AND company_id = ?'),
  countFor: db.prepare('SELECT COUNT(*) AS n FROM missions WHERE company_id = ?'),
};

const cols = m => [
  m.reference, m.orbitType, m.altitudeKm, m.inclinationDeg, m.payloadMassKg,
  m.windowMonth, m.rideType, m.formFactor, m.propulsion ? 1 : 0, m.notes,
];

// `userId` records who typed it; `companyId` owns it.
export function createMission(userId, companyId, m, publish) {
  const now = Date.now();
  const info = stmt.insert.run(
    userId, companyId, ...cols(m), publish ? 'published' : 'draft', now, publish ? now : null);
  return stmt.byId.get(info.lastInsertRowid);
}

export function updateMission(companyId, id, m) {
  stmt.update.run(...cols(m), id, companyId);
  return stmt.byId.get(id);
}

export function setMissionStatus(companyId, id, status) {
  stmt.setStatus.run(status, status === 'published' ? Date.now() : null, id, companyId);
  return stmt.byId.get(id);
}

// Published requirements belonging to everyone else. Filters are whitelisted
// and bound as parameters — none of the query is built from raw input.
export function browsePublished(viewerCompanyId, filter = {}) {
  const where = ["m.status = 'published'", 'm.company_id != ?'];
  const params = [viewerCompanyId];

  const eq = (column, value) => {
    if (!value) return;
    where.push(`m.${column} = ?`);
    params.push(value);
  };
  eq('orbit_type', filter.orbitType);
  eq('ride_type', filter.rideType);
  eq('form_factor', filter.formFactor);

  if (filter.massMin != null) { where.push('m.payload_mass_kg >= ?'); params.push(filter.massMin); }
  if (filter.massMax != null) { where.push('m.payload_mass_kg <= ?'); params.push(filter.massMax); }
  if (filter.fromMonth) { where.push('m.window_month >= ?'); params.push(filter.fromMonth); }
  if (filter.toMonth) { where.push('m.window_month <= ?'); params.push(filter.toMonth); }

  return db.prepare(`
    SELECT m.*, c.country AS owner_country
    FROM missions m
    JOIN companies c ON c.id = m.company_id
    WHERE ${where.join(' AND ')}
    ORDER BY m.published_at DESC
    LIMIT 200
  `).all(...params);
}

// A constellation is N near-identical satellites, so the second one onwards is
// a copy with a bumped name rather than a form filled in again.
export function duplicateMission(userId, companyId, source, reference) {
  const info = stmt.insert.run(
    userId, companyId, reference, source.orbit_type, source.altitude_km, source.inclination_deg,
    source.payload_mass_kg, source.window_month, source.ride_type, source.form_factor,
    source.propulsion, source.notes, 'draft', Date.now(), null);
  const copy = stmt.byId.get(info.lastInsertRowid);
  if (source.constellation_id) {
    db.prepare('UPDATE missions SET constellation_id = ? WHERE id = ?')
      .run(source.constellation_id, copy.id);
  }
  return stmt.byId.get(copy.id);
}

/** Aurora-2 becomes Aurora-3; Aurora becomes Aurora 2. */
export function nextReference(existing, base) {
  const match = base.match(/^(.*?)(\d+)$/);
  const stem = match ? match[1] : `${base} `;
  let n = match ? Number(match[2]) + 1 : 2;
  const taken = new Set(existing);
  while (taken.has(`${stem}${n}`)) n += 1;
  return `${stem}${n}`;
}

export const missionById      = id => stmt.byId.get(id);
export const missionsForOwner = companyId => stmt.byOwner.all(companyId);
export const deleteMission    = (companyId, id) => stmt.remove.run(id, companyId).changes > 0;
export const missionCount     = companyId => stmt.countFor.get(companyId).n;
