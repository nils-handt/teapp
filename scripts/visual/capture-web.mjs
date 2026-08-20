import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { captureWebJourney } from './capture-web-journey.mjs';

const viewport = { width: 411, height: 683 };

const getAvailablePort = async () => new Promise((resolvePort, reject) => {
  const server = createServer();
  server.unref();
  server.on('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    if (!address || typeof address === 'string') {
      server.close();
      reject(new Error('Could not allocate a local preview port'));
      return;
    }
    server.close(() => resolvePort(address.port));
  });
});

const waitForHttp = async (url, timeoutMs = 30_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Vite may still be starting.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 200));
  }
  throw new Error(`Timed out waiting for the Vite preview at ${url}`);
};

export async function captureWeb({ outputRoot, fixturePath, source }) {
  const port = await getAvailablePort();
  if (port === 5173) throw new Error('Visual parity must not use port 5173');

  const preview = spawn(process.execPath, [
    'node_modules/vite/bin/vite.js',
    'preview',
    '--configLoader', 'native',
    '--host', '127.0.0.1',
    '--port', String(port),
    '--strictPort',
  ], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] });
  let previewOutput = '';
  preview.stdout.on('data', (chunk) => { previewOutput += chunk; });
  preview.stderr.on('data', (chunk) => { previewOutput += chunk; });

  let browser;
  let context;
  try {
    const url = `http://127.0.0.1:${port}`;
    await waitForHttp(url);
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({
      colorScheme: 'light',
      deviceScaleFactor: 1,
      locale: 'en-US',
      reducedMotion: 'reduce',
      timezoneId: 'UTC',
      viewport,
    });
    const page = await context.newPage();
    page.on('console', (message) => {
      if (message.type() === 'error') console.error(`[browser] ${message.text()}`);
    });
    page.on('pageerror', (error) => console.error(`[browser] ${error.message}`));
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    return await captureWebJourney({
      browserVersion: browser.version(),
      fixturePath,
      metadataPath: resolve(outputRoot, 'metadata/web.json'),
      page,
      screenshotDirectory: resolve(outputRoot, 'web'),
      source,
    });
  } catch (error) {
    if (preview.exitCode !== null) {
      throw new Error(`Vite preview exited with code ${preview.exitCode}:\n${previewOutput}`, { cause: error });
    }
    throw error;
  } finally {
    await context?.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
    if (preview.exitCode === null) preview.kill('SIGTERM');
  }
}
