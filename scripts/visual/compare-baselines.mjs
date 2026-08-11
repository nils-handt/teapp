#!/usr/bin/env node

import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const readOption = (name, fallback) => {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  if (!value) throw new Error(`${name} requires a value`);
  return value;
};

const readOptions = (name) => process.argv.flatMap((argument, index) => (
  argument === name ? [process.argv[index + 1]] : []
)).filter(Boolean);

const requireOption = (name) => {
  const value = readOption(name);
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const referenceDirectory = resolve(requireOption('--reference'));
const actualDirectory = resolve(requireOption('--actual'));
const outputDirectory = resolve(readOption('--output', 'tests/visual/artifacts/diff'));
const maxDiffRatio = Number(readOption('--max-diff-ratio', '0.005'));
const pixelThreshold = Number(readOption('--pixel-threshold', '0.1'));
const resizeActualToReference = process.argv.includes('--resize-actual-to-reference');
const excludedNames = new Set(readOptions('--exclude'));

if (!Number.isFinite(maxDiffRatio) || maxDiffRatio < 0 || maxDiffRatio > 1) {
  throw new Error('--max-diff-ratio must be a number from 0 to 1');
}
if (!Number.isFinite(pixelThreshold) || pixelThreshold < 0 || pixelThreshold > 1) {
  throw new Error('--pixel-threshold must be a number from 0 to 1');
}

const pngNames = async (directory) => (await readdir(directory))
  .filter((name) => name.endsWith('.png'))
  .sort();

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

const referenceNames = await pngNames(referenceDirectory);
const actualNames = await pngNames(actualDirectory);
if (referenceNames.length === 0) throw new Error(`No reference PNG files found in ${referenceDirectory}`);

await rm(outputDirectory, { force: true, recursive: true });
await mkdir(outputDirectory, { recursive: true });

const rows = [];
const allNames = [...new Set([...referenceNames, ...actualNames])]
  .filter((name) => !excludedNames.has(name))
  .sort();
for (const name of allNames) {
  if (!referenceNames.includes(name) || !actualNames.includes(name)) {
    rows.push({ name, status: referenceNames.includes(name) ? 'missing actual' : 'unexpected actual' });
    continue;
  }

  const [reference, originalActual] = await Promise.all([
    readFile(resolve(referenceDirectory, name)).then(PNG.sync.read),
    readFile(resolve(actualDirectory, name)).then(PNG.sync.read),
  ]);
  const dimensionsDiffer = reference.width !== originalActual.width || reference.height !== originalActual.height;
  if (dimensionsDiffer && !resizeActualToReference) {
    rows.push({
      actualSize: `${originalActual.width}x${originalActual.height}`,
      name,
      referenceSize: `${reference.width}x${reference.height}`,
      status: 'dimension mismatch',
    });
    continue;
  }
  const actual = dimensionsDiffer
    ? resizePng(originalActual, reference.width, reference.height)
    : originalActual;

  const diff = new PNG({ height: reference.height, width: reference.width });
  const differingPixels = pixelmatch(reference.data, actual.data, diff.data, reference.width, reference.height, {
    includeAA: false,
    threshold: pixelThreshold,
  });
  const diffRatio = differingPixels / (reference.width * reference.height);
  await writeFile(resolve(outputDirectory, name), PNG.sync.write(diff));
  rows.push({
    diffRatio,
    differingPixels,
    height: reference.height,
    name,
    resized: dimensionsDiffer,
    status: diffRatio <= maxDiffRatio ? 'pass' : 'drift',
    width: reference.width,
  });
}

const failed = rows.filter(({ status }) => status !== 'pass');
const report = {
  actual: actualDirectory,
  excluded: [...excludedNames],
  failed: failed.length,
  maxDiffRatio,
  pixelThreshold,
  reference: referenceDirectory,
  resizeActualToReference,
  results: rows,
};
await writeFile(resolve(outputDirectory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

const markdownRows = rows.map((row) => {
  const ratio = typeof row.diffRatio === 'number' ? `${(row.diffRatio * 100).toFixed(3)}%` : 'n/a';
  return `| ${row.name} | ${row.status} | ${ratio} |`;
});
const markdown = [
  `# Visual diff: ${basename(actualDirectory)}`,
  '',
  `Threshold: ${(maxDiffRatio * 100).toFixed(3)}% changed pixels per image.`,
  resizeActualToReference ? 'Actual screenshots are resized to the reference dimensions before comparison.' : '',
  excludedNames.size > 0 ? `Excluded: ${[...excludedNames].join(', ')}.` : '',
  '',
  '| State | Result | Changed pixels |',
  '| --- | --- | ---: |',
  ...markdownRows,
  '',
].join('\n');
await writeFile(resolve(outputDirectory, 'report.md'), markdown, 'utf8');
console.log(markdown);

if (failed.length > 0) process.exitCode = 1;
