#!/usr/bin/env bun
// SPDX-License-Identifier: MIT OR Apache-2.0

/**
 * Patch context-window/token clamp constants in the prepared CLI to support longer contexts.
 *
 * Strategy:
 * - Replace common 32k clamps in Math.min()/comparisons to a higher limit
 * - Respect env CLAUDE_CODE_MAX_CONTEXT_TOKENS (default: 1048576 ~ 1M)
 * - Only touches the prepared files: cli-native-bundled.js and .windows-build-temp/cli-windows.js
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';

const DEFAULT_MAX = parseInt(process.env.CLAUDE_CODE_MAX_CONTEXT_TOKENS || '1048576', 10);
if (!Number.isFinite(DEFAULT_MAX) || DEFAULT_MAX <= 0) {
  console.error('Invalid CLAUDE_CODE_MAX_CONTEXT_TOKENS; expected positive integer');
  process.exit(2);
}

const files = [
  './cli-native-bundled.js',
  '.windows-build-temp/cli-windows.js'
];

// Build regexps for safe replacements
const LITS = [32768, 32000];
const repls = [];

// Math.min(..., 32768, ...)
for (const lit of LITS) {
  repls.push({
    name: `min_${lit}`,
    re: new RegExp(`Math\\.min\\(([^)]*?)${lit}([^)]*?)\\)`, 'g'),
    fn: (_m, a, b) => `Math.min(${a}${DEFAULT_MAX}${b})`
  });
}

// Comparisons like x > 32768 or x >= 32768, and the inverse
for (const op of ['>', '>=', '<', '<=']) {
  for (const lit of LITS) {
    // left op lit
    repls.push({
      name: `cmp_left_${op}_${lit}`,
      re: new RegExp(`(${op.replace('>', '\\>').replace('<', '\\<')})\\s*${lit}`, 'g'),
      fn: (_m, oper) => `${oper}${DEFAULT_MAX}`
    });
    // lit op right
    repls.push({
      name: `cmp_right_${op}_${lit}`,
      re: new RegExp(`${lit}\\s*(${op.replace('>', '\\>').replace('<', '\\<')})`, 'g'),
      fn: (_m, oper) => `${DEFAULT_MAX}${oper}`
    });
  }
}

// Standalone literal in obvious clamp contexts like: n=32768; or const X=32768; try to be conservative
for (const lit of LITS) {
  repls.push({
    name: `assign_${lit}`,
    re: new RegExp(`([=,:\n\r\t\s\(])${lit}([,;\n\r\t\s\)])`, 'g'),
    fn: (_m, a, b) => `${a}${DEFAULT_MAX}${b}`
  });
}

let touched = 0;
for (const file of files) {
  if (!existsSync(file)) continue;
  let src = readFileSync(file, 'utf8');
  let before = src;
  for (const { re, fn } of repls) {
    src = src.replace(re, fn);
  }
  if (src !== before) {
    writeFileSync(file, src);
    console.log(`✓ Patched context clamps in ${file}`);
    touched++;
  }
}

if (touched === 0) {
  console.warn('No files patched (did you run prepare-bundle-native.js first?)');
}
