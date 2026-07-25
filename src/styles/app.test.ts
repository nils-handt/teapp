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

  it('uses a shared floating Zen surface for History header variants', () => {
    const surfaceRule = appCss.match(/\.zen-history-header-surface\s*{([^}]*)}/)?.[1] ?? '';
    const frameRule = appCss.match(/\.zen-history-header-frame\s*{([^}]*)}/)?.[1] ?? '';
    const buttonRule = appCss.match(/\.zen-history-header-button\s*{([^}]*)}/)?.[1] ?? '';
    const ionicButtonRule = appCss.match(/ion-button\.zen-history-header-button\s*{([^}]*)}/)?.[1] ?? '';

    expect(surfaceRule).toMatch(/max-width\s*:\s*900px/);
    expect(surfaceRule).toMatch(/max-height\s*:\s*calc\(100dvh/);
    expect(surfaceRule).toMatch(/overflow-y\s*:\s*auto/);
    expect(surfaceRule).toMatch(/border-radius\s*:\s*22px/);
    expect(surfaceRule).toMatch(/background\s*:\s*var\(--color-zen-panel-strong\)/);
    expect(surfaceRule).toMatch(/box-shadow\s*:\s*0 12px 28px/);
    expect(frameRule).toMatch(/var\(--ion-safe-area-top/);
    expect(buttonRule).toMatch(/width\s*:\s*44px/);
    expect(buttonRule).toMatch(/height\s*:\s*44px/);
    expect(buttonRule).toMatch(/border\s*:\s*1px solid var\(--color-zen-border\)/);
    expect(buttonRule).toMatch(/border-radius\s*:\s*16px/);
    expect(buttonRule).toMatch(/background\s*:\s*rgba\(255, 255, 255, 0\.6\)/);
    expect(ionicButtonRule).toMatch(/--background\s*:\s*transparent/);
    expect(ionicButtonRule).toMatch(/--background-hover\s*:\s*transparent/);
  });
});
