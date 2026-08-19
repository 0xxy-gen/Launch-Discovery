import { db } from './db.js';

// Satellites are rarely procured one at a time. A constellation groups the
// missions that belong to one programme, usually the same shell flown across
// several planes, so an owner can see and price them together.

const columns = db.prepare('PRAGMA table_info(missions)').all().map(c => c.name);
if (!columns.includes('constellation_id')) {
  db.exec('ALTER TABLE missions ADD COLUMN constellation_id INTEGER REFERENCES constellations(id) ON DELETE SET NULL');
}

const stmt = {
  insert: db.prepare(
    'INSERT INTO constellations (company_id, name, notes, created_at) VALUES (?, ?, ?, ?)'),
  byId: db.prepare('SELECT * FROM constellations WHERE id = ?'),
  byCompany: db.prepare('SELECT * FROM constellations WHERE company_id = ? ORDER BY created_at'),
  update: db.prepare('UPDATE constellations SET name = ?, notes = ? WHERE id = ? AND company_id = ?'),
  remove: db.prepare('DELETE FROM constellations WHERE id = ? AND company_id = ?'),
  assign: db.prepare('UPDATE missions SET constellation_id = ? WHERE id = ? AND company_id = ?'),
};

export function createConstellation(companyId, name, notes = '') {
  const info = stmt.insert.run(companyId, name, notes, Date.now());
  return stmt.byId.get(info.lastInsertRowid);
}

export const constellationById = id => stmt.byId.get(id);
export const constellationsFor = companyId => stmt.byCompany.all(companyId);
export const renameConstellation = (companyId, id, name, notes) =>
  stmt.update.run(name, notes, id, companyId).changes > 0;
export const assignMission = (companyId, missionId, constellationId) =>
  stmt.assign.run(constellationId, missionId, companyId).changes > 0;

// Deleting the group must not delete the missions in it — ON DELETE SET NULL
// on the column returns them to the ungrouped list.
export const deleteConstellation = (companyId, id) => stmt.remove.run(id, companyId).changes > 0;

/** A constellation is only meaningful as the shape of the missions inside it. */
export function summarise(missions) {
  if (!missions.length) return null;

  const range = (values, unit, digits = 0) => {
    const lo = Math.min(...values), hi = Math.max(...values);
    return lo === hi ? `${lo.toFixed(digits)}${unit}` : `${lo.toFixed(digits)}–${hi.toFixed(digits)}${unit}`;
  };
  const windows = missions.map(m => m.windowMonth).sort();

  return {
    count: missions.length,
    totalMassKg: missions.reduce((sum, m) => sum + m.payloadMassKg, 0),
    altitude: range(missions.map(m => m.altitudeKm), ' km'),
    inclination: range(missions.map(m => m.inclinationDeg), '°', 1),
    window: windows[0] === windows.at(-1) ? windows[0] : `${windows[0]} – ${windows.at(-1)}`,
    published: missions.filter(m => m.status === 'published').length,
    // Planes are what makes it a constellation rather than a batch; the same
    // shell flown at several inclinations is a strong signal of one.
    sharesShell: new Set(missions.map(m => m.orbitType)).size === 1,
  };
}
