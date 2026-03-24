import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

type ConnectionStatus = 'disconnected' | 'scanning' | 'connecting' | 'connected';

type ConsoleEntry = {
  at: string;
  type: string;
  text: string;
  location: ReturnType<import('@playwright/test').ConsoleMessage['location']>;
};

type BrowserCapabilities = {
  userAgent: string;
  hasBluetooth: boolean;
  bluetoothGetDevicesType: string;
  bluetoothRequestDeviceType: string;
  bluetoothDeviceWatchAdvertisementsType: string;
};

type VisibleState = {
  statusCardText: string | null;
  parsedStatus: ConnectionStatus | null;
  connectedDeviceCardText: string | null;
  connectButtonVisible: boolean;
  disconnectButtonVisible: boolean;
};

type CheckpointRecord = {
  name: string;
  capturedAt: string;
  browserCapabilities: BrowserCapabilities;
  visibleState: VisibleState;
  manualInteractionNote: string;
};

const SETTINGS_URL = '/#/tabs/settings';
const EXPECTED_DEVICE_NAME = 'BOOKOO_SC_U 762037';
const MANUAL_INTERACTION_NOTE = process.env.TEAPP_MANUAL_INTERACTION_NOTE
  ?? 'If Chromium or the OS displayed a Bluetooth chooser, manual selection of BOOKOO_SC_U 762037 was required.';

const qaInventory = {
  claims: [
    'The Settings screen shows Bluetooth connection status clearly.',
    'A newly paired BOOKOO scale is persisted as the preferred device.',
    'Reloading the app attempts startup reconnect without clicking Connect New Scale again.',
    'A second reload after 30 seconds may behave differently once the scale has fully disconnected.',
  ],
  controls: [
    'Settings tab navigation',
    'Connect New Scale button',
    'Browser/system Bluetooth chooser handled manually when required',
    'Page reload',
  ],
  exploratoryScenarios: [
    'Immediate reload right after first successful connection',
    'Second reload after observing the first reload state for 30 seconds',
  ],
};

function parseConnectionStatus(text: string | null): ConnectionStatus | null {
  const match = text?.toLowerCase().match(/\b(disconnected|scanning|connecting|connected)\b/);
  if (!match) {
    return null;
  }

  return match[1] as ConnectionStatus;
}

function hasConsoleText(consoleEntries: ConsoleEntry[], needle: string): boolean {
  return consoleEntries.some((entry) => entry.text.includes(needle));
}

async function readVisibleState(page: Page): Promise<VisibleState> {
  const statusCard = page.locator('ion-item').filter({ hasText: 'Status' }).first();
  const connectedDeviceCard = page.locator('ion-item').filter({ hasText: 'Connected Device' }).first();
  const connectButton = page.getByRole('button', { name: /connect new scale/i });
  const disconnectButton = page.getByRole('button', { name: /disconnect/i });
  const statusCardText = await statusCard.textContent();
  const connectedDeviceCardText = await connectedDeviceCard.count() > 0
    ? await connectedDeviceCard.textContent()
    : null;

  return {
    statusCardText,
    parsedStatus: parseConnectionStatus(statusCardText),
    connectedDeviceCardText,
    connectButtonVisible: await connectButton.isVisible().catch(() => false),
    disconnectButtonVisible: await disconnectButton.isVisible().catch(() => false),
  };
}

async function readBrowserCapabilities(page: Page): Promise<BrowserCapabilities> {
  return page.evaluate(() => {
    const navigatorWithBluetooth = navigator as Navigator & {
      bluetooth?: {
        getDevices?: unknown;
        requestDevice?: unknown;
      };
    };
    const bluetoothDeviceCtor = window.BluetoothDevice as
      | { prototype?: { watchAdvertisements?: unknown } }
      | undefined;

    return {
      userAgent: navigator.userAgent,
      hasBluetooth: Boolean(navigatorWithBluetooth.bluetooth),
      bluetoothGetDevicesType: typeof navigatorWithBluetooth.bluetooth?.getDevices,
      bluetoothRequestDeviceType: typeof navigatorWithBluetooth.bluetooth?.requestDevice,
      bluetoothDeviceWatchAdvertisementsType: typeof bluetoothDeviceCtor?.prototype?.watchAdvertisements,
    };
  });
}

