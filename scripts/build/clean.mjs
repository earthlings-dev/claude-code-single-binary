#!/usr/bin/env bun
// SPDX-License-Identifier: MIT OR Apache-2.0

import { rmSync, existsSync, statSync } from 'fs';

const defaultTargets = [
  'cli-bundled.js',
  'cli-native-bundled.js',
  '.windows-build-temp',
  'dist',
];

const deepTargets = [
  // Upstream-fetched sources that can be refreshed via update-sources
  'cli.js',
  'sdk.mjs',
  'sdk.d.ts',
  'yoga.wasm',
  'vendor',
];

function rimraf(path) {
  try {
    if (!existsSync(path)) return false;
    const st = statSync(path);
    if (st.isDirectory()) {
      rmSync(path, { recursive: true, force: true });
    } else {
      rmSync(path, { force: true });
    }
    return true;
  } catch {
    return false;
  }
}

const args = new Set(process.argv.slice(2));
const allTargets = args.has('--deep') || args.has('--sources')
  ? [...defaultTargets, ...deepTargets]
  : defaultTargets;

let removed = 0;
for (const t of allTargets) {
  if (rimraf(t)) {
    console.log(`✓ Removed ${t}`);
    removed++;
  }
}

if (removed === 0) {
  console.log('Nothing to clean.');
} else {
  console.log(`\n✓ Cleaned ${removed} item(s).`);
}
