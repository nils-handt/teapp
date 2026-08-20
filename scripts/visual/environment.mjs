import { execFile as execFileCallback } from 'node:child_process';
import { constants } from 'node:fs';
import { access, readdir, readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';

const execFile = promisify(execFileCallback);

export const parseAdbDevices = (output) => output.split(/\r?\n/)
  .slice(1)
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => {
    const [serial, state, ...details] = line.split(/\s+/);
    return { details: details.join(' '), serial, state };
  });

export const validateAndroidTarget = ({ devices, apiLevel, avdName, bootComplete, requestedSerial }) => {
  if (devices.length === 0) {
    throw new Error('No Android target found. Start exactly one disposable API 36 emulator and wait for it to boot.');
  }
  if (devices.length !== 1) {
    throw new Error(`Ambiguous Android targets: expected exactly one emulator, found ${devices.length} (${devices.map(({ serial, state }) => `${serial}:${state}`).join(', ')}).`);
  }
  const [device] = devices;
  if (requestedSerial && requestedSerial !== device.serial) {
    throw new Error(`ANDROID_SERIAL=${requestedSerial} does not match the only attached target ${device.serial}.`);
  }
  if (device.state !== 'device') {
    throw new Error(`Android target ${device.serial} is ${device.state}; it must be online and authorized.`);
  }
  if (!device.serial.startsWith('emulator-')) {
    throw new Error(`Android target ${device.serial} is not an emulator. Use a disposable API 36 emulator.`);
  }
  if (bootComplete !== '1') {
    throw new Error(`Android emulator ${device.serial} is not boot-complete.`);
  }
  if (apiLevel !== '36') {
    throw new Error(`Android emulator ${device.serial} uses API ${apiLevel || 'unknown'}; API 36 is required.`);
  }
  if (!avdName || avdName === 'unknown') {
    throw new Error(`Could not identify the AVD for ${device.serial}; use a normal disposable API 36 AVD.`);
  }
  return device.serial;
};

export const assertDisposableAvdAcknowledged = ({ acknowledgedAvdName, actualAvdName }) => {
  const acknowledged = acknowledgedAvdName?.trim();
  if (!acknowledged) {
    throw new Error(`Refusing to modify Android emulator ${actualAvdName} without explicit confirmation. Set VISUAL_PARITY_DISPOSABLE_AVD=${actualAvdName} only if this AVD is disposable.`);
  }
  if (acknowledged !== actualAvdName) {
    throw new Error(`VISUAL_PARITY_DISPOSABLE_AVD=${acknowledged} does not match the attached AVD ${actualAvdName}.`);
  }
};

const listFiles = async (root, directory = root) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? listFiles(root, path) : [relative(root, path)];
  }));
  return nested.flat().sort();
};

const hashFile = async (path) => createHash('sha256').update(await readFile(path)).digest('hex');

export const diffAssetEntries = (webEntries, androidEntries) => {
  const web = new Map(webEntries.map((entry) => [entry.path, entry.hash]));
  const android = new Map(androidEntries.map((entry) => [entry.path, entry.hash]));
  const mismatches = [];
  for (const [path, hash] of web) {
    if (!android.has(path)) mismatches.push(`${path} is missing from Android assets`);
    else if (android.get(path) !== hash) mismatches.push(`${path} differs`);
  }
  const allowedAndroidOnly = new Set(['cordova.js', 'cordova_plugins.js']);
  for (const path of android.keys()) {
    if (!web.has(path) && !allowedAndroidOnly.has(path)) mismatches.push(`${path} exists only in Android assets`);
  }
  return mismatches;
};

export const assertAndroidAssetsCurrent = async () => {
  const webRoot = resolve('dist');
  const androidRoot = resolve('android/app/src/main/assets/public');
  let webFiles;
  let androidFiles;
  try {
    [webFiles, androidFiles] = await Promise.all([listFiles(webRoot), listFiles(androidRoot)]);
  } catch (error) {
    throw new Error('Could not read built web assets and packaged Android assets. Run `npx cap sync android`, then rerun `npm run visual:parity`.', { cause: error });
  }
  const [webEntries, androidEntries] = await Promise.all([
    Promise.all(webFiles.map(async (path) => ({ hash: await hashFile(resolve(webRoot, path)), path }))),
    Promise.all(androidFiles.map(async (path) => ({ hash: await hashFile(resolve(androidRoot, path)), path }))),
  ]);
  const mismatches = diffAssetEntries(webEntries, androidEntries);
  if (mismatches.length > 0) {
    throw new Error(`Android web assets are stale. Run \`npx cap sync android\`, then rerun \`npm run visual:parity\`.\n${mismatches.join('\n')}`);
  }
  console.log(`[visual] verified ${webFiles.length} packaged Android web assets`);
};

