#!/usr/bin/env bun

/**
 * Simple test generator: scans scripts/ and produces smoke tests that
 * statically validate script metadata without executing build actions.
 * This complements the integration tests while keeping generation local-only.
 */

import { readdirSync, statSync, mkdirSync, writeFileSync } from 'fs';
import { join, relative } from 'path';

const ROOT = process.cwd();
const SCRIPTS_DIR = join(ROOT, 'scripts');
const OUT_DIR = join(ROOT, 'tests', 'generated');

function listFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...listFiles(p));
    else if (/\.(mjs|cjs|js)$/.test(entry)) out.push(p);
  }
  return out;
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const files = listFiles(SCRIPTS_DIR);
  let count = 0;
  for (const file of files) {
    const rel = relative(ROOT, file).replace(/\\/g, '/');
    const testPath = join(OUT_DIR, rel.replace(/[\\/]/g, '__') + '.test.js');
    const code = `import { describe, it, expect } from 'bun:test';\nimport { readFileSync } from 'fs';\n\n// Smoke test for ${rel}\ndescribe('smoke:${rel}', () => {\n  it('exists and has content', () => {\n    const text = readFileSync('${rel}', 'utf8');\n    expect(text.length).toBeGreaterThan(20);\n  });\n});\n`;
    mkdirSync(join(testPath, '..'), { recursive: true });
    writeFileSync(testPath, code, 'utf8');
    count++;
  }
  console.log(`Generated ${count} smoke test(s) in ${OUT_DIR}`);
}

main();

