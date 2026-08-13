import { describe, expect, it, vi } from 'vitest';
import {
  installAndroidApk,
  waitForAndroidPackageManager,
} from './android-package-install.mjs';

const createClock = () => {
  let current = 0;
  return {
    now: () => current,
    sleep: vi.fn(async (milliseconds) => { current += milliseconds; }),
  };
};

describe('Android visual APK installation', () => {
  it('requires consecutive successful Package Manager probes', async () => {
    const clock = createClock();
    const responses = [
      { stdout: 'package:/system/framework/framework-res.apk' },
      new Error('device offline'),
      { stdout: 'package:/system/framework/framework-res.apk' },
      { stdout: 'package:/system/framework/framework-res.apk' },
      { stdout: 'package:/system/framework/framework-res.apk' },
    ];
    const adb = vi.fn(async (...args) => {
      if (args[1] === 'service') return { stdout: 'Service activity: found' };
      const response = responses.shift();
      if (response instanceof Error) throw response;
      return response;
    });

    await waitForAndroidPackageManager({ adb, ...clock });

    expect(adb.mock.calls.filter((args) => args[1] === 'cmd')).toHaveLength(5);
    expect(clock.sleep).toHaveBeenCalledTimes(4);
  });

  it('retries a transient Package Manager failure after readiness returns', async () => {
    const clock = createClock();
    let installAttempts = 0;
    const adb = vi.fn(async (...args) => {
      if (args[0] === 'shell' && args[1] === 'service') return { stdout: 'Service activity: found' };
      if (args[0] === 'shell') return { stdout: 'package:/system/framework/framework-res.apk' };
      if (args[0] === 'uninstall' || args[0] === 'wait-for-device') return { stdout: '' };
      installAttempts += 1;
      if (installAttempts === 1) throw Object.assign(new Error('install failed'), { stderr: 'Failure calling service package: Broken pipe (32)' });
      return { stdout: 'Success' };
    });

    await expect(installAndroidApk({
      adb,
      apkPath: '/tmp/app.apk',
      packageName: 'com.teapp.app',
      sleep: clock.sleep,
      log: vi.fn(),
    })).resolves.toEqual({ stdout: 'Success' });

    expect(installAttempts).toBe(2);
    expect(adb).toHaveBeenCalledWith('wait-for-device');
    expect(clock.sleep).toHaveBeenCalledWith(15_000);
    expect(clock.sleep).toHaveBeenCalledWith(10_000);
  });

  it('does not retry permanent installation errors', async () => {
    const clock = createClock();
    const adb = vi.fn(async (...args) => {
      if (args[0] === 'shell' && args[1] === 'service') return { stdout: 'Service activity: found' };
      if (args[0] === 'shell') return { stdout: 'package:/system/framework/framework-res.apk' };
      if (args[0] === 'uninstall') return { stdout: '' };
      throw new Error('Requested internal only, but not enough space');
    });

    await expect(installAndroidApk({
      adb,
      apkPath: '/tmp/app.apk',
      packageName: 'com.teapp.app',
      sleep: clock.sleep,
    })).rejects.toThrow('not enough space');

    expect(adb.mock.calls.filter(([command]) => command === 'install')).toHaveLength(1);
  });

  it('retries when adb reports success but the package is not registered', async () => {
    const clock = createClock();
    let installAttempts = 0;
    let applicationPathChecks = 0;
    const adb = vi.fn(async (...args) => {
      if (args[0] === 'shell' && args[1] === 'service') return { stdout: 'Service activity: found' };
      if (args[0] === 'shell' && args.at(-1) === 'com.teapp.app') {
        applicationPathChecks += 1;
        return { stdout: applicationPathChecks === 1 ? '' : 'package:/data/app/com.teapp.app/base.apk' };
      }
      if (args[0] === 'shell') return { stdout: 'package:/system/framework/framework-res.apk' };
      if (args[0] === 'uninstall' || args[0] === 'wait-for-device') return { stdout: '' };
      installAttempts += 1;
      return { stdout: 'Success' };
    });

    await installAndroidApk({
      adb,
      apkPath: '/tmp/app.apk',
      packageName: 'com.teapp.app',
      sleep: clock.sleep,
      log: vi.fn(),
    });

    expect(installAttempts).toBe(2);
    expect(adb).toHaveBeenCalledWith('wait-for-device');
  });
});
