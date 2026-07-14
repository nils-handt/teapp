import { describe, expect, it } from 'vitest';
import { getSqliteWasmPath } from './assetPaths';

describe('getSqliteWasmPath', () => {
  it('uses a root-relative asset path for the development base', () => {
    expect(getSqliteWasmPath('./')).toBe('/assets');
    expect(getSqliteWasmPath('/')).toBe('/assets');
  });

  it('keeps the configured PWA base path', () => {
    expect(getSqliteWasmPath('/teapp/')).toBe('/teapp/assets');
  });
});