async function captureCheckpoint(
  page: Page,
  testInfo: TestInfo,
  name: string,
  manualInteractionNote: string,
): Promise<CheckpointRecord> {
  const safeName = name.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase();
  const screenshotPath = testInfo.outputPath(`${safeName}.png`);
  const recordPath = testInfo.outputPath(`${safeName}.json`);

  const record: CheckpointRecord = {
    name,
    capturedAt: new Date().toISOString(),
    browserCapabilities: await readBrowserCapabilities(page),
    visibleState: await readVisibleState(page),
    manualInteractionNote,
  };

  await page.screenshot({ path: screenshotPath, fullPage: false });
  await writeFile(recordPath, JSON.stringify(record, null, 2), 'utf8');
  await testInfo.attach(name, {
    path: screenshotPath,
    contentType: 'image/png',
  });
  await testInfo.attach(`${name}-json`, {
    body: JSON.stringify(record, null, 2),
    contentType: 'application/json',
  });

  return record;
}

async function waitForStatus(page: Page, status: ConnectionStatus, timeout: number, message: string): Promise<void> {
  await expect.poll(
    async () => (await readVisibleState(page)).parsedStatus,
    { timeout, message },
  ).toBe(status);
}

async function waitForConnectedBookoo(page: Page): Promise<void> {
  await waitForStatus(
    page,
    'connected',
    90_000,
    'Waiting for the app to connect. If a browser or OS Bluetooth chooser appears, select BOOKOO_SC_U 762037.',
  );

  await expect.poll(
    async () => (await readVisibleState(page)).connectedDeviceCardText,
    {
      timeout: 30_000,
      message: 'Waiting for the connected device card to show BOOKOO_SC_U 762037.',
    },
  ).toContain(EXPECTED_DEVICE_NAME);
}

async function observeReloadWindow(
  page: Page,
  testInfo: TestInfo,
  prefix: string,
  manualInteractionNote: string,
): Promise<CheckpointRecord[]> {
  const checkpoints: CheckpointRecord[] = [];

  checkpoints.push(await captureCheckpoint(page, testInfo, `${prefix}-immediate`, manualInteractionNote));
  await page.waitForTimeout(10_000);
  checkpoints.push(await captureCheckpoint(page, testInfo, `${prefix}-10s`, manualInteractionNote));
  await page.waitForTimeout(20_000);
  checkpoints.push(await captureCheckpoint(page, testInfo, `${prefix}-30s`, manualInteractionNote));

  return checkpoints;
}

