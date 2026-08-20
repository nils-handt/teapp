import { resolve } from 'node:path';

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

export const VISUAL_FIXTURE = Object.freeze({
  now: '2026-08-11T12:00:00.000Z',
  seed: 'visual-parity-v1',
});

export const VISUAL_OUTPUT_ROOT = resolve('tmp/visual-parity/current');
export const VISUAL_FIXTURE_PATH = resolve(VISUAL_OUTPUT_ROOT, 'sample-data.json');

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
