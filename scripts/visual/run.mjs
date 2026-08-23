#!/usr/bin/env node

import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureAndroid } from './capture-android.mjs';
import { captureWeb } from './capture-web.mjs';
import { compareAndReport } from './compare.mjs';
import {
  assertAndroidAssetsCurrent,
  preflightEnvironment,
  readSourceMetadata,
  runCommand,
} from './environment.mjs';
import {
  VISUAL_FIXTURE,
  VISUAL_FIXTURE_PATH,
  VISUAL_OUTPUT_ROOT,
  VISUAL_STATE_NAMES,
} from './state-manifest.mjs';

const step = async (label, action) => {
  console.log(`\n[visual] ${label}`);
  try {
    return await action();
  } catch (error) {
    throw new Error(`${label} failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
};

export async function runVisualParity() {
  if (process.argv.length > 2) throw new Error('visual:parity does not accept arguments');

  const target = await step('checking the local environment', preflightEnvironment);
  const source = await readSourceMetadata();
  await rm(VISUAL_OUTPUT_ROOT, { force: true, recursive: true });
  await mkdir(resolve(VISUAL_OUTPUT_ROOT, 'metadata'), { recursive: true });

  await step('creating the deterministic fixture', () => runCommand(process.execPath, [
    'scripts/generate-sample-dataset.mjs',
    '--sessions', '24',
    '--teas', '8',
    '--vessels', '4',
    '--seed', VISUAL_FIXTURE.seed,
    '--now', VISUAL_FIXTURE.now,
    '--mock-scale',
    '--output', VISUAL_FIXTURE_PATH,
  ]));

  await step('building the production web app', () => runCommand('npm', [
    'run', 'build', '--', '--configLoader', 'native',
  ]));
  await step('verifying packaged Android web assets', assertAndroidAssetsCurrent);
  await step('building the Android debug APK', () => runCommand('./gradlew', [
    'assembleDebug', '--no-daemon',
  ], { cwd: resolve('android') }));

  const webMetadata = await step(`capturing ${VISUAL_STATE_NAMES.length} production web states`, () => captureWeb({
    fixturePath: VISUAL_FIXTURE_PATH,
    outputRoot: VISUAL_OUTPUT_ROOT,
    source,
  }));
  const androidMetadata = await step(`capturing ${VISUAL_STATE_NAMES.length} Android API 36 states`, () => captureAndroid({
    avdName: target.avdName,
    fixturePath: VISUAL_FIXTURE_PATH,
    outputRoot: VISUAL_OUTPUT_ROOT,
    serial: target.serial,
    source,
  }));
  const comparison = await step('comparing current Android and web screenshots', () => compareAndReport({
    androidMetadata,
    outputRoot: VISUAL_OUTPUT_ROOT,
    source,
    webMetadata,
  }));

  console.log(comparison.markdown);
  console.log(`[visual] report: ${resolve(VISUAL_OUTPUT_ROOT, 'report.md')}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runVisualParity().catch((error) => {
    console.error(`\n[visual] ERROR: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
