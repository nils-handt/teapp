import { execFile as execFileCallback } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { PNG } from 'pngjs';
import { CdpClient } from './cdp-client.mjs';
import {
  assertCanonicalCaptures,
  VISUAL_FIXTURE,
  VISUAL_SETUP_VALUES,
} from './state-manifest.mjs';

const execFile = promisify(execFileCallback);

const createAdb = (serial) => ({
  buffer: (...args) => new Promise((resolveResult, reject) => {
    execFileCallback('adb', ['-s', serial, ...args], { encoding: 'buffer', maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(Object.assign(error, { stderr }));
        return;
      }
      resolveResult({ stdout, stderr });
    });
  }),
  text: (...args) => execFile('adb', ['-s', serial, ...args], { maxBuffer: 10 * 1024 * 1024 }),
});

let adb;
let adbBuffer;
let serial;

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
    if (rect.width <= 0 || rect.height <= 0) return false;
    let current = element;
    while (current instanceof Element) {
      const style = getComputedStyle(current);
      // Ionic starts some overlays at opacity 0 and applies the final state via
      // its animation controller. The capture stylesheet disables that
      // animation, so opacity is not a reliable interaction signal here.
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const root = current.getRootNode();
      current = current.parentElement || (root instanceof ShadowRoot ? root.host : null);
    }
    return true;
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

const waitForFonts = async (client) => {
  await client.evaluate('document.fonts.ready.then(() => true)');
  await sleep(100);
};

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

