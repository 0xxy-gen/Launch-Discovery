// Segmented by intent, not identity: a manufacturer sometimes procures the
// launch and sometimes does not, so "what brings you here" is the only answer
// that reliably tells us which side of the market an account is on.
// Slugs are stable — routing and any later migration keys off these, not labels.
export const ACCOUNT_TYPES = [
  {
    value: 'payload_owner',
    label: 'I need launch',
    short: 'Payload owner',
    help: 'Satellite operator, manufacturer, research group or agency with a payload to fly',
  },
  {
    value: 'launch_provider',
    label: 'I sell launch',
    short: 'Launch service provider',
    help: 'Launch service provider with capacity to offer',
  },
  {
    value: 'broker',
    label: 'I broker launch',
    short: 'Launch broker',
    help: 'Rideshare aggregator, mission integrator or launch broker',
  },
  {
    value: 'supplier',
    label: 'I supply the mission',
    short: 'Mission supplier',
    help: 'Spacecraft buses, integration, insurance, licensing, ground segment',
  },
];

export const ACCOUNT_TYPE_VALUES = new Set(ACCOUNT_TYPES.map(t => t.value));

// `label` is the question-shaped option on the form ("I need launch");
// `short` is the noun the account summary shows ("Payload owner").
export const accountTypeLabel = value =>
  ACCOUNT_TYPES.find(t => t.value === value)?.short ?? '';
