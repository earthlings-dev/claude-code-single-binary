import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs';
import { join, resolve } from 'path';
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { SAMPLE_ALT } from './fixtures/minified-cli-sample-alt.js';

function runScriptInTemp(tempDir, scriptAbsPath) {
  const { spawnSync } = Bun;
  const p = spawnSync({
    cmd: ['bun', scriptAbsPath],
    cwd: tempDir,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env },
  });
  return p;
}

describe('prepare-bundle-native.js (alt branches)', () => {
  const repoRoot = resolve('.');
  const scriptAbs = resolve(repoRoot, 'scripts/build/prepare-bundle-native.js');
  const tempDir = resolve('tests/.tmp-native-alt');

  beforeAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(join(tempDir, 'cli.js'), SAMPLE_ALT, 'utf8');
    writeFileSync(join(tempDir, 'yoga.wasm'), '\u0000', 'binary');
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('applies alt shell bypass pattern and ripgrep.node fallback pattern', () => {
    const r = runScriptInTemp(tempDir, scriptAbs);
    expect(r.exitCode).toBe(0);
    const outPath = join(tempDir, 'cli-native-bundled.js');
    expect(existsSync(outPath)).toBe(true);
    const out = readFileSync(outPath, 'utf8');

    // Shell bypass should be injected even if only alt pattern was present
    expect(out).toContain('process.platform === "win32"?"cmd.exe":"/bin/sh"');

    // ripgrep.node fallback replacement should be used
    expect(out).toContain('vendor/ripgrep/');
    expect(out).toMatch(/ripgrep\.node/);
  });
});

