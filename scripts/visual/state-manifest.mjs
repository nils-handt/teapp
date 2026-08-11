export const VISUAL_STATE_NAMES = Object.freeze([
  'tutorial',
  'settings-mock-scale',
  'history',
  'history-filters',
  'statistics',
  'session-detail',
  'brewing-idle',
  'brewing-setup-modal',
  'brewing-setup',
  'brewing-ready',
  'brewing-infusion',
  'brewing-rest',
  'brewing-ended',
]);

export const VISUAL_FIXTURE_METADATA = Object.freeze({
  now: '2026-08-11T12:00:00.000Z',
  path: 'tmp/visual-parity/sample-data.json',
  seed: 'visual-parity-v1',
});

export const VISUAL_SETUP_VALUES = Object.freeze({
  dryTeaWeight: '6.5',
  lid: '35',
  vessel: '120',
  vesselName: 'Visual Gaiwan',
});

export const assertCanonicalCaptures = (captures) => {
  const names = captures.map(({ name }) => name);
  if (JSON.stringify(names) !== JSON.stringify(VISUAL_STATE_NAMES)) {
    throw new Error(`Visual capture state drift: expected ${VISUAL_STATE_NAMES.join(', ')}, received ${names.join(', ')}`);
  }
};
