import { db } from './db.js';

// One row per company rather than per person: a company joins once, whoever
// happens to click.
db.exec(`
  CREATE TABLE IF NOT EXISTS waitlist (
    company_id INTEGER PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    note       TEXT    NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  );
`);

const stmt = {
  get: db.prepare('SELECT * FROM waitlist WHERE company_id = ?'),
  join: db.prepare(`
    INSERT INTO waitlist (company_id, user_id, note, created_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(company_id) DO UPDATE SET note = excluded.note, user_id = excluded.user_id`),
  leave: db.prepare('DELETE FROM waitlist WHERE company_id = ?'),
};

export const waitlistEntry = companyId => stmt.get.get(companyId);
export const joinWaitlist = (companyId, userId, note) =>
  stmt.join.run(companyId, userId, note, Date.now());
export const leaveWaitlist = companyId => stmt.leave.run(companyId).changes > 0;
