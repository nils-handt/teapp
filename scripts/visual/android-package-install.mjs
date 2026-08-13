const TRANSIENT_INSTALL_ERROR = /(?:android package was not registered|broken pipe|device offline|device ['"].*['"] not found|failure calling service package|can't find service: (?:activity|package)|connection (?:closed|reset)|cannot connect|timed out waiting for the android package manager)/i;

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
      const { stdout: packageOutput = '' } = await adb('shell', 'cmd', 'package', 'path', 'android');
      const { stdout: activityOutput = '' } = await adb('shell', 'service', 'check', 'activity');
      const servicesReady = String(packageOutput).includes('package:') && String(activityOutput).includes('found');
      consecutiveSuccesses = servicesReady ? consecutiveSuccesses + 1 : 0;
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
      const result = await adb('install', apkPath);
      await waitForPackageManager();
      for (let verification = 0; verification < 2; verification += 1) {
        const { stdout = '' } = await adb('shell', 'cmd', 'package', 'path', packageName);
        if (!String(stdout).includes('package:')) throw new Error('Android package was not registered after adb install');
        if (verification === 0) await sleep(1_000);
      }
      return result;
    } catch (error) {
      if (attempt === maxAttempts || !TRANSIENT_INSTALL_ERROR.test(errorText(error))) throw error;
      log(`[visual:android] transient APK install failure (${attempt}/${maxAttempts}); waiting for Package Manager`);
      await adb('wait-for-device');
      await waitForPackageManager();
    }
  }

  throw new Error('Android APK installation exhausted all attempts');
};
