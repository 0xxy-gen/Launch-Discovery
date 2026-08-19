import { db } from './db.js';

db.exec(`
  CREATE TABLE IF NOT EXISTS missions (
    id               INTEGER PRIMARY KEY,
    user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reference        TEXT    NOT NULL,
    orbit_type       TEXT    NOT NULL,
    altitude_km      REAL    NOT NULL,
    inclination_deg  REAL    NOT NULL,
    payload_mass_kg  REAL    NOT NULL,
    window_month     TEXT    NOT NULL,
    ride_type        TEXT    NOT NULL,
    form_factor      TEXT    NOT NULL,
    propulsion       INTEGER NOT NULL DEFAULT 0,
    notes            TEXT    NOT NULL DEFAULT '',
    status           TEXT    NOT NULL DEFAULT 'draft',
    created_at       INTEGER NOT NULL,
    published_at     INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_missions_user   ON missions(user_id);
  CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status);
`);

const stmt = {
  insert: db.prepare(`
    INSERT INTO missions (user_id, reference, orbit_type, altitude_km, inclination_deg,
                          payload_mass_kg, window_month, ride_type, form_factor,
                          propulsion, notes, status, created_at, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  update: db.prepare(`
    UPDATE missions SET reference = ?, orbit_type = ?, altitude_km = ?, inclination_deg = ?,
                        payload_mass_kg = ?, window_month = ?, ride_type = ?, form_factor = ?,
                        propulsion = ?, notes = ?
    WHERE id = ? AND user_id = ?`),
  setStatus: db.prepare(
    'UPDATE missions SET status = ?, published_at = ? WHERE id = ? AND user_id = ?'),
  byId:     db.prepare('SELECT * FROM missions WHERE id = ?'),
  byOwner:  db.prepare('SELECT * FROM missions WHERE user_id = ? ORDER BY created_at DESC'),
  remove:   db.prepare('DELETE FROM missions WHERE id = ? AND user_id = ?'),
  countFor: db.prepare('SELECT COUNT(*) AS n FROM missions WHERE user_id = ?'),
};

const cols = m => [
  m.reference, m.orbitType, m.altitudeKm, m.inclinationDeg, m.payloadMassKg,
  m.windowMonth, m.rideType, m.formFactor, m.propulsion ? 1 : 0, m.notes,
];

export function createMission(userId, m, publish) {
  const now = Date.now();
  const info = stmt.insert.run(
    userId, ...cols(m), publish ? 'published' : 'draft', now, publish ? now : null);
  return stmt.byId.get(info.lastInsertRowid);
}

export function updateMission(userId, id, m) {
  stmt.update.run(...cols(m), id, userId);
  return stmt.byId.get(id);
}

export function setMissionStatus(userId, id, status) {
  stmt.setStatus.run(status, status === 'published' ? Date.now() : null, id, userId);
  return stmt.byId.get(id);
}

export const missionById      = id => stmt.byId.get(id);
export const missionsForOwner = userId => stmt.byOwner.all(userId);
export const deleteMission    = (userId, id) => stmt.remove.run(id, userId).changes > 0;
export const missionCount     = userId => stmt.countFor.get(userId).n;