const focusVisibleDialogInput = async (client, forwardPort) => {
  const point = await client.evaluate(`(() => {
    const input = Array.from(document.querySelectorAll('[role="dialog"] input')).find(window.__teappVisual.visible);
    if (!input) throw new Error('No visible dialog input');
    const rect = input.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  const beforeTarget = await discoverTarget(forwardPort);
  const beforeBounds = targetBounds(beforeTarget);
  const devicePixelRatio = await client.evaluate('window.devicePixelRatio');
  if (beforeBounds && beforeBounds.height < beforeBounds.width * 1.2) {
    await sleep(350);
    return;
  }
  await client.send('Input.dispatchMouseEvent', { button: 'left', clickCount: 1, type: 'mousePressed', x: point.x, y: point.y });
  await client.send('Input.dispatchMouseEvent', { button: 'left', clickCount: 1, type: 'mouseReleased', x: point.x, y: point.y });
  if (beforeBounds) {
    await adb(
      'shell',
      'input',
      'tap',
      String(Math.round(beforeBounds.screenX + (point.x * devicePixelRatio))),
      String(Math.round(beforeBounds.screenY + (point.y * devicePixelRatio))),
    );
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const currentBounds = targetBounds(await discoverTarget(forwardPort));
      if (currentBounds && currentBounds.height < beforeBounds.height * 0.8) return;
      await sleep(150);
    }
    throw new Error('Timed out waiting for the Android software keyboard');
  }
  await sleep(350);
};

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

const cropPng = (sourceBuffer, bounds) => {
  const source = PNG.sync.read(sourceBuffer);
  const width = Math.min(bounds.width, source.width - bounds.screenX);
  const height = Math.min(bounds.height, source.height - bounds.screenY);
  const cropped = new PNG({ width, height });
  PNG.bitblt(source, cropped, bounds.screenX, bounds.screenY, width, height, 0, 0);
  return PNG.sync.write(cropped);
};

const dismissSystemUiDialog = async () => {
  const dumpPath = '/sdcard/teapp-visual-window.xml';
  await adb('shell', 'uiautomator', 'dump', dumpPath).catch(() => undefined);
  const { stdout: hierarchy = '' } = await adb('shell', 'cat', dumpPath).catch(() => ({ stdout: '' }));
  if (!hierarchy.includes("System UI isn't responding")) return;

  const waitButton = hierarchy.match(/text="Wait"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
  if (!waitButton) throw new Error('System UI dialog is blocking capture and its Wait action could not be located');
  const [, left, top, right, bottom] = waitButton.map(Number);
  await adb('shell', 'input', 'tap', String((left + right) / 2), String((top + bottom) / 2));
  await sleep(350);
};

export const withAndroidCaptureResources = async ({ cleanup, connect, run }) => {
  try {
    await connect();
    return await run();
  } finally {
    await cleanup();
  }
};

export const captureAndroid = async ({ avdName, fixturePath, outputRoot, serial: selectedSerial, source }) => {
  serial = selectedSerial;
  ({ text: adb, buffer: adbBuffer } = createAdb(serial));
  const apkPath = resolve('android/app/build/outputs/apk/debug/app-debug.apk');
  const fixtureText = await readFile(fixturePath, 'utf8');
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
  const targetName = 'android';
  const targetDirectory = resolve(outputRoot, 'android');
  const deviceDirectory = resolve(outputRoot, 'android-device');
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
  const captures = [];

  const metadataPath = resolve(outputRoot, 'metadata/android.json');
  const writeMetadata = async (captureError) => {
    const metadata = {
    apiLevel: sdk.trim(),
    androidSerial: serial,
    avdName,
    capturedAt: new Date().toISOString(),
    captures,
    density: density.trim(),
    ...(captureError ? { captureError } : {}),
    ...(captureError ? { partial: true } : {}),
    fixture: VISUAL_FIXTURE,
    model: model.trim(),
    screenSize: screenSize.trim(),
    source,
    target: targetName,
    webViewVersion: target.userAgent ?? 'recorded per capture',
    webViewTarget: { description: target.description, title: target.title, url: target.url },
  };
    const userAgent = captures[0]?.metrics?.userAgent ?? '';
    metadata.webViewVersion = userAgent.match(/Chrome\/([^\s]+)/)?.[1]
      ?? userAgent.match(/Version\/([^\s]+)/)?.[1]
      ?? 'unknown';
    await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
    return metadata;
  };

  const capture = async (name, { afterScreenshot, systemUiPrepared = false, recordPrimaryTimer = false } = {}) => {
    console.log(`[visual:${targetName}] capturing ${name}`);
    if (!systemUiPrepared) {
      await dismissSystemUiDialog();
    }
    await client.evaluate(`Promise.all(Array.from(document.querySelectorAll('ion-content')).map((content) => content.scrollToTop(0)))`);
    await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 0, y: 0 }).catch(() => undefined);
    await sleep(150);
    const captureStartedAt = new Date().toISOString();
    const primaryTimerBefore = recordPrimaryTimer
      ? await client.evaluate(`(() => { const timer = document.querySelector('[data-testid="primary-timer"]'); return timer && timer.textContent ? timer.textContent.trim() : null; })()`)
      : undefined;
    const metrics = await client.evaluate(`(async () => ({
      devicePixelRatio: window.devicePixelRatio,
      height: window.innerHeight,
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
      route: window.location.hash.replace(/^#/, '') || window.location.pathname,
      scrollTops: await Promise.all(Array.from(document.querySelectorAll('ion-content')).map(async (content) => (await content.getScrollElement()).scrollTop)),
      userAgent: navigator.userAgent,
      width: window.innerWidth,
    }))()`);
    const devicePath = resolve(deviceDirectory, `${name}.png`);
    const webViewPath = resolve(targetDirectory, `${name}.png`);
    const { stdout } = await adbBuffer('exec-out', 'screencap', '-p');
    if (recordPrimaryTimer) {
      metrics.captureTiming = {
        captureStartedAt,
        primaryTimerBefore,
        primaryTimerAfter: await client.evaluate(`(() => { const timer = document.querySelector('[data-testid="primary-timer"]'); return timer && timer.textContent ? timer.textContent.trim() : null; })()`),
        screenshotCompletedAt: new Date().toISOString(),
      };
    }
    if (afterScreenshot) {
      await afterScreenshot();
    }
    await writeFile(devicePath, stdout);
    const bounds = targetBounds(await discoverTarget(forwardPort));
    if (bounds) {
      await writeFile(webViewPath, cropPng(stdout, bounds));
    } else {
      const screenshot = await client.send('Page.captureScreenshot', { format: 'png' });
      await writeFile(webViewPath, Buffer.from(screenshot.data, 'base64'));
    }
    captures.push({ name, metrics });
  };

  const openTab = async (tab) => {
    await clickCss(client, `ion-tab-button[tab="${tab}"]`);
    await waitFor(client, `window.location.pathname.startsWith('/tabs/${tab}')`, `${tab} tab route`);
    await sleep(500);
  };
  const textVisible = (text) => `window.__teappVisual.deepElements().some((element) => window.__teappVisual.visible(element) && (element.textContent || '').trim() === ${JSON.stringify(text)})`;
  const roleVisible = (role) => `window.__teappVisual.visibleCss('[role="${role}"]')`;

  const runCaptureJourney = async () => {
    await waitFor(client, `document.querySelector('ion-app')`, 'the Ionic app');
    await installDomDriver(client);
    await waitForFonts(client);
    await waitFor(client, roleVisible('dialog'), 'the first-run tutorial');
    await dismissSystemUiDialog();
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
    // A native location replacement creates a new WebView page target. Reattach
    // to that target without restarting the Activity; the fixture-backed action
    // below is the readiness signal for both reload and database initialization.
    await sleep(2_500);
    client.close();
    await adb('forward', '--remove', `tcp:${forwardPort}`).catch(() => undefined);
    await connectWebView();
    await waitFor(client, `document.querySelector('ion-app')`, 'the restored app reload');
    await installDomDriver(client);
    await waitForFonts(client);
    await waitFor(client, textVisible('CONNECT TO SCALE'), 'the restored app bootstrap');
    await dismissSystemUiDialog();
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
    await waitFor(client, textVisible('24 sessions'), 'the populated statistics summary');
    await capture('statistics');

    await openTab('history');
    await clickCss(client, 'ion-item-sliding ion-item');
    await waitFor(client, textVisible('Session overview'), 'session detail');
    await capture('session-detail');
    await clickCss(client, 'section button:has(h2)');
    await waitFor(client, roleVisible('dialog'), 'tea editor');
    await clickText(client, 'Edit Tea');
    await waitFor(client, `window.__teappVisual.visibleCss('[role="dialog"] input[aria-label="Name"]')`, 'the tea edit form');
    await capture('tea-edit-modal');
    await clickText(client, 'Cancel');
    await waitFor(client, `!${roleVisible('dialog')}`, 'the tea editor to close');

    await openTab('brewing');
    await waitFor(client, textVisible('START SESSION'), 'the brewing idle state');
    await capture('brewing-idle');
    await clickText(client, 'START SESSION');
    await waitFor(client, textVisible('Confirm Setup'), 'the brewing setup state');

    const editSetupField = async (label, value, beforeSave) => {
      await clickText(client, label, true);
      await waitFor(client, roleVisible('dialog'), `${label} dialog`);
      if (beforeSave) {
        await focusVisibleDialogInput(client, forwardPort);
        await beforeSave();
      } else {
        await client.evaluate(`(() => {
          const input = Array.from(document.querySelectorAll('[role="dialog"] input')).find(window.__teappVisual.visible);
          if (!input) throw new Error('No visible dialog input');
          input.focus();
          return document.activeElement === input;
        })()`);
        await sleep(100);
      }
      await setVisibleDialogInput(client, value);
      await clickText(client, 'Save');
      await waitFor(client, `!${roleVisible('dialog')}`, `${label} dialog to close`);
    };

    await editSetupField('Vessel', VISUAL_SETUP_VALUES.vessel, () => capture('brewing-setup-modal'));
    await editSetupField('Lid', VISUAL_SETUP_VALUES.lid);
    await editSetupField('Dry tea weight', VISUAL_SETUP_VALUES.dryTeaWeight);
    await editSetupField('Vessel name', VISUAL_SETUP_VALUES.vesselName);
    await capture('brewing-setup');
    await clickText(client, 'Confirm Setup');
    await waitFor(client, textVisible('Start Infusion'), 'the ready state');
    await capture('brewing-ready');
    await dismissSystemUiDialog();
    await clickText(client, 'Start Infusion');
    await waitFor(client, textVisible('End Infusion'), 'the infusion state');
    await waitFor(client, `(() => { const timer = document.querySelector('[data-testid="primary-timer"]'); return timer && timer.textContent.trim() === '0:01'; })()`, 'the infusion timer');
    await capture('brewing-infusion', {
      afterScreenshot: async () => {
        await clickText(client, 'End Infusion');
        await waitFor(client, textVisible('Start Infusion'), 'the rest state');
      },
      systemUiPrepared: true,
      recordPrimaryTimer: true,
    });
    await waitFor(client, `(() => { const timer = document.querySelector('[data-testid="primary-timer"]'); return timer && timer.textContent.trim() === '0:01'; })()`, 'the rest timer');
    await capture('brewing-rest', { systemUiPrepared: true, recordPrimaryTimer: true });
    await clickText(client, 'End Session');
    await waitFor(client, textVisible('Start New Session'), 'the ended summary');
    await client.evaluate(`Promise.all(Array.from(document.querySelectorAll('ion-toast')).filter((toast) => toast.presented).map((toast) => toast.dismiss()))`);
    await capture('brewing-ended');

    assertCanonicalCaptures(captures);
    return await writeMetadata();
  };

  return withAndroidCaptureResources({
    cleanup: async () => {
      client?.close();
      if (forwardPort) await adb('forward', '--remove', `tcp:${forwardPort}`).catch(() => undefined);
    },
    connect: connectWebView,
    run: async () => {
      try {
        return await runCaptureJourney();
      } catch (error) {
        await writeMetadata(error instanceof Error ? error.message : String(error));
        throw error;
      }
    },
  });
};
