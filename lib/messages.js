import { db } from './db.js';

// Group chat for a pool. Members already see each other's organisation — that
// is the trade for joining — so a thread reveals nothing a member did not
// already have. Threads exist only for pools you are in.
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id         INTEGER PRIMARY KEY,
    pool_id    INTEGER NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body       TEXT    NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_messages_pool ON messages(pool_id, created_at);

  -- one marker per company per thread, so a colleague reading counts for all
  CREATE TABLE IF NOT EXISTS thread_reads (
    pool_id    INTEGER NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    read_at    INTEGER NOT NULL,
    PRIMARY KEY (pool_id, company_id)
  );
`);

const stmt = {
  insert: db.prepare(
    'INSERT INTO messages (pool_id, company_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)'),
  byPool: db.prepare(`
    SELECT m.*, c.name AS organisation, u.name AS author, u.email AS author_email
    FROM messages m
    JOIN companies c ON c.id = m.company_id
    JOIN users u     ON u.id = m.user_id
    WHERE m.pool_id = ?
    ORDER BY m.created_at`),
  last: db.prepare(`
    SELECT m.*, c.name AS organisation, u.name AS author
    FROM messages m
    JOIN companies c ON c.id = m.company_id
    JOIN users u     ON u.id = m.user_id
    WHERE m.pool_id = ?
    ORDER BY m.created_at DESC LIMIT 1`),
  unread: db.prepare(`
    SELECT COUNT(*) AS n FROM messages
    WHERE pool_id = ? AND company_id != ?
      AND created_at > COALESCE(
        (SELECT read_at FROM thread_reads WHERE pool_id = ? AND company_id = ?), 0)`),
  markRead: db.prepare(`
    INSERT INTO thread_reads (pool_id, company_id, read_at) VALUES (?, ?, ?)
    ON CONFLICT(pool_id, company_id) DO UPDATE SET read_at = excluded.read_at`),
  myPools: db.prepare(`
    SELECT DISTINCT p.* FROM pools p
    JOIN pool_members pm ON pm.pool_id = p.id
    WHERE pm.company_id = ?`),
};

export const postMessage = (poolId, companyId, userId, body) =>
  stmt.insert.run(poolId, companyId, userId, body, Date.now());
export const messagesFor = poolId => stmt.byPool.all(poolId);
export const lastMessage = poolId => stmt.last.get(poolId);
export const unreadCount = (poolId, companyId) => stmt.unread.get(poolId, companyId, poolId, companyId).n;
export const markThreadRead = (poolId, companyId) => stmt.markRead.run(poolId, companyId, Date.now());
export const threadsFor = companyId => stmt.myPools.all(companyId);
