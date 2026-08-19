export const ORBIT_TYPES = [
  { value: 'sso',        label: 'Sun-synchronous (SSO)' },
  { value: 'leo_polar',  label: 'LEO — polar' },
  { value: 'leo_mid',    label: 'LEO — mid-inclination' },
  { value: 'leo_equat',  label: 'LEO — equatorial' },
  { value: 'meo',        label: 'MEO' },
  { value: 'gto',        label: 'GTO' },
  { value: 'escape',     label: 'Lunar or escape' },
];

export const RIDE_TYPES = [
  { value: 'rideshare', label: 'Rideshare' },
  { value: 'dedicated', label: 'Dedicated' },
  { value: 'either',    label: 'Either' },
];

export const FORM_FACTORS = [
  { value: 'cubesat_3u',  label: 'CubeSat 1–3U' },
  { value: 'cubesat_12u', label: 'CubeSat 6–12U' },
  { value: 'espa',        label: 'ESPA-class' },
  { value: 'micro',       label: 'Microsatellite' },
  { value: 'mini',        label: 'Minisatellite' },
  { value: 'custom',      label: 'Custom or other' },
];

const bySet = list => new Set(list.map(o => o.value));
export const ORBIT_VALUES = bySet(ORBIT_TYPES);
export const RIDE_VALUES = bySet(RIDE_TYPES);
export const FORM_VALUES = bySet(FORM_FACTORS);

const labelOf = (list, value) => list.find(o => o.value === value)?.label ?? '';
export const orbitLabel = v => labelOf(ORBIT_TYPES, v);
export const rideLabel  = v => labelOf(RIDE_TYPES, v);
export const formLabel  = v => labelOf(FORM_FACTORS, v);
