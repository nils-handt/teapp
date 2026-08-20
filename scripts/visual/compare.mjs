import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { VISUAL_STATE_NAMES } from './state-manifest.mjs';

const PIXEL_COLOR_THRESHOLD = 0.1;

export const assertMatchingStateNames = (webNames, androidNames, expectedNames = VISUAL_STATE_NAMES) => {
  for (const [label, names] of [['web', webNames], ['Android', androidNames]]) {
    if (JSON.stringify(names) !== JSON.stringify(expectedNames)) {
      throw new Error(`${label} screenshot state set is invalid: expected ${expectedNames.join(', ')}, received ${names.join(', ')}`);
    }
  }
};

const captureNames = (metadata) => metadata.captures?.map(({ name }) => name) ?? [];

export const assertCompatibleCaptureMetadata = (webMetadata, androidMetadata, expectedNames = VISUAL_STATE_NAMES) => {
  assertMatchingStateNames(captureNames(webMetadata), captureNames(androidMetadata), expectedNames);
  if (JSON.stringify(webMetadata.fixture) !== JSON.stringify(androidMetadata.fixture)) {
    throw new Error('Web and Android captures used different fixtures.');
  }
  for (const name of expectedNames) {
    const web = webMetadata.captures.find((capture) => capture.name === name)?.metrics;
    const android = androidMetadata.captures.find((capture) => capture.name === name)?.metrics;
    if (!web || !android) throw new Error(`Missing capture metadata for ${name}.`);
    if (web.route !== android.route) {
      throw new Error(`Route mismatch for ${name}: web=${web.route}, Android=${android.route}.`);
    }
    for (const [target, metrics] of [['web', web], ['Android', android]]) {
      if (![metrics.width, metrics.height, metrics.devicePixelRatio].every((value) => Number.isFinite(value) && value > 0)) {
        throw new Error(`Invalid ${target} viewport metadata for ${name}.`);
      }
      if (!Array.isArray(metrics.scrollTops)
        || metrics.scrollTops.some((value) => !Number.isFinite(value) || Math.abs(value) > 1)) {
        throw new Error(`Invalid ${target} scroll position metadata for ${name}.`);
      }
    }
    if (Math.abs(web.width - android.width) > 1
      || (name !== 'brewing-setup-modal' && Math.abs(web.height - android.height) > 1)) {
      throw new Error(`Viewport mismatch for ${name}: web=${web.width}x${web.height}, Android=${android.width}x${android.height}.`);
    }
  }
};

export const assertCompatibleAspectRatio = (name, web, android) => {
  if (name === 'brewing-setup-modal') return;
  const webRatio = web.width / web.height;
  const androidRatio = android.width / android.height;
  const relativeDifference = Math.abs(webRatio - androidRatio) / webRatio;
  if (relativeDifference > 0.02) {
    throw new Error(`Incompatible screenshot aspect ratio for ${name}: web=${web.width}x${web.height}, Android=${android.width}x${android.height}.`);
  }
};

const pngNames = async (directory) => (await readdir(directory))
  .filter((name) => name.endsWith('.png'))
  .map((name) => name.slice(0, -4))
  .sort((left, right) => VISUAL_STATE_NAMES.indexOf(left) - VISUAL_STATE_NAMES.indexOf(right));

const resizePng = (source, width, height) => {
  const resized = new PNG({ height, width });
  for (let y = 0; y < height; y += 1) {
    const sourceY = ((y + 0.5) * source.height / height) - 0.5;
    const y0 = Math.max(0, Math.floor(sourceY));
    const y1 = Math.min(source.height - 1, y0 + 1);
    const yWeight = Math.max(0, sourceY - y0);
    for (let x = 0; x < width; x += 1) {
      const sourceX = ((x + 0.5) * source.width / width) - 0.5;
      const x0 = Math.max(0, Math.floor(sourceX));
      const x1 = Math.min(source.width - 1, x0 + 1);
      const xWeight = Math.max(0, sourceX - x0);
      const targetOffset = ((y * width) + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        const topLeft = source.data[((y0 * source.width) + x0) * 4 + channel];
        const topRight = source.data[((y0 * source.width) + x1) * 4 + channel];
        const bottomLeft = source.data[((y1 * source.width) + x0) * 4 + channel];
        const bottomRight = source.data[((y1 * source.width) + x1) * 4 + channel];
        const top = topLeft + ((topRight - topLeft) * xWeight);
        const bottom = bottomLeft + ((bottomRight - bottomLeft) * xWeight);
        resized.data[targetOffset + channel] = Math.round(top + ((bottom - top) * yWeight));
      }
    }
  }
  return resized;
};

