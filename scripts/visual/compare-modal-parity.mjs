#!/usr/bin/env node

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const readOption = (name, fallback) => {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  if (!value) throw new Error(`${name} requires a value`);
  return value;
};

const webDirectory = resolve(readOption('--web', 'tests/visual/baselines/reference/web'));
const androidDirectory = resolve(readOption('--android', 'tests/visual/artifacts/actual/android-api36'));
const outputDirectory = resolve(readOption('--output', 'tests/visual/artifacts/diff/parity-api36-modal'));
const maxDiffRatio = Number(readOption('--max-diff-ratio', '0.05'));
const geometryTolerance = Number(readOption('--geometry-tolerance', '1.5'));
const stateName = 'brewing-setup-modal';

const readCapture = async (directory) => {
  const metadata = JSON.parse(await readFile(resolve(directory, 'metadata.json'), 'utf8'));
  const capture = metadata.captures.find(({ name }) => name === stateName);
  if (!capture?.metrics?.diagnostics) {
    throw new Error(`${directory} is missing ${stateName} diagnostics`);
  }
  return {
    diagnostics: capture.metrics.diagnostics,
    image: PNG.sync.read(await readFile(resolve(directory, `${stateName}.png`))),
  };
};

const crop = (source, bounds, viewport) => {
  const scaleX = source.width / viewport.width;
  const scaleY = source.height / viewport.height;
  const left = Math.max(0, Math.round(bounds.left * scaleX));
  const top = Math.max(0, Math.round(bounds.top * scaleY));
  const right = Math.min(source.width, Math.round(bounds.right * scaleX));
  const bottom = Math.min(source.height, Math.round(bounds.bottom * scaleY));
  const result = new PNG({ width: right - left, height: bottom - top });
  PNG.bitblt(source, result, left, top, result.width, result.height, 0, 0);
  return result;
};

const resize = (source, width, height) => {
  const result = new PNG({ width, height });
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
        result.data[targetOffset + channel] = Math.round(top + ((bottom - top) * yWeight));
      }
    }
  }
  return result;
};

const localRect = (node, panel) => ({
  height: node.rect.height,
  left: node.rect.left - panel.rect.left,
  top: node.rect.top - panel.rect.top,
  width: node.rect.width,
});

const [web, android] = await Promise.all([readCapture(webDirectory), readCapture(androidDirectory)]);
const labels = ['panel', 'title', 'body', 'input', 'actions'];
const geometry = labels.flatMap((label) => {
  const webRect = localRect(web.diagnostics.nodes[label], web.diagnostics.nodes.panel);
  const androidRect = localRect(android.diagnostics.nodes[label], android.diagnostics.nodes.panel);
  return Object.keys(webRect).map((property) => ({
    android: androidRect[property],
    delta: androidRect[property] - webRect[property],
    label,
    property,
    web: webRect[property],
  }));
});
const geometryFailures = geometry.filter(({ delta }) => Math.abs(delta) > geometryTolerance);
const visibilityFailures = labels.filter((label) => (
  !android.diagnostics.nodes[label].visible
  || !android.diagnostics.nodes[label].withinLayoutViewport
));

// Compare the application-owned panel interior. The keyboard and backdrop are
// intentionally outside this crop; panel bounds/radius are enforced by the
// CSS-pixel geometry checks above.
const inset = 22;
const interiorBounds = ({ nodes }) => ({
  bottom: nodes.panel.rect.bottom - inset,
  left: nodes.panel.rect.left + inset,
  right: nodes.panel.rect.right - inset,
  top: nodes.panel.rect.top + inset,
});
const webInterior = crop(web.image, interiorBounds(web.diagnostics), web.diagnostics.viewport.visual);
const androidInteriorSource = crop(android.image, interiorBounds(android.diagnostics), android.diagnostics.viewport.visual);
const androidInterior = resize(androidInteriorSource, webInterior.width, webInterior.height);
const diff = new PNG({ width: webInterior.width, height: webInterior.height });
const differingPixels = pixelmatch(
  webInterior.data,
  androidInterior.data,
  diff.data,
  webInterior.width,
  webInterior.height,
  { includeAA: false, threshold: 0.1 },
);
const diffRatio = differingPixels / (webInterior.width * webInterior.height);
const passed = geometryFailures.length === 0 && visibilityFailures.length === 0 && diffRatio <= maxDiffRatio;

await rm(outputDirectory, { force: true, recursive: true });
await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(resolve(outputDirectory, 'web-panel-interior.png'), PNG.sync.write(webInterior)),
  writeFile(resolve(outputDirectory, 'android-panel-interior.png'), PNG.sync.write(androidInterior)),
  writeFile(resolve(outputDirectory, 'diff.png'), PNG.sync.write(diff)),
]);
const report = {
  android: androidDirectory,
  diffRatio,
  differingPixels,
  geometry,
  geometryFailures,
  geometryTolerance,
  maxDiffRatio,
  passed,
  state: stateName,
  visibilityFailures,
  web: webDirectory,
};
await writeFile(resolve(outputDirectory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
const markdown = [
  '# Keyboard-open modal application parity',
  '',
  `Result: ${passed ? 'pass' : 'drift'}.`,
  `Panel-interior changed pixels: ${(diffRatio * 100).toFixed(3)}% (${differingPixels}).`,
  `Geometry tolerance: ${geometryTolerance.toFixed(3)} CSS px.`,
  `Geometry failures: ${geometryFailures.length}; visibility failures: ${visibilityFailures.length}.`,
  '',
  'The Android keyboard and modal backdrop are excluded as operating-system-owned or position-dependent regions. The application-owned panel interior and CSS-pixel-local geometry remain required.',
  '',
].join('\n');
await writeFile(resolve(outputDirectory, 'report.md'), markdown, 'utf8');
console.log(markdown);

if (!passed) process.exitCode = 1;
