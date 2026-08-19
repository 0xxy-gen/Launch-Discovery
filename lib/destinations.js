import { db } from './db.js';
import { orbitLabel } from './mission-options.js';
import { altitudeBand, windowQuarter, missionRef } from './banding.js';

// A destination is not created by anyone — it is derived from the published
// satellites themselves. Orbit shell plus launch quarter is the whole key, the
// way a city plus a date range is for a trip. If two operators are going to the
// same place at the same time, they should see that without either of them
// having had to open a group first.
const key = m => `${m.orbit_type}|${altitudeBand(m.altitude_km)}|${windowQuarter(m.window_month)}`;

export function destinations(viewerCompanyId) {
  const missions = db.prepare(`
    SELECT m.*, c.id AS owner_company, c.country AS owner_country
    FROM missions m
    JOIN companies c ON c.id = m.company_id
    WHERE m.status = 'published'
  `).all();

  const pools = db.prepare('SELECT * FROM pools').all();
  const memberCounts = db.prepare(`
    SELECT pool_id, COUNT(DISTINCT company_id) AS n FROM pool_members GROUP BY pool_id`).all();
  const countFor = new Map(memberCounts.map(r => [r.pool_id, r.n]));
  const myPools = new Set(db.prepare(
    'SELECT DISTINCT pool_id FROM pool_members WHERE company_id = ?').all(viewerCompanyId)
    .map(r => r.pool_id));

  const buckets = new Map();
  for (const m of missions) {
    const id = key(m);
    if (!buckets.has(id)) {
      buckets.set(id, {
        id,
        orbitType: orbitLabel(m.orbit_type),
        orbitValue: m.orbit_type,
        altitudeBand: altitudeBand(m.altitude_km),
        window: windowQuarter(m.window_month),
        windowMonth: m.window_month,
        satellites: [],
        companies: new Set(),
        jurisdictions: new Set(),
        yours: false,
      });
    }
    const bucket = buckets.get(id);
    bucket.satellites.push({
      ref: missionRef(m.id),
      mine: m.company_id === viewerCompanyId,
      reference: m.company_id === viewerCompanyId ? m.reference : null,
    });
    bucket.companies.add(m.company_id);
    if (m.owner_country) bucket.jurisdictions.add(m.owner_country);
    if (m.company_id === viewerCompanyId) bucket.yours = true;
  }

  // named groups sit inside whichever destination their target falls in
  for (const pool of pools) {
    const id = key(pool);
    const bucket = buckets.get(id);
    if (!bucket) continue;
    (bucket.groups ??= []).push({
      id: pool.id,
      name: pool.name,
      members: countFor.get(pool.id) ?? 0,
      joined: myPools.has(pool.id),
    });
  }

  return [...buckets.values()]
    .map(b => ({
      ...b,
      companies: b.companies.size,
      jurisdictions: [...b.jurisdictions],
      satelliteCount: b.satellites.length,
      mineCount: b.satellites.filter(s => s.mine).length,
      groups: b.groups ?? [],
      // identities stay hidden: a destination shows how many, not who
      satellites: undefined,
    }))
    .sort((a, b) => (a.windowMonth < b.windowMonth ? -1 : a.windowMonth > b.windowMonth ? 1 : 0));
}
