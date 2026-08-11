#!/usr/bin/env node

import { execFile as execFileCallback } from 'node:child_process';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { CdpClient } from './cdp-client.mjs';
import {
  DEFAULT_VISUAL_OUTPUT_ROOT,
  readSourceMetadata,
  VISUAL_FIXTURE_PATH,
  VISUAL_FIXTURE_RELATIVE_PATH,
} from './capture-shared.mjs';

const execFile = promisify(execFileCallback);
const serial = process.env.ANDROID_SERIAL;
const apkPath = resolve(process.env.VISUAL_ANDROID_APK ?? 'android/app/build/outputs/apk/debug/app-debug.apk');

if (!serial) {
  throw new Error('Set ANDROID_SERIAL to a running local emulator before capturing Android screenshots');
}

const adb = async (...args) => execFile('adb', ['-s', serial, ...args], { maxBuffer: 10 * 1024 * 1024 });
const adbBuffer = (...args) => new Promise((resolveResult, reject) => {
  execFileCallback('adb', ['-s', serial, ...args], { encoding: 'buffer', maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
    if (error) {
      reject(Object.assign(error, { stderr }));
      return;
    }
    resolveResult({ stdout, stderr });
  });
});

const sleep = (milliseconds) => new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));

const waitFor = async (client, expression, label, timeoutMs = 30_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await client.evaluate(`Boolean(${expression})`).catch(() => false)) return;
    await sleep(150);
  }
  throw new Error(`Timed out waiting for ${label}`);
};

const installDomDriver = async (client) => client.evaluate(`(() => {
  const visible = (element) => {
    if (!(element instanceof Element)) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
  };
  const deepElements = () => {
    const elements = [];
    const visit = (root) => {
      for (const element of root.querySelectorAll('*')) {
        elements.push(element);
        if (element.shadowRoot) visit(element.shadowRoot);
      }
    };
    visit(document);
    return elements;
  };
  const interactiveByText = (text, prefix = false) => deepElements()
    .filter((element) => ['BUTTON', 'A', 'ION-BUTTON', 'ION-ITEM'].includes(element.tagName))
    .filter((element) => !element.disabled && visible(element))
    .filter((element) => prefix
      ? (element.textContent || '').trim().startsWith(text)
      : (element.textContent || '').trim() === text)
    .sort((left, right) => {
      const rank = (element) => ({ 'ION-BUTTON': 3, BUTTON: 2, A: 2, 'ION-ITEM': 1 })[element.tagName] || 0;
      return rank(right) - rank(left);
    })[0];
  const visibleCss = (selector) => Array.from(document.querySelectorAll(selector)).find(visible);
  window.__teappVisual = { deepElements, interactiveByText, visible, visibleCss };
  let style = document.getElementById('teapp-visual-stabilization');
  if (!style) {
    style = document.createElement('style');
    style.id = 'teapp-visual-stabilization';
    style.textContent = '*,*::before,*::after{animation-delay:0s!important;animation-duration:0s!important;caret-color:transparent!important;scroll-behavior:auto!important;transition-delay:0s!important;transition-duration:0s!important}ion-ripple-effect{display:none!important}';
    document.head.append(style);
  }
  return true;
})()`);

const clickCss = async (client, selector) => {
  await waitFor(client, `window.__teappVisual.visibleCss(${JSON.stringify(selector)})`, selector);
  const clicked = await client.evaluate(`(() => {
    const element = window.__teappVisual.visibleCss(${JSON.stringify(selector)});
    if (!element) return false;
    element.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Could not resolve selector: ${selector}`);
  await sleep(200);
};

const clickText = async (client, text, prefix = false) => {
  await waitFor(
    client,
    `window.__teappVisual.interactiveByText(${JSON.stringify(text)}, ${prefix})`,
    text,
  );
  const clicked = await client.evaluate(`(() => {
    const element = window.__teappVisual.interactiveByText(${JSON.stringify(text)}, ${prefix});
    if (!element) return false;
    element.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Could not resolve text: ${text}`);
  await sleep(200);
};

const setVisibleDialogInput = async (client, value) => client.evaluate(`(() => {
  const input = Array.from(document.querySelectorAll('[role="dialog"] input')).find(window.__teappVisual.visible);
  if (!input) throw new Error('No visible dialog input');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(input, ${JSON.stringify(value)});
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})()`);

const discoverTarget = async (forwardPort) => {
  const targets = await fetch(`http://127.0.0.1:${forwardPort}/json/list`).then((response) => response.json());
  const target = targets.find((candidate) => candidate.type === 'page');
  if (!target) throw new Error(`No page target exposed by ${serial}`);
  return target;
};

const waitForWebViewSocket = async () => {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const [{ stdout: pid }, { stdout: sockets }] = await Promise.all([
      adb('shell', 'pidof', 'com.teapp.app').catch(() => ({ stdout: '' })),
      adb('shell', 'cat', '/proc/net/unix'),
    ]);
    const socket = `webview_devtools_remote_${pid.trim()}`;
    if (pid.trim() && sockets.includes(socket)) return socket;
    await sleep(250);
  }
  throw new Error(`Timed out waiting for the Teapp WebView on ${serial}`);
};

