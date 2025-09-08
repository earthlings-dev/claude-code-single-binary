#!/usr/bin/env bun
// SPDX-License-Identifier: MIT OR Apache-2.0

import { spawn } from 'child_process';
import { existsSync } from 'fs';

function run(cmd, args = []) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit' });
    p.on('error', reject);
    p.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`)));
  });
}

async function main() {
  if (!existsSync('./cli.js')) {
    console.log('cli.js not found; fetching latest upstream sources...');
    await run('bun', ['run', 'scripts/update/fetch-latest.mjs']);
  }
  const isWindows = process.platform === 'win32';
  if (isWindows) {
    await run('bun', ['run', 'scripts/build/prepare-windows-bundle.js']);
  } else {
    await run('bun', ['run', 'scripts/build/prepare-bundle-native.js']);
  }
  await run('bun', ['run', 'scripts/build/patch-context-window.js']);
  console.log('\n✓ Prepared bundle for current platform');
}

main().catch((err) => {
  console.error('prepare failed:', err);
  process.exit(1);
});
