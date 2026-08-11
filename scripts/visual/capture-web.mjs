#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { chromium } from 'playwright';
import { captureVisualStateRecipe } from './capture-shared.mjs';

const webViewReferenceViewport = { width: 411, height: 683 };

const getAvailablePort = async () => new Promise((resolvePort, reject) => {
  const server = createServer();
  server.unref();
  server.on('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    if (!address || typeof address === 'string') {
      server.close();
      reject(new Error('Could not resolve an available visual-test port'));
      return;
    }
    const { port } = address;
    server.close(() => resolvePort(port));
  });
});

const waitForHttp = async (url, timeoutMs = 30_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The preview process may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${url}`);
};

const run = async () => {
  const port = await getAvailablePort();
  if (port === 5173) {
    throw new Error('Visual capture must not use port 5173');
  }

  const preview = spawn(
    process.execPath,
    ['node_modules/vite/bin/vite.js', 'preview', '--configLoader', 'native', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let previewOutput = '';
  preview.stdout.on('data', (chunk) => { previewOutput += chunk; });
  preview.stderr.on('data', (chunk) => { previewOutput += chunk; });

  let browser;
  try {
    const url = `http://127.0.0.1:${port}`;
    await waitForHttp(url);
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      colorScheme: 'light',
      deviceScaleFactor: 1,
      locale: 'en-US',
      reducedMotion: 'reduce',
      timezoneId: 'UTC',
      viewport: webViewReferenceViewport,
    });
    const page = await context.newPage();
    page.on('console', (message) => {
      if (message.type() === 'error') console.error(`[browser] ${message.text()}`);
    });
    page.on('pageerror', (error) => console.error(`[browser] ${error.message}`));
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await captureVisualStateRecipe({
      page,
      target: 'web',
      extraMetadata: {
        browserVersion: browser.version(),
        viewport: webViewReferenceViewport,
      },
    });
    await context.close();
  } catch (error) {
    if (preview.exitCode !== null) {
      throw new Error(`Vite preview exited with code ${preview.exitCode}:\n${previewOutput}`, { cause: error });
    }
    throw error;
  } finally {
    await browser?.close();
    preview.kill('SIGTERM');
  }
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