const targetBounds = (target) => {
  try {
    const description = JSON.parse(target.description || '{}');
    if ([description.screenX, description.screenY, description.width, description.height].every(Number.isFinite)) {
      return description;
    }
  } catch {
    // Older WebViews may expose a non-JSON target description.
  }
  return null;
};

const run = async () => {
  await access(apkPath);
  const fixtureText = await readFile(VISUAL_FIXTURE_PATH, 'utf8');
  const source = await readSourceMetadata();
  await adb('uninstall', 'com.teapp.app').catch(() => undefined);
  await adb('install', apkPath);
  await Promise.all([
    adb('shell', 'settings', 'put', 'global', 'window_animation_scale', '0'),
    adb('shell', 'settings', 'put', 'global', 'transition_animation_scale', '0'),
    adb('shell', 'settings', 'put', 'global', 'animator_duration_scale', '0'),
    adb('shell', 'settings', 'put', 'system', 'font_scale', '1.0'),
    adb('shell', 'settings', 'put', 'system', 'accelerometer_rotation', '0'),
    adb('shell', 'settings', 'put', 'system', 'user_rotation', '0'),
  ]);
  await adb('shell', 'am', 'start', '-W', '-n', 'com.teapp.app/.MainActivity');

  const [{ stdout: sdk }, { stdout: model }, { stdout: screenSize }, { stdout: density }] = await Promise.all([
    adb('shell', 'getprop', 'ro.build.version.sdk'),
    adb('shell', 'getprop', 'ro.product.model'),
    adb('shell', 'wm', 'size'),
    adb('shell', 'wm', 'density'),
  ]);
  const targetName = `android-api${sdk.trim()}`;
  const targetDirectory = resolve(DEFAULT_VISUAL_OUTPUT_ROOT, targetName);
  const deviceDirectory = resolve(DEFAULT_VISUAL_OUTPUT_ROOT, `${targetName}-device`);
  await Promise.all([
    rm(targetDirectory, { force: true, recursive: true }),
    rm(deviceDirectory, { force: true, recursive: true }),
  ]);
  await Promise.all([mkdir(targetDirectory, { recursive: true }), mkdir(deviceDirectory, { recursive: true })]);

  let client;
  let forwardPort;
  let target;
  const connectWebView = async () => {
    const socket = await waitForWebViewSocket();
    const { stdout: forwardOutput } = await adb('forward', 'tcp:0', `localabstract:${socket}`);
    forwardPort = Number(forwardOutput.trim());
    target = await discoverTarget(forwardPort);
    client = await CdpClient.connect(target.webSocketDebuggerUrl.replace('localhost', '127.0.0.1'));
    await client.send('Runtime.enable');
    await client.send('Page.enable');
  };
  await connectWebView();
  const captures = [];

  const writeMetadata = async (captureError) => writeFile(resolve(targetDirectory, 'metadata.json'), `${JSON.stringify({
    androidSerial: serial,
    capturedAt: new Date().toISOString(),
    captures,
    density: density.trim(),
    ...(captureError ? { captureError } : {}),
    fixture: { now: '2026-08-11T12:00:00.000Z', path: VISUAL_FIXTURE_RELATIVE_PATH, seed: 'visual-parity-v1' },
    model: model.trim(),
    screenSize: screenSize.trim(),
    source,
    target: targetName,
    webViewTarget: { description: target.description, title: target.title, url: target.url },
  }, null, 2)}\n`, 'utf8');

  const capture = async (name) => {
    console.log(`[visual:${targetName}] capturing ${name}`);
    await sleep(150);
    const metrics = await client.evaluate(`({
      devicePixelRatio: window.devicePixelRatio,
      height: window.innerHeight,
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
      userAgent: navigator.userAgent,
      width: window.innerWidth,
    })`);
    const devicePath = resolve(deviceDirectory, `${name}.png`);
    const webViewPath = resolve(targetDirectory, `${name}.png`);
    const { stdout } = await adbBuffer('exec-out', 'screencap', '-p');
    await writeFile(devicePath, stdout);
    const bounds = targetBounds(await discoverTarget(forwardPort));
    if (bounds) {
      await execFile('magick', [
        devicePath,
        '-crop', `${bounds.width}x${bounds.height}+${bounds.screenX}+${bounds.screenY}`,
        '+repage',
        webViewPath,
      ]);
    } else {
      const screenshot = await client.send('Page.captureScreenshot', { format: 'png' });
      await writeFile(webViewPath, Buffer.from(screenshot.data, 'base64'));
    }
    captures.push({ name, metrics });
  };

  const openTab = async (tab) => clickCss(client, `ion-tab-button[tab="${tab}"]`);
  const textVisible = (text) => `window.__teappVisual.deepElements().some((element) => window.__teappVisual.visible(element) && (element.textContent || '').trim() === ${JSON.stringify(text)})`;
  const roleVisible = (role) => `window.__teappVisual.visibleCss('[role="${role}"]')`;

  try {
    await waitFor(client, `document.querySelector('ion-app')`, 'the Ionic app');
    await installDomDriver(client);
    await waitFor(client, roleVisible('dialog'), 'the first-run tutorial');
    await capture('tutorial');
    await clickText(client, 'Skip');

    await openTab('settings');
    await waitFor(client, `document.querySelector('#restore-file-input')`, 'the restore input');
    await client.evaluate(`(() => {
      const input = document.querySelector('#restore-file-input');
      const transfer = new DataTransfer();
      transfer.items.add(new File([${JSON.stringify(fixtureText)}], 'visual-parity-sample-data.json', { type: 'application/json' }));
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    await waitFor(client, textVisible('Confirm Restore'), 'the restore confirmation');
    await clickText(client, 'Restore');
    await sleep(2_500);
    // Restarting after import clears the closed native SQLite connection and
    // returns Capacitor to its origin root instead of reloading /tabs/settings.
    client.close();
    await adb('forward', '--remove', `tcp:${forwardPort}`).catch(() => undefined);
    await adb('shell', 'am', 'force-stop', 'com.teapp.app');
    await adb('shell', 'am', 'start', '-W', '-n', 'com.teapp.app/.MainActivity');
    await connectWebView();
    await waitFor(client, `document.querySelector('ion-app')`, 'the reloaded Ionic app');
    await installDomDriver(client);
    await openTab('settings');
    await waitFor(client, textVisible('Connect Mock Scale'), 'the mock-scale connection action');
    await clickText(client, 'Connect Mock Scale');
    await waitFor(client, textVisible('connected'), 'the connected mock scale');
    await capture('settings-mock-scale');

    await openTab('history');
    await waitFor(client, `window.__teappVisual.visibleCss('ion-item-sliding')`, 'populated history');
    await capture('history');
    await clickCss(client, '[aria-label^="Show history filters"]');
    await waitFor(client, `window.__teappVisual.visibleCss('input[aria-label="Filter Name"]')`, 'expanded history filters');
    await capture('history-filters');
    await clickCss(client, 'ion-button[aria-label="Open tea statistics"]');
    await waitFor(client, `window.__teappVisual.visibleCss('[aria-label="Statistics period"]')`, 'statistics');
    await capture('statistics');

    await openTab('history');
    await clickCss(client, 'ion-item-sliding ion-item');
    await waitFor(client, textVisible('Session overview'), 'session detail');
    await capture('session-detail');

    await openTab('brewing');
    await waitFor(client, textVisible('START SESSION'), 'the brewing idle state');
    await capture('brewing-idle');
    await clickText(client, 'START SESSION');
    await waitFor(client, textVisible('Confirm Setup'), 'the brewing setup state');

    const editSetupField = async (label, value, beforeSave) => {
      await clickText(client, label, true);
      await waitFor(client, roleVisible('dialog'), `${label} dialog`);
      if (beforeSave) await beforeSave();
      await setVisibleDialogInput(client, value);
      await clickText(client, 'Save');
      await waitFor(client, `!${roleVisible('dialog')}`, `${label} dialog to close`);
    };

    await editSetupField('Vessel', '120', () => capture('brewing-setup-modal'));
    await editSetupField('Lid', '35');
    await editSetupField('Dry tea weight', '6.5');
    await editSetupField('Vessel name', 'Visual Gaiwan');
    await capture('brewing-setup');
    await clickText(client, 'Confirm Setup');
    await waitFor(client, textVisible('Start Infusion'), 'the ready state');
    await capture('brewing-ready');
    await clickText(client, 'Start Infusion');
    await waitFor(client, textVisible('End Infusion'), 'the infusion state');
    await waitFor(client, `document.querySelector('[data-testid="primary-timer"]')?.textContent === '0:01'`, 'the infusion timer');
    await capture('brewing-infusion');
    await clickText(client, 'End Infusion');
    await waitFor(client, textVisible('Start Infusion'), 'the rest state');
    await waitFor(client, `document.querySelector('[data-testid="primary-timer"]')?.textContent === '0:01'`, 'the rest timer');
    await capture('brewing-rest');
    await clickText(client, 'End Session');
    await waitFor(client, textVisible('Start New Session'), 'the ended summary');
    await client.evaluate(`Promise.all(Array.from(document.querySelectorAll('ion-toast')).filter((toast) => toast.presented).map((toast) => toast.dismiss()))`);
    await capture('brewing-ended');

    await writeMetadata();
  } catch (error) {
    const failureName = captures.length === 0 ? 'startup-failure' : 'capture-failure';
    await capture(failureName).catch(() => undefined);
    await writeMetadata(error instanceof Error ? error.message : String(error));
    throw error;
  } finally {
    client?.close();
    if (forwardPort) await adb('forward', '--remove', `tcp:${forwardPort}`).catch(() => undefined);
  }
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
