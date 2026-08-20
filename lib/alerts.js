import { db } from './db.js';
import { compatibility } from './compatibility.js';

// A launch alert is the compatibility check run at publish time instead of at
// page-load time. The criteria are the satellite itself — orbit, altitude,
// inclination and window are already on the mission row — so switching alerts
// on costs one click and the two can never fall out of step.
//
// Orbit compatibility is necessary but not sufficient: a launch that reaches
// the right orbit with no room left cannot fly the payload, so spare capacity
// is checked too. An alert nobody can act on is worse than no alert.

const stmt = {
  setOn: db.prepare('UPDATE missions SET alerts_on = ? WHERE id = ? AND company_id = ?'),
  watching: db.prepare("SELECT * FROM missions WHERE alerts_on = 1 AND status = 'published'"),
  publishedLaunches: db.prepare("SELECT * FROM launches WHERE status = 'published'"),
  record: db.prepare(`
    INSERT OR IGNORE INTO alert_hits (company_id, mission_id, launch_id, created_at)
    VALUES (?, ?, ?, ?)`),
  hits: db.prepare(`
    SELECT h.*, m.reference AS mission_ref, m.payload_mass_kg,
           l.name AS launch_name, l.vehicle, l.site, l.orbit_type, l.altitude_km,
           l.inclination_deg, l.window_month, l.capacity_kg, l.committed_kg,
           l.status AS launch_status, c.name AS provider, c.country AS provider_country
    FROM alert_hits h
    JOIN missions  m ON m.id = h.mission_id
    JOIN launches  l ON l.id = h.launch_id
    JOIN companies c ON c.id = l.company_id
    WHERE h.company_id = ? AND l.status = 'published'
    ORDER BY h.created_at DESC`),
  unread: db.prepare(`
    SELECT COUNT(*) AS n FROM alert_hits h
    JOIN launches l ON l.id = h.launch_id AND l.status = 'published'
    WHERE h.company_id = ?
      AND h.created_at > COALESCE(
        (SELECT read_at FROM alert_reads WHERE company_id = ?), 0)`),
  markRead: db.prepare(`
    INSERT INTO alert_reads (company_id, read_at) VALUES (?, ?)
    ON CONFLICT(company_id) DO UPDATE SET read_at = excluded.read_at`),
  missionById: db.prepare('SELECT * FROM missions WHERE id = ? AND company_id = ?'),
};

const spareKg = l => Math.max(0, l.capacity_kg - l.committed_kg);

/** Does this launch fit this satellite — orbit, window and remaining room. */
export function matches(launch, mission) {
  if (launch.company_id === mission.company_id) return false;   // never alert on your own
  if (spareKg(launch) < mission.payload_mass_kg) return false;
  return compatibility(launch, mission).ok;
}

export function setMissionAlerts(companyId, missionId, on) {
  const mission = stmt.missionById.get(missionId, companyId);
  if (!mission) return null;
  stmt.setOn.run(on ? 1 : 0, missionId, companyId);

  // Turning alerts on backfills against what is already listed, so the answer
  // to "what can fly this?" arrives immediately rather than at the next launch.
  if (on) {
    const now = Date.now();
    for (const launch of stmt.publishedLaunches.all()) {
      if (matches(launch, mission)) stmt.record.run(companyId, missionId, launch.id, now);
    }
  }
  return { ...mission, alerts_on: on ? 1 : 0 };
}

/** Called whenever a launch becomes visible. Returns how many alerts fired. */
export function runAlertsForLaunch(launch) {
  if (!launch || launch.status !== 'published') return 0;
  const now = Date.now();
  let fired = 0;
  for (const mission of stmt.watching.all()) {
    if (matches(launch, mission)) {
      fired += stmt.record.run(mission.company_id, mission.id, launch.id, now).changes;
    }
  }
  return fired;
}

export const alertHits = companyId => stmt.hits.all(companyId).map(h => ({
  id: h.id,
  missionRef: h.mission_ref,
  massKg: h.payload_mass_kg,
  launchId: h.launch_id,
  launch: h.launch_name,
  vehicle: h.vehicle,
  site: h.site,
  provider: h.provider,
  providerCountry: h.provider_country,
  orbitType: h.orbit_type,
  altitudeKm: h.altitude_km,
  inclinationDeg: h.inclination_deg,
  windowMonth: h.window_month,
  spareKg: spareKg(h),
  at: new Date(h.created_at).toISOString(),
  createdAt: h.created_at,
}));

export const alertUnread = companyId => stmt.unread.get(companyId, companyId).n;
export const markAlertsRead = companyId => stmt.markRead.run(companyId, Date.now());
