import { orbitLabel } from './mission-options.js';

// Two payloads can only share a ride if they want essentially the same orbit.
// A plane change costs more delta-v than most missions carry, so inclination is
// the hard constraint; altitude has some give if the payload or a kick stage can
// trim it. The same rules decide whether a mission fits a pool or a launch.
export const INCLINATION_TOLERANCE = 1.5;   // degrees
export const ALTITUDE_TOLERANCE = 150;      // km
export const WINDOW_TOLERANCE = 3;          // months

const monthIndex = yyyymm => {
  const [y, m] = String(yyyymm).split('-').map(Number);
  return y * 12 + (m - 1);
};

/** `target` is anything carrying orbit_type, altitude_km, inclination_deg and
 *  window_month — a pool or a launch. */
export function compatibility(target, mission) {
  const reasons = [];
  if (mission.orbit_type !== target.orbit_type) {
    reasons.push(`Different orbit — this one is ${orbitLabel(target.orbit_type)}`);
  }
  if (Math.abs(mission.inclination_deg - target.inclination_deg) > INCLINATION_TOLERANCE) {
    reasons.push(`Inclination is more than ${INCLINATION_TOLERANCE}° from ${target.inclination_deg}°`);
  }
  if (Math.abs(mission.altitude_km - target.altitude_km) > ALTITUDE_TOLERANCE) {
    reasons.push(`Altitude is more than ${ALTITUDE_TOLERANCE} km from ${target.altitude_km} km`);
  }
  if (Math.abs(monthIndex(mission.window_month) - monthIndex(target.window_month)) > WINDOW_TOLERANCE) {
    reasons.push(`Window is more than ${WINDOW_TOLERANCE} months away`);
  }
  return { ok: reasons.length === 0, reasons };
}
