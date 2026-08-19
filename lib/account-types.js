// Stored as the slug; the label is what the form and account summary show.
// Add a type here and it appears in the dropdown and passes validation.
export const ACCOUNT_TYPES = [
  { value: 'launch_provider',    label: 'Launch provider' },
  { value: 'satellite_operator', label: 'Satellite operator' },
  { value: 'broker',             label: 'Broker or consultant' },
  { value: 'other',              label: 'Other' },
];

export const ACCOUNT_TYPE_VALUES = new Set(ACCOUNT_TYPES.map(t => t.value));

export const accountTypeLabel = value =>
  ACCOUNT_TYPES.find(t => t.value === value)?.label ?? '';
