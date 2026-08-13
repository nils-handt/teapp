const TRANSIENT_INSTALL_ERROR = /(?:broken pipe|device offline|device ['"].*['"] not found|failure calling service package|can't find service: package|connection (?:closed|reset)|cannot connect)/i;

const errorText = (error) => [error?.message, error?.stdout, error?.stderr]
  .filter(Boolean)
  .map(String)
  .join('\n');

export const waitForAndroidPackageManager = async ({
  adb,
  sleep,
  now = Date.now,
  timeoutMs = 60_000,
  stableProbeCount = 3,
  probeIntervalMs = 1_000,
}) => {
  const deadline = now() + timeoutMs;
  let consecutiveSuccesses = 0;
  let lastError;

  while (now() < deadline) {
    try {
      const { stdout = '' } = await adb('shell', 'cmd', 'package', 'path', 'android');
      consecutiveSuccesses = String(stdout).includes('package:') ? consecutiveSuccesses + 1 : 0;
      if (consecutiveSuccesses >= stableProbeCount) return;
    } catch (error) {
      consecutiveSuccesses = 0;
      lastError = error;
    }
    await sleep(probeIntervalMs);
  }

  throw new Error('Timed out waiting for the Android package manager', { cause: lastError });
};

export const installAndroidApk = async ({
  adb,
  apkPath,
  packageName,
  sleep,
  log = console.warn,
  maxAttempts = 3,
  packageManagerOptions,
}) => {
  const waitForPackageManager = () => waitForAndroidPackageManager({
    adb,
    sleep,
    ...packageManagerOptions,
  });

  await waitForPackageManager();
  await adb('uninstall', packageName).catch(() => undefined);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await adb('install', apkPath);
    } catch (error) {
      if (attempt === maxAttempts || !TRANSIENT_INSTALL_ERROR.test(errorText(error))) throw error;
      log(`[visual:android] transient APK install failure (${attempt}/${maxAttempts}); waiting for Package Manager`);
      await adb('wait-for-device');
      await waitForPackageManager();
    }
  }

  throw new Error('Android APK installation exhausted all attempts');
};