const requiredFile = async (path, label, mode = constants.R_OK) => {
  try {
    await access(path, mode);
  } catch (error) {
    throw new Error(`${label} is missing or inaccessible at ${path}. Install dependencies/setup the Android project before running visual parity.`, { cause: error });
  }
};

const command = async (file, args, label) => {
  try {
    return await execFile(file, args, { maxBuffer: 10 * 1024 * 1024 });
  } catch (error) {
    throw new Error(`${label} is unavailable or failed (${file} ${args.join(' ')}).`, { cause: error });
  }
};

export const readSourceMetadata = async () => {
  const [{ stdout: revision }, { stdout: status }] = await Promise.all([
    command('git', ['rev-parse', 'HEAD'], 'Git'),
    command('git', ['status', '--porcelain', '--', '.', ':(exclude)tmp/visual-parity/**'], 'Git status'),
  ]);
  return { revision: revision.trim(), workingTreeDirty: status.trim().length > 0 };
};

export const preflightEnvironment = async () => {
  await Promise.all([
    requiredFile(resolve('node_modules/vite/bin/vite.js'), 'Vite'),
    requiredFile(resolve('node_modules/@capacitor/cli/bin/capacitor'), 'Capacitor CLI'),
    requiredFile(resolve('android/gradlew'), 'Android Gradle wrapper', constants.R_OK | constants.X_OK),
    requiredFile(chromium.executablePath(), 'Playwright Chromium'),
  ]);
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    throw new Error('Playwright Chromium is installed but cannot launch. Install its system dependencies or expose them through the environment.', { cause: error });
  } finally {
    await browser?.close().catch(() => undefined);
  }
  const [{ stderr: javaVersion }, { stdout: adbDevices }] = await Promise.all([
    command('java', ['-version'], 'Java'),
    command('adb', ['devices', '-l'], 'ADB'),
  ]);
  const javaMajor = javaVersion.match(/version "(?:1\.)?(\d+)/)?.[1];
  if (javaMajor !== '21') throw new Error(`Java 21 is required for the Android build; found ${javaMajor ?? 'an unrecognized version'}.`);

  const devices = parseAdbDevices(adbDevices);
  // Validate target count, authorization, emulator identity, and any explicit
  // serial before issuing serial-scoped queries.
  validateAndroidTarget({
    apiLevel: '36',
    avdName: 'preflight',
    bootComplete: '1',
    devices,
    requestedSerial: process.env.ANDROID_SERIAL,
  });
  const [{ stdout: api }, { stdout: avd }, { stdout: boot }] = await Promise.all([
    command('adb', ['-s', devices[0].serial, 'shell', 'getprop', 'ro.build.version.sdk'], 'ADB API-level query'),
    command('adb', ['-s', devices[0].serial, 'emu', 'avd', 'name'], 'ADB AVD query'),
    command('adb', ['-s', devices[0].serial, 'shell', 'getprop', 'sys.boot_completed'], 'ADB boot query'),
  ]);
  const avdName = avd.trim().split(/\r?\n/)[0];
  const serial = validateAndroidTarget({
    apiLevel: api.trim(),
    avdName,
    bootComplete: boot.trim(),
    devices,
    requestedSerial: process.env.ANDROID_SERIAL,
  });
  assertDisposableAvdAcknowledged({
    acknowledgedAvdName: process.env.VISUAL_PARITY_DISPOSABLE_AVD,
    actualAvdName: avdName,
  });
  return { avdName, serial };
};

export const runCommand = async (file, args, options = {}) => new Promise((resolveCommand, reject) => {
  const child = execFileCallback(file, args, { ...options, maxBuffer: 50 * 1024 * 1024 }, (error) => {
    if (error) reject(error);
    else resolveCommand();
  });
  child.stdout?.pipe(process.stdout);
  child.stderr?.pipe(process.stderr);
});
