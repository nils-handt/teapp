#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

const webRoot = resolve('dist');
const androidRoot = resolve('android/app/src/main/assets/public');

const listFiles = async (root, directory = root) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? listFiles(root, path) : [relative(root, path)];
  }));
  return nested.flat().sort();
};

const hash = async (path) => createHash('sha256').update(await readFile(path)).digest('hex');
const webFiles = await listFiles(webRoot);
const androidFiles = await listFiles(androidRoot);
const mismatches = [];

for (const file of webFiles) {
  try {
    const [webHash, androidHash] = await Promise.all([
      hash(resolve(webRoot, file)),
      hash(resolve(androidRoot, file)),
    ]);
    if (webHash !== androidHash) mismatches.push(`${file} differs`);
  } catch {
    mismatches.push(`${file} is missing from Android assets`);
  }
}

const allowedAndroidOnlyFiles = new Set(['cordova.js', 'cordova_plugins.js']);
for (const file of androidFiles) {
  if (!webFiles.includes(file) && !allowedAndroidOnlyFiles.has(file)) {
    mismatches.push(`${file} exists only in Android assets`);
  }
}

if (mismatches.length > 0) {
  throw new Error(`Android web assets are stale. Run npm run android:sync.\n${mismatches.join('\n')}`);
}

console.log(`Verified ${webFiles.length} synced Android web assets.`);
