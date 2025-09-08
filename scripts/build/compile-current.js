#!/usr/bin/env bun
// SPDX-License-Identifier: MIT OR Apache-2.0

import { spawn } from 'child_process';
import { existsSync } from 'fs';

function run(cmd, args = []) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${cmd} ${args.join(' ')}`);
    const p = spawn(cmd, args, { stdio: 'inherit' });
    p.on('error', reject);
    p.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`)));
  });
}

function detectTarget() {
  const { platform, arch } = process;
  if (platform === 'win32') return { target: 'bun-windows-x64', outfile: 'dist/claude-code-windows-x64.exe', source: '.windows-build-temp/cli-windows.js' };
  if (platform === 'darwin') {
    if (arch === 'arm64') return { target: 'bun-darwin-arm64', outfile: 'dist/claude-code-macos-arm64', source: './cli-native-bundled.js' };
    return { target: 'bun-darwin-x64', outfile: 'dist/claude-code-macos-x64', source: './cli-native-bundled.js' };
  }
  if (platform === 'linux') {
    if (arch === 'arm64') return { target: 'bun-linux-arm64', outfile: 'dist/claude-code-linux-arm64', source: './cli-native-bundled.js' };
    return { target: 'bun-linux-x64', outfile: 'dist/claude-code-linux-x64', source: './cli-native-bundled.js' };
  }
  throw new Error(`Unsupported platform ${platform}/${arch}`);
}

async function main() {
  const { target, outfile, source } = detectTarget();
  if (!existsSync(source)) {
    console.log('Source not prepared; running prepare first...');
    await run('bun', ['run', 'scripts/build/prepare-current.js']);
  }
  await run('bun', ['build', '--compile', '--minify', '--sourcemap', `--target=${target}`, source, `--outfile=${outfile}`]);
  console.log(`\n✓ Compiled ${outfile}`);
}

main().catch((err) => {
  console.error('compile failed:', err);
  process.exit(1);
});
