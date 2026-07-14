import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const appCss = readFileSync('src/styles/app.css', 'utf8');

describe('app header layout', () => {
  it('keeps headers unconstrained at rest and hides them when the modal keyboard is open', () => {
    const restingHeaderRule = appCss.match(/(?:^|\n)ion-header\s*{([^}]*)}/)?.[1] ?? '';
    const keyboardOpenRule = appCss.match(/:root\.zen-modal-keyboard-open ion-header\s*{([^}]*)}/)?.[1] ?? '';

    expect(restingHeaderRule).not.toMatch(/max-height\s*:\s*128px/);
    expect(restingHeaderRule).not.toMatch(/overflow\s*:\s*hidden/);
    expect(keyboardOpenRule).toMatch(/opacity\s*:\s*0/);
    expect(keyboardOpenRule).toMatch(/pointer-events\s*:\s*none/);
    expect(keyboardOpenRule).toMatch(/transform\s*:\s*translateY\(-100%\)/);
  });
});
