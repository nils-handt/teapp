import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  assertCanonicalCaptures,
  VISUAL_FIXTURE,
  VISUAL_SETUP_VALUES,
} from './state-manifest.mjs';

const webStabilizationCss = `
  *, *::before, *::after {
    animation-delay: 0s !important;
    animation-duration: 0s !important;
    caret-color: transparent !important;
    scroll-behavior: auto !important;
    transition-delay: 0s !important;
    transition-duration: 0s !important;
  }
  ion-ripple-effect { display: none !important; }
`;

const waitForApp = async (page) => {
  await page.locator('ion-app').waitFor({ state: 'visible', timeout: 30_000 });
  await page.addStyleTag({ content: webStabilizationCss });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
};

const resetCaptureState = async (page) => {
  await page.locator('ion-content').evaluateAll(async (contents) => {
    await Promise.all(contents.map((content) => content.scrollToTop(0)));
  });
  // Avoid carrying a desktop hover state from the previous navigation click.
  await page.mouse.move(0, 0);
  await page.waitForTimeout(150);
};

const dismissTransientAlerts = async (page) => {
  await page.locator('ion-alert').evaluateAll(async (alerts) => {
    await Promise.all(alerts.filter((alert) => alert.presented).map((alert) => alert.dismiss()));
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

  const alert = page.locator('ion-alert').filter({ hasText: 'Confirm Restore' });
  await alert.waitFor({ state: 'visible' });
  const reload = page.waitForEvent('load', { timeout: 30_000 });
  await alert.getByRole('button', { name: 'Restore', exact: true }).click();
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
  if (beforeSave) await beforeSave();
  await input.fill(value);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
};

const browserMetrics = async () => ({
  devicePixelRatio: window.devicePixelRatio,
  hash: window.location.hash,
  height: window.innerHeight,
  pathname: window.location.pathname,
  route: window.location.hash.replace(/^#/, '') || window.location.pathname,
  search: window.location.search,
  scrollTops: await Promise.all(Array.from(document.querySelectorAll('ion-content')).map(async (content) => (
    (await content.getScrollElement()).scrollTop
  ))),
  userAgent: navigator.userAgent,
  width: window.innerWidth,
});

export async function captureWebJourney({
  page,
  screenshotDirectory,
  metadataPath,
  fixturePath,
  source,
  browserVersion,
}) {
  await mkdir(screenshotDirectory, { recursive: true });
  const fixtureText = await readFile(fixturePath, 'utf8');
  const captures = [];

  const writeMetadata = async (captureError) => {
    const metadata = {
      browserVersion,
      capturedAt: new Date().toISOString(),
      captures,
      ...(captureError ? { captureError, partial: true } : {}),
      fixture: VISUAL_FIXTURE,
      source,
      target: 'web',
    };
    await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
    return metadata;
  };

  const capture = async (name) => {
    console.log(`[visual:web] capturing ${name}`);
    await resetCaptureState(page);
    const metrics = await page.evaluate(browserMetrics);
    await page.screenshot({
      animations: 'disabled',
      fullPage: false,
      path: resolve(screenshotDirectory, `${name}.png`),
    });
    captures.push({ name, metrics });
  };

  try {
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
    await page.getByText('24 sessions', { exact: true }).waitFor({ state: 'visible' });
    await capture('statistics');

    await openTab(page, 'history');
    await page.locator('ion-item-sliding ion-item').first().click();
    await page.getByText('Session overview', { exact: true }).waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Delete session', exact: true }).waitFor({ state: 'visible' });
    await capture('session-detail');

    await openTab(page, 'brewing');
    await page.getByRole('button', { name: 'START SESSION', exact: true }).waitFor({ state: 'visible' });
    await capture('brewing-idle');
    await page.getByRole('button', { name: 'START SESSION', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm Setup', exact: true }).waitFor({ state: 'visible' });
    await editSetupField(page, 'Vessel', VISUAL_SETUP_VALUES.vessel, () => capture('brewing-setup-modal'));
    await editSetupField(page, 'Lid', VISUAL_SETUP_VALUES.lid);
    await editSetupField(page, 'Dry tea weight', VISUAL_SETUP_VALUES.dryTeaWeight);
    await editSetupField(page, 'Vessel name', VISUAL_SETUP_VALUES.vesselName);
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
      await Promise.all(toasts.filter((toast) => toast.presented).map((toast) => toast.dismiss()));
    });
    await capture('brewing-ended');

    assertCanonicalCaptures(captures);
    return await writeMetadata();
  } catch (error) {
    await writeMetadata(error instanceof Error ? error.message : String(error));
    throw error;
  }
}
