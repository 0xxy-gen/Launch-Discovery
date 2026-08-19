import { db } from './db.js';

// Saved against the company, not the person: if a colleague bookmarks a flight,
// the whole team should see it in the shortlist.
db.exec(`
  CREATE TABLE IF NOT EXISTS saved_launches (
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    launch_id  INTEGER NOT NULL REFERENCES launches(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (company_id, launch_id)
  );
`);

const stmt = {
  add: db.prepare(`
    INSERT INTO saved_launches (company_id, launch_id, user_id, created_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(company_id, launch_id) DO NOTHING`),
  remove: db.prepare('DELETE FROM saved_launches WHERE company_id = ? AND launch_id = ?'),
  ids: db.prepare('SELECT launch_id FROM saved_launches WHERE company_id = ?'),
  rows: db.prepare(`
    SELECT l.*, c.name AS provider, c.country AS provider_country, s.created_at AS saved_at
    FROM saved_launches s
    JOIN launches l  ON l.id = s.launch_id
    JOIN companies c ON c.id = l.company_id
    WHERE s.company_id = ?
    ORDER BY s.created_at DESC`),
};

export const saveLaunch = (companyId, launchId, userId) =>
  stmt.add.run(companyId, launchId, userId, Date.now());
export const unsaveLaunch = (companyId, launchId) => stmt.remove.run(companyId, launchId).changes > 0;
export const savedIds = companyId => new Set(stmt.ids.all(companyId).map(r => r.launch_id));
export const savedLaunches = companyId => stmt.rows.all(companyId);
