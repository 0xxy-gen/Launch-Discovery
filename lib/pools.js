import { db } from './db.js';
import { orbitLabel } from './mission-options.js';
export { compatibility } from './compatibility.js';

db.exec(`
  CREATE TABLE IF NOT EXISTS pools (
    id              INTEGER PRIMARY KEY,
    created_by      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id      INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    name            TEXT    NOT NULL,
    orbit_type      TEXT    NOT NULL,
    altitude_km     REAL    NOT NULL,
    inclination_deg REAL    NOT NULL,
    window_month    TEXT    NOT NULL,
    capacity_kg     REAL    NOT NULL,
    created_at      INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS pool_members (
    pool_id    INTEGER NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
    mission_id INTEGER NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    joined_at  INTEGER NOT NULL,
    PRIMARY KEY (pool_id, mission_id)
  );

  CREATE INDEX IF NOT EXISTS idx_pool_members_user ON pool_members(user_id);
`);

// ── queries ─────────────────────────────────────────────────────────────────

const stmt = {
  insert: db.prepare(`
    INSERT INTO pools (created_by, company_id, name, orbit_type, altitude_km, inclination_deg,
                       window_month, capacity_kg, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  byId: db.prepare('SELECT * FROM pools WHERE id = ?'),
  all: db.prepare('SELECT * FROM pools ORDER BY created_at DESC LIMIT 200'),
  addMember: db.prepare(`
    INSERT INTO pool_members (pool_id, mission_id, user_id, company_id, joined_at)
    VALUES (?, ?, ?, ?, ?)`),
  removeMember: db.prepare('DELETE FROM pool_members WHERE pool_id = ? AND company_id = ?'),
  members: db.prepare(`
    SELECT pm.*, m.reference, m.payload_mass_kg, m.altitude_km, m.inclination_deg,
           m.window_month, m.form_factor, m.propulsion,
           c.name AS organisation, c.country
    FROM pool_members pm
    JOIN missions m  ON m.id = pm.mission_id
    JOIN companies c ON c.id = pm.company_id
    WHERE pm.pool_id = ?
    ORDER BY pm.joined_at`),
  isMember: db.prepare('SELECT 1 FROM pool_members WHERE pool_id = ? AND company_id = ?'),
};

export function createPool(userId, companyId, p) {
  const info = stmt.insert.run(
    userId, companyId, p.name, p.orbitType, p.altitudeKm, p.inclinationDeg,
    p.windowMonth, p.capacityKg, Date.now());
  return stmt.byId.get(info.lastInsertRowid);
}

export const poolById   = id => stmt.byId.get(id);
export const allPools   = () => stmt.all.all();
export const poolMembers = poolId => stmt.members.all(poolId);
export const isMember   = (poolId, companyId) => Boolean(stmt.isMember.get(poolId, companyId));
export const joinPool   = (poolId, missionId, userId, companyId) =>
  stmt.addMember.run(poolId, missionId, userId, companyId, Date.now());
export const leavePool  = (poolId, companyId) => stmt.removeMember.run(poolId, companyId).changes > 0;

/** Everyone sees the target and the running total. Only members see who is in it. */
export function poolView(pool, viewerCompanyId) {
  const members = poolMembers(pool.id);
  const totalMassKg = members.reduce((sum, m) => sum + m.payload_mass_kg, 0);
  const viewerIsMember = members.some(m => m.company_id === viewerCompanyId);

  const view = {
    id: pool.id,
    name: pool.name,
    orbitType: orbitLabel(pool.orbit_type),
    altitudeKm: pool.altitude_km,
    inclinationDeg: pool.inclination_deg,
    windowMonth: pool.window_month,
    capacityKg: pool.capacity_kg,
    memberCount: members.length,
    totalMassKg,
    // jurisdictions are visible to everyone: a mixed pool can be a legal
    // problem rather than a commercial one, and people should see it early
    jurisdictions: [...new Set(members.map(m => m.country).filter(Boolean))],
    isMember: viewerIsMember,
    isLead: pool.company_id === viewerCompanyId,
    createdAt: new Date(pool.created_at).toISOString(),
  };

  // Joining trades anonymity for coordination — members see each other exactly.
  if (viewerIsMember) {
    view.members = members.map(m => ({
      organisation: m.organisation,
      country: m.country,
      reference: m.reference,
      payloadMassKg: m.payload_mass_kg,
      altitudeKm: m.altitude_km,
      inclinationDeg: m.inclination_deg,
      windowMonth: m.window_month,
      isYou: m.company_id === viewerCompanyId,
    }));
  }
  return view;
}
