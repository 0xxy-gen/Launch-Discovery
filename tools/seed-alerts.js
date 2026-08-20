import { db } from '../lib/db.js';
import { setMissionAlerts, alertHits } from '../lib/alerts.js';

// Switches alerts on for a couple of published satellites. Because turning them
// on backfills against everything already listed, this leaves the demo account
// with real matches waiting in the inbox rather than an empty state.

const watched = db.prepare(`
  SELECT id, company_id, reference FROM missions
  WHERE status = 'published'
  ORDER BY id
`).all();

let on = 0;
for (const m of watched) {
  const before = alertHits(m.company_id).length;
  setMissionAlerts(m.company_id, m.id, true);
  const after = alertHits(m.company_id).length;
  if (after > before) {
    console.log(`  alerts on: ${m.reference} → ${after - before} match(es)`);
    on += 1;
  } else {
    // no matches, so leave the switch off rather than showing a dead toggle
    setMissionAlerts(m.company_id, m.id, false);
  }
}

console.log(`Alerts enabled on ${on} satellite${on === 1 ? '' : 's'}.`);