const formatPercent = (ratio) => `${(ratio * 100).toFixed(3)}%`;

export const createReportMarkdown = ({ androidMetadata, results, source, webMetadata }) => {
  const rows = results.map((result) => [
    `\`${result.name}\``,
    result.manualReview ? `${formatPercent(result.diffRatio)} (manual: keyboard open)` : formatPercent(result.diffRatio),
    result.differingPixels.toLocaleString('en-US'),
    `${result.webWidth}×${result.webHeight}`,
    `${result.androidWidth}×${result.androidHeight}`,
    `[web](web/${result.name}.png) · [Android](android/${result.name}.png) · [device](android-device/${result.name}.png) · [diff](diff/${result.name}.png)`,
  ].join(' | '));

  return [
    '# Android/web visual parity',
    '',
    'This report compares screenshots produced together by the current run. Changed-pixel counts are diagnostic evidence, not pass/fail thresholds.',
    '',
    `- Revision: \`${source.revision}\`${source.workingTreeDirty ? ' (dirty working tree)' : ''}`,
    `- Fixture: seed \`${webMetadata.fixture.seed}\`, time \`${webMetadata.fixture.now}\`.`,
    `- Web browser: ${webMetadata.browserVersion}.`,
    `- Android: ${androidMetadata.model}, API ${androidMetadata.apiLevel}, AVD \`${androidMetadata.avdName}\`, WebView ${androidMetadata.webViewVersion}.`,
    '- Accepted discrepancies: [tests/visual/masterReport.md](../../../tests/visual/masterReport.md).',
    '- Android app-content rasters are normalized to the web screenshot dimensions for pixel comparison; both original dimensions are listed below.',
    '- `brewing-setup-modal` requires manual review because Android has an operating-system keyboard and the desktop browser does not.',
    '',
    '| State | Changed pixels | Count | Web dimensions | Android dimensions | Artifacts |',
    '| --- | ---: | ---: | ---: | ---: | --- |',
    ...rows.map((row) => `| ${row} |`),
    '',
    '## Capture metadata',
    '',
    'Routes, scroll positions, DPR, viewport, user agents, and capture dimensions are recorded in [web metadata](metadata/web.json) and [Android metadata](metadata/android.json).',
    '',
  ].join('\n');
};

export async function compareAndReport({ outputRoot, source, webMetadata, androidMetadata }) {
  const webDirectory = resolve(outputRoot, 'web');
  const androidDirectory = resolve(outputRoot, 'android');
  const diffDirectory = resolve(outputRoot, 'diff');
  const [webNames, androidNames] = await Promise.all([pngNames(webDirectory), pngNames(androidDirectory)]);
  assertMatchingStateNames(webNames, androidNames);
  assertCompatibleCaptureMetadata(webMetadata, androidMetadata);
  await mkdir(diffDirectory, { recursive: true });

  const results = [];
  for (const name of VISUAL_STATE_NAMES) {
    const [web, originalAndroid] = await Promise.all([
      readFile(resolve(webDirectory, `${name}.png`)).then(PNG.sync.read),
      readFile(resolve(androidDirectory, `${name}.png`)).then(PNG.sync.read),
    ]);
    assertCompatibleAspectRatio(name, web, originalAndroid);
    const resized = web.width !== originalAndroid.width || web.height !== originalAndroid.height;
    const android = resized ? resizePng(originalAndroid, web.width, web.height) : originalAndroid;
    const diff = new PNG({ height: web.height, width: web.width });
    const differingPixels = pixelmatch(web.data, android.data, diff.data, web.width, web.height, {
      includeAA: false,
      threshold: PIXEL_COLOR_THRESHOLD,
    });
    await writeFile(resolve(diffDirectory, `${name}.png`), PNG.sync.write(diff));
    results.push({
      androidHeight: originalAndroid.height,
      androidWidth: originalAndroid.width,
      diffRatio: differingPixels / (web.width * web.height),
      differingPixels,
      manualReview: name === 'brewing-setup-modal',
      name,
      resized,
      webHeight: web.height,
      webWidth: web.width,
    });
  }

  const markdown = createReportMarkdown({ androidMetadata, results, source, webMetadata });
  await Promise.all([
    writeFile(resolve(outputRoot, 'metadata/comparison.json'), `${JSON.stringify({
      includeAntialiasing: false,
      pixelColorThreshold: PIXEL_COLOR_THRESHOLD,
      results,
    }, null, 2)}\n`, 'utf8'),
    writeFile(resolve(outputRoot, 'report.md'), markdown, 'utf8'),
  ]);
  return { markdown, results };
}
