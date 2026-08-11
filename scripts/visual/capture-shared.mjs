import { execFile as execFileCallback } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);
export const VISUAL_FIXTURE_RELATIVE_PATH = 'tmp/visual-parity/sample-data.json';
export const VISUAL_FIXTURE_PATH = resolve(VISUAL_FIXTURE_RELATIVE_PATH);
export const DEFAULT_VISUAL_OUTPUT_ROOT = resolve(process.env.VISUAL_OUTPUT_ROOT ?? 'tests/visual/baselines/reference');

export const readSourceMetadata = async () => {
  const [{ stdout: revision }, { stdout: status }] = await Promise.all([
    execFile('git', ['rev-parse', 'HEAD']),
    execFile('git', ['status', '--porcelain']),
  ]);
  return { revision: revision.trim(), workingTreeDirty: status.trim().length > 0 };
};

const stabilizationCss = `
  *, *::before, *::after {
    animation-delay: 0s !important;
    animation-duration: 0s !important;
    caret-color: transparent !important;
    scroll-behavior: auto !important;
    transition-delay: 0s !important;
    transition-duration: 0s !important;
  }

  ion-ripple-effect {
    display: none !important;
  }
`;

const visible = async (locator) => locator.isVisible().catch(() => false);

const clickIfVisible = async (locator) => {
  if (await visible(locator)) {
    await locator.click();
    return true;
  }
  return false;
};

const waitForApp = async (page) => {
  await page.locator('ion-app').waitFor({ state: 'visible', timeout: 30_000 });
  await page.addStyleTag({ content: stabilizationCss });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
};

const resetScrollPosition = async (page) => {
  await page.locator('ion-content').evaluateAll(async (contents) => {
    await Promise.all(contents.map((content) => content.scrollToTop(0)));
  });
  await page.waitForTimeout(50);
};

const dismissTransientAlerts = async (page) => {
  await page.locator('ion-alert').evaluateAll(async (alerts) => {
    const presentedAlerts = alerts.filter((alert) => alert.presented === true);
    await Promise.all(presentedAlerts.map((alert) => alert.dismiss()));
  });
  await page.waitForTimeout(150);
};

const openTab = async (page, tab) => {
  await page.locator(`ion-tab-button[tab="${tab}"]`).click();
  await page.waitForTimeout(350);
};

const restoreFixture = async (page, fixtureText) => {
  await page.locator('#restore-file-input').evaluate((input, contents) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([contents], 'visual-parity-sample-data.json', { type: 'application/json' }));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, fixtureText);

  const confirmAlert = page.locator('ion-alert').filter({ hasText: 'Confirm Restore' });
  await confirmAlert.waitFor({ state: 'visible' });
  const reload = page.waitForEvent('load', { timeout: 30_000 });
  await confirmAlert.getByRole('button', { name: 'Restore', exact: true }).click();
  await reload;
  await waitForApp(page);
  await dismissTransientAlerts(page);
};

const editSetupField = async (page, label, value, beforeSave) => {
  const field = page.locator('button:not([disabled])')
    .filter({ hasText: new RegExp(`^${label}`) })
    .filter({ visible: true })
    .first();
  await field.click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ state: 'visible' });
  const input = dialog.locator('input').first();
  await input.waitFor({ state: 'visible' });
  await input.focus();
  if (beforeSave) {
    await beforeSave();
  }
  await input.fill(value);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
};