test.describe('scale reconnect debug harness', () => {
  test('captures reconnect evidence across two reload windows', async ({ page }, testInfo) => {
    test.slow();

    const consoleEntries: ConsoleEntry[] = [];
    const checkpointNames: string[] = [];
    page.on('console', (message) => {
      consoleEntries.push({
        at: new Date().toISOString(),
        type: message.type(),
        text: message.text(),
        location: message.location(),
      });
    });
    page.on('pageerror', (error) => {
      consoleEntries.push({
        at: new Date().toISOString(),
        type: 'pageerror',
        text: error.message,
        location: { url: page.url(), lineNumber: 0, columnNumber: 0 },
      });
    });

    await page.goto(SETTINGS_URL, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Settings').first()).toBeVisible();

    await mkdir(testInfo.outputDir, { recursive: true });
    await testInfo.attach('qa-inventory', {
      body: JSON.stringify(qaInventory, null, 2),
      contentType: 'application/json',
    });

    await captureCheckpoint(page, testInfo, 'initial-status', MANUAL_INTERACTION_NOTE);
    checkpointNames.push('initial-status');

    const connectButton = page.getByRole('button', { name: /connect new scale/i });
    await expect(connectButton).toBeVisible();
    await connectButton.click();
    await page.waitForTimeout(1_000);
    await captureCheckpoint(page, testInfo, 'after-connect-click', MANUAL_INTERACTION_NOTE);
    checkpointNames.push('after-connect-click');

    let firstReloadCheckpoints: CheckpointRecord[] = [];
    let secondReloadCheckpoints: CheckpointRecord[] = [];
    let runError: Error | null = null;

    try {
      await waitForConnectedBookoo(page);
      await captureCheckpoint(page, testInfo, 'connected-before-reload', MANUAL_INTERACTION_NOTE);
      checkpointNames.push('connected-before-reload');

      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByText('Settings').first()).toBeVisible();
      firstReloadCheckpoints = await observeReloadWindow(page, testInfo, 'first-reload', MANUAL_INTERACTION_NOTE);
      checkpointNames.push(...firstReloadCheckpoints.map((checkpoint) => checkpoint.name));

      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByText('Settings').first()).toBeVisible();
      secondReloadCheckpoints = await observeReloadWindow(page, testInfo, 'second-reload', MANUAL_INTERACTION_NOTE);
      checkpointNames.push(...secondReloadCheckpoints.map((checkpoint) => checkpoint.name));
    } catch (error) {
      runError = error instanceof Error ? error : new Error(String(error));
      await captureCheckpoint(page, testInfo, 'connect-timeout-state', MANUAL_INTERACTION_NOTE);
      checkpointNames.push('connect-timeout-state');
    } finally {
      const lastFirstReloadCheckpoint = firstReloadCheckpoints[firstReloadCheckpoints.length - 1] ?? null;
      const lastSecondReloadCheckpoint = secondReloadCheckpoints[secondReloadCheckpoints.length - 1] ?? null;
      const finalVisibleState = await readVisibleState(page);
      const finalCapabilities = await readBrowserCapabilities(page);
      const summary = {
        generatedAt: new Date().toISOString(),
        projectName: testInfo.project.name,
        manualInteractionNote: MANUAL_INTERACTION_NOTE,
        checkpoints: checkpointNames,
        finalCapabilities,
        finalVisibleState,
        firstReloadFinalState: lastFirstReloadCheckpoint?.visibleState ?? null,
        secondReloadFinalState: lastSecondReloadCheckpoint?.visibleState ?? null,
        firstReloadBrowserCapabilities: lastFirstReloadCheckpoint?.browserCapabilities ?? null,
        secondReloadBrowserCapabilities: lastSecondReloadCheckpoint?.browserCapabilities ?? null,
        consoleSignals: {
          sawAutoConnectAttempt: hasConsoleText(consoleEntries, 'Attempting to auto-connect to preferred device'),
          sawBrowserUnsupported: hasConsoleText(consoleEntries, 'Browser does not support restoring permitted Bluetooth devices with advertisement watching'),
          sawMissingPermittedDevice: hasConsoleText(consoleEntries, 'was not returned from remembered web devices. Skipping auto-connect.'),
          sawAdvertisementTimeout: hasConsoleText(consoleEntries, 'Timed out waiting for advertisements'),
          sawAdvertisementObserved: hasConsoleText(consoleEntries, 'Observed advertisement for'),
          sawWebAutoConnectFailure: hasConsoleText(consoleEntries, 'Web auto-connect failed'),
        },
        consoleTail: consoleEntries.slice(-10).map((entry) => ({
          at: entry.at,
          type: entry.type,
          text: entry.text,
        })),
        error: runError?.message ?? null,
      };

      await writeFile(
        testInfo.outputPath('console-log.json'),
        JSON.stringify(consoleEntries, null, 2),
        'utf8',
      );
      await writeFile(
        testInfo.outputPath('summary.json'),
        JSON.stringify(summary, null, 2),
        'utf8',
      );
      await testInfo.attach('console-log', {
        body: JSON.stringify(consoleEntries, null, 2),
        contentType: 'application/json',
      });
      await testInfo.attach('summary', {
        body: JSON.stringify(summary, null, 2),
        contentType: 'application/json',
      });
    }

    if (runError) {
      throw runError;
    }
  });
});
