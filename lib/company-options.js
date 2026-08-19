// What a counterparty actually needs to know before talking to you. Only
// entity type is required alongside the name and operating country — the rest
// is optional depth, because an onboarding form that demands fifteen answers
// loses the signups the light registration just won.

export const ENTITY_TYPES = [
  { value: 'commercial', label: 'Commercial company' },
  { value: 'government', label: 'Government or space agency' },
  { value: 'academic',   label: 'University or research institute' },
  { value: 'nonprofit',  label: 'Non-profit or foundation' },
];

export const COMPANY_SIZES = [
  { value: '1-10',    label: '1–10 people' },
  { value: '11-50',   label: '11–50' },
  { value: '51-200',  label: '51–200' },
  { value: '201-1000', label: '201–1000' },
  { value: '1000+',   label: 'More than 1000' },
];

// Only asked of commercial companies. Providers lose a great deal of time on
// enquiries that were never funded, so this is the most useful qualifier here.
export const FUNDING_STAGES = [
  { value: 'exploring',   label: 'Exploring — not funded yet' },
  { value: 'pre_seed',    label: 'Pre-seed or seed' },
  { value: 'series_a',    label: 'Series A' },
  { value: 'series_b',    label: 'Series B or later' },
  { value: 'grant',       label: 'Grant or public funding' },
  { value: 'revenue',     label: 'Revenue funded' },
  { value: 'listed',      label: 'Publicly listed' },
];

// The trust signal in this industry — the equivalent of a verified badge.
export const FLIGHT_HERITAGE = [
  { value: 'none',  label: 'Nothing flown yet' },
  { value: '1-3',   label: '1–3 missions flown' },
  { value: '4-10',  label: '4–10 flown' },
  { value: '10+',   label: 'More than 10 flown' },
];

// Load-bearing in launch: a provider needs to know early whether a payload
// drags US or EU export rules into the deal, because it changes who can fly it.
export const EXPORT_REGIMES = [
  { value: 'none',    label: 'No known controls' },
  { value: 'itar',    label: 'ITAR controlled' },
  { value: 'ear',     label: 'EAR controlled' },
  { value: 'eu_dual', label: 'EU dual-use' },
  { value: 'other',   label: 'Other national regime' },
  { value: 'unsure',  label: 'Not sure yet' },
];

export const APPLICATIONS = [
  { value: 'eo',        label: 'Earth observation' },
  { value: 'comms',     label: 'Communications' },
  { value: 'iot',       label: 'IoT or M2M' },
  { value: 'nav',       label: 'Navigation or timing' },
  { value: 'science',   label: 'Science' },
  { value: 'tech_demo', label: 'Technology demonstration' },
  { value: 'isam',      label: 'In-space servicing or logistics' },
  { value: 'defence',   label: 'Defence or security' },
  { value: 'other',     label: 'Other' },
];

const values = list => new Set(list.map(o => o.value));
export const ENTITY_VALUES = values(ENTITY_TYPES);
export const SIZE_VALUES = values(COMPANY_SIZES);
export const FUNDING_VALUES = values(FUNDING_STAGES);
export const HERITAGE_VALUES = values(FLIGHT_HERITAGE);
export const EXPORT_VALUES = values(EXPORT_REGIMES);
export const APPLICATION_VALUES = values(APPLICATIONS);

const labelOf = (list, v) => list.find(o => o.value === v)?.label ?? '';
export const entityLabel = v => labelOf(ENTITY_TYPES, v);
export const sizeLabel = v => labelOf(COMPANY_SIZES, v);
export const fundingLabel = v => labelOf(FUNDING_STAGES, v);
export const heritageLabel = v => labelOf(FLIGHT_HERITAGE, v);
export const exportLabel = v => labelOf(EXPORT_REGIMES, v);
export const applicationLabels = csv =>
  String(csv || '').split(',').filter(Boolean).map(v => labelOf(APPLICATIONS, v)).filter(Boolean);

// Completeness is computed here so the bar, the API and the checks agree.
// Weighted, because a logo is not worth as much as knowing whether a payload
// is export controlled.
export const PROFILE_FIELDS = [
  { key: 'name',            label: 'Organisation name', weight: 3, required: true },
  { key: 'country',         label: 'Main operating country', weight: 3, required: true },
  { key: 'entity_type',     label: 'Kind of organisation', weight: 3, required: true },
  { key: 'description',     label: 'What you do', weight: 3 },
  { key: 'export_regime',   label: 'Export control status', weight: 3 },
  { key: 'flight_heritage', label: 'Flight heritage', weight: 2 },
  { key: 'website',         label: 'Website', weight: 2 },
  { key: 'applications',    label: 'Applications', weight: 2 },
  { key: 'incorporated_in', label: 'Country of incorporation', weight: 1 },
  { key: 'size_band',       label: 'Company size', weight: 1 },
  { key: 'founded_year',    label: 'Year founded', weight: 1 },
  { key: 'funding_stage',   label: 'Funding stage', weight: 2, onlyIf: c => c.entity_type === 'commercial' },
  { key: 'logo',            label: 'Company logo', weight: 1 },
  { key: 'phone',           label: 'Your phone number', weight: 1, from: 'user' },
  { key: 'linkedin',        label: 'Your LinkedIn', weight: 1, from: 'user' },
];

export function completeness(company = {}, user = {}) {
  const applicable = PROFILE_FIELDS.filter(f => !f.onlyIf || f.onlyIf(company));
  const filled = applicable.filter(f => {
    const value = f.from === 'user' ? user[f.key] : company[f.key];
    return value !== null && value !== undefined && String(value).trim() !== '';
  });

  const earned = filled.reduce((sum, f) => sum + f.weight, 0);
  const total = applicable.reduce((sum, f) => sum + f.weight, 0);

  return {
    percent: Math.round((earned / total) * 100),
    missing: applicable.filter(f => !filled.includes(f)).map(f => f.label),
  };
}
