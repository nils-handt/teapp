import { describe, expect, it } from 'vitest';
import { withAndroidCaptureResources } from './capture-android.mjs';
import {
  assertCompatibleAspectRatio,
  assertCompatibleCaptureMetadata,
  assertMatchingStateNames,
  createReportMarkdown,
} from './compare.mjs';
import {
  assertDisposableAvdAcknowledged,
  diffAssetEntries,
  parseAdbDevices,
  validateAndroidTarget,
} from './environment.mjs';

describe('visual parity preflight', () => {
  it('parses adb device states without hiding offline targets', () => {
    expect(parseAdbDevices(`List of devices attached
emulator-5554 device product:sdk_gphone64 model:sdk_gphone64 transport_id:1
emulator-5556 offline transport_id:2
`)).toEqual([
      { details: 'product:sdk_gphone64 model:sdk_gphone64 transport_id:1', serial: 'emulator-5554', state: 'device' },
      { details: 'transport_id:2', serial: 'emulator-5556', state: 'offline' },
    ]);
  });

  it('rejects ambiguous Android targets', () => {
    expect(() => validateAndroidTarget({
      devices: [
        { serial: 'emulator-5554', state: 'device' },
        { serial: 'emulator-5556', state: 'device' },
      ],
    })).toThrow(/Ambiguous Android targets.*found 2/);
  });

  it('rejects a wrong API emulator', () => {
    expect(() => validateAndroidTarget({
      apiLevel: '35',
      avdName: 'Pixel_API_35',
      bootComplete: '1',
      devices: [{ serial: 'emulator-5554', state: 'device' }],
    })).toThrow(/uses API 35; API 36 is required/);
  });

  it('rejects offline and physical targets', () => {
    expect(() => validateAndroidTarget({
      devices: [{ serial: 'emulator-5554', state: 'offline' }],
    })).toThrow(/is offline/);
    expect(() => validateAndroidTarget({
      bootComplete: '1',
      apiLevel: '36',
      avdName: 'unused',
      devices: [{ serial: 'R3CT10', state: 'device' }],
    })).toThrow(/is not an emulator/);
  });

  it('requires exact-name acknowledgment of the disposable AVD', () => {
    expect(() => assertDisposableAvdAcknowledged({ actualAvdName: 'Teapp_API_36_1' }))
      .toThrow(/VISUAL_PARITY_DISPOSABLE_AVD=Teapp_API_36_1/);
    expect(() => assertDisposableAvdAcknowledged({
      acknowledgedAvdName: 'Personal_API_36',
      actualAvdName: 'Teapp_API_36_1',
    })).toThrow(/does not match the attached AVD/);
    expect(() => assertDisposableAvdAcknowledged({
      acknowledgedAvdName: 'Teapp_API_36_1',
      actualAvdName: 'Teapp_API_36_1',
    })).not.toThrow();
  });
});

describe('Android capture resource lifecycle', () => {
  it('cleans up resources allocated before the initial CDP connection fails', async () => {
    const events = [];

    await expect(withAndroidCaptureResources({
      cleanup: async () => { events.push('cleanup'); },
      connect: async () => {
        events.push('forward-created');
        throw new Error('CDP connection failed');
      },
      run: async () => { events.push('capture'); },
    })).rejects.toThrow('CDP connection failed');

    expect(events).toEqual(['forward-created', 'cleanup']);
  });
});

describe('visual parity asset verification', () => {
  it('reports stale, missing, and unexpected packaged assets', () => {
    expect(diffAssetEntries(
      [
        { path: 'index.html', hash: 'new' },
        { path: 'assets/app.js', hash: 'js' },
      ],
      [
        { path: 'index.html', hash: 'old' },
        { path: 'extra.txt', hash: 'extra' },
        { path: 'cordova.js', hash: 'native-only' },
      ],
    )).toEqual([
      'index.html differs',
      'assets/app.js is missing from Android assets',
      'extra.txt exists only in Android assets',
    ]);
  });
});

describe('visual parity report integrity', () => {
  it('rejects state-set drift before comparison', () => {
    expect(() => assertMatchingStateNames(['one'], ['one'], ['one', 'two']))
      .toThrow(/web screenshot state set is invalid/);
    expect(() => assertMatchingStateNames(['one', 'two'], ['one'], ['one', 'two']))
      .toThrow(/Android screenshot state set is invalid/);
  });

  it('rejects incompatible capture routes and image aspect ratios', () => {
    const capture = (name, route) => ({
      metrics: { devicePixelRatio: 1, height: 200, route, scrollTops: [0], width: 100 },
      name,
    });
    const names = ['one'];
    expect(() => assertCompatibleCaptureMetadata(
      { captures: [capture('one', '/web')], fixture: { seed: 'same' } },
      { captures: [capture('one', '/android')], fixture: { seed: 'same' } },
      names,
    )).toThrow(/Route mismatch for one/);
    expect(() => assertCompatibleAspectRatio('history', { height: 200, width: 100 }, { height: 100, width: 100 }))
      .toThrow(/Incompatible screenshot aspect ratio/);
    expect(() => assertCompatibleAspectRatio('brewing-setup-modal', { height: 200, width: 100 }, { height: 100, width: 100 }))
      .not.toThrow();

    expect(() => assertCompatibleCaptureMetadata(
      { captures: [capture('one', '/same')], fixture: { seed: 'same' } },
      {
        captures: [{
          metrics: { devicePixelRatio: 2.625, height: 180, route: '/same', scrollTops: [0], width: 100 },
          name: 'one',
        }],
        fixture: { seed: 'same' },
      },
      names,
    )).toThrow(/Viewport mismatch for one/);

    expect(() => assertCompatibleCaptureMetadata(
      { captures: [capture('one', '/same')], fixture: { seed: 'same' } },
      {
        captures: [{
          metrics: { devicePixelRatio: 2.625, height: 200, route: '/same', scrollTops: [4], width: 100 },
          name: 'one',
        }],
        fixture: { seed: 'same' },
      },
      names,
    )).toThrow(/Invalid Android scroll position metadata for one/);
  });

  it('marks the keyboard-open modal for manual review without a pass threshold', () => {
    const markdown = createReportMarkdown({
      androidMetadata: {
        apiLevel: '36', avdName: 'Pixel_API_36', model: 'Pixel', webViewVersion: '140',
      },
      results: [{
        androidHeight: 100,
        androidWidth: 50,
        diffRatio: 0.25,
        differingPixels: 1250,
        manualReview: true,
        name: 'brewing-setup-modal',
        webHeight: 100,
        webWidth: 50,
      }],
      source: { revision: 'abc', workingTreeDirty: false },
      webMetadata: { browserVersion: '140', fixture: { now: 'now', seed: 'seed' } },
    });
    expect(markdown).toContain('manual: keyboard open');
    expect(markdown).toContain('diagnostic evidence, not pass/fail thresholds');
    expect(markdown).not.toContain('Maximum allowed');
  });
});