export async function captureVisualStateRecipe({
  page,
  target,
  outputRoot = DEFAULT_VISUAL_OUTPUT_ROOT,
  captureDeviceScreenshot,
  extraMetadata = {},
}) {
  const targetDirectory = resolve(outputRoot, target);
  const deviceDirectory = resolve(outputRoot, `${target}-device`);
  const fixtureText = await readFile(VISUAL_FIXTURE_PATH, 'utf8');
  const source = await readSourceMetadata();
  const captures = [];

  await rm(targetDirectory, { force: true, recursive: true });
  await mkdir(targetDirectory, { recursive: true });
  if (captureDeviceScreenshot) {
    await rm(deviceDirectory, { force: true, recursive: true });
    await mkdir(deviceDirectory, { recursive: true });
  }

  const capture = async (name) => {
    console.log(`[visual:${target}] capturing ${name}`);
    await resetScrollPosition(page);
    await page.waitForTimeout(150);
    const metrics = await page.evaluate(() => ({
      devicePixelRatio: window.devicePixelRatio,
      height: window.innerHeight,
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
      userAgent: navigator.userAgent,
      width: window.innerWidth,
    }));
    const screenshotPath = resolve(targetDirectory, `${name}.png`);
    await page.screenshot({ path: screenshotPath, animations: 'disabled', fullPage: false });
    if (captureDeviceScreenshot) {
      await captureDeviceScreenshot(resolve(deviceDirectory, `${name}.png`));
    }
    captures.push({ name, metrics });
  };

  await waitForApp(page);
  await dismissTransientAlerts(page);
  await page.getByRole('dialog').waitFor({ state: 'visible' });
  await capture('tutorial');
  await page.getByRole('button', { name: 'Skip', exact: true }).click();

  await openTab(page, 'settings');
  await restoreFixture(page, fixtureText);
  await openTab(page, 'settings');

  const connectMockScale = page.getByRole('button', { name: 'Connect Mock Scale', exact: true });
  await connectMockScale.waitFor({ state: 'visible' });
  await connectMockScale.click();
  await page.getByText('connected', { exact: true }).waitFor({ state: 'visible' });
  await capture('settings-mock-scale');

  await openTab(page, 'history');
  await page.getByTestId('history-page').waitFor({ state: 'visible' });
  await page.locator('ion-item-sliding').first().waitFor({ state: 'visible' });
  await capture('history');

  await page.getByRole('button', { name: /^Show history filters/ }).click();
  await page.getByRole('combobox', { name: 'Filter Name', exact: true }).waitFor({ state: 'visible' });
  await capture('history-filters');

  await page.locator('ion-button[aria-label="Open tea statistics"]').click();
  await page.getByRole('group', { name: 'Statistics period' }).waitFor({ state: 'visible' });
  await page.getByText(/sessions$/).first().waitFor({ state: 'visible' });
  await capture('statistics');

  await openTab(page, 'history');
  const firstSession = page.locator('ion-item-sliding ion-item').first();
  await firstSession.click();
  await page.getByText('Session overview', { exact: true }).waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Delete session', exact: true }).waitFor({ state: 'visible' });
  await capture('session-detail');

  await openTab(page, 'brewing');
  await page.getByRole('button', { name: 'START SESSION', exact: true }).waitFor({ state: 'visible' });
  await capture('brewing-idle');
  await page.getByRole('button', { name: 'START SESSION', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm Setup', exact: true }).waitFor({ state: 'visible' });

  await editSetupField(page, 'Vessel', '120', () => capture('brewing-setup-modal'));
  await editSetupField(page, 'Lid', '35');
  await editSetupField(page, 'Dry tea weight', '6.5');
  await editSetupField(page, 'Vessel name', 'Visual Gaiwan');
  await capture('brewing-setup');

  await page.getByRole('button', { name: 'Confirm Setup', exact: true }).click();
  await page.getByRole('button', { name: 'Start Infusion', exact: true }).waitFor({ state: 'visible' });
  await capture('brewing-ready');

  await page.getByRole('button', { name: 'Start Infusion', exact: true }).click();
  await page.getByRole('button', { name: 'End Infusion', exact: true }).waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelector('[data-testid="primary-timer"]')?.textContent?.trim() === '0:01');
  await capture('brewing-infusion');

  await page.getByRole('button', { name: 'End Infusion', exact: true }).click();
  await page.getByRole('button', { name: 'Start Infusion', exact: true }).waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelector('[data-testid="primary-timer"]')?.textContent?.trim() === '0:01');
  await capture('brewing-rest');

  await page.getByRole('button', { name: 'End Session', exact: true }).click();
  await page.getByRole('button', { name: 'Start New Session', exact: true }).waitFor({ state: 'visible' });
  await page.locator('ion-toast').evaluateAll(async (toasts) => {
    await Promise.all(toasts.filter((toast) => toast.presented === true).map((toast) => toast.dismiss()));
  });
  await capture('brewing-ended');

  const metadata = {
    capturedAt: new Date().toISOString(),
    captures,
    fixture: {
      path: VISUAL_FIXTURE_RELATIVE_PATH,
      seed: 'visual-parity-v1',
      now: '2026-08-11T12:00:00.000Z',
    },
    source,
    target,
    ...extraMetadata,
  };
  await writeFile(resolve(targetDirectory, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
  return metadata;
}

export async function closeUnexpectedDialogs(page) {
  await clickIfVisible(page.getByRole('button', { name: 'Cancel', exact: true }));
}
