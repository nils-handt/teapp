import { describe, expect, it } from 'vitest';
import {
  createBrewingDiagnosticsExpression,
  isBrewingDiagnosticState,
} from './brewing-diagnostics.mjs';

const brewingStates = [
  'brewing-idle',
  'brewing-setup',
  'brewing-ready',
  'brewing-infusion',
  'brewing-rest',
  'brewing-ended',
];

describe('Brewing visual diagnostics', () => {
  it('supports every non-modal canonical Brewing state and excludes the keyboard modal', () => {
    expect(brewingStates.every(isBrewingDiagnosticState)).toBe(true);
    expect(isBrewingDiagnosticState('brewing-setup-modal')).toBe(false);
  });

  it.each(brewingStates)('builds a parseable expression for %s', (state) => {
    const expression = createBrewingDiagnosticsExpression(state);

    expect(expression).toContain(`const captureName = "${state}"`);
    expect(() => new Function(`return ${expression}`)).not.toThrow();
  });

  it('rejects unsupported states before browser evaluation', () => {
    expect(() => createBrewingDiagnosticsExpression('brewing-setup-modal')).toThrow(
      'Unsupported Brewing diagnostics state: brewing-setup-modal',
    );
  });
});
