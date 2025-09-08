import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs';
import { join, resolve } from 'path';
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { SAMPLE } from './fixtures/minified-cli-sample.js';

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

describe('prepare-bundle-native.js', () => {
  const repoRoot = resolve('.');
  const scriptAbs = resolve(repoRoot, 'scripts/build/prepare-bundle-native.js');
  const tempDir = resolve('tests/.tmp-native');

  beforeAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
    mkdirSync(tempDir, { recursive: true });
    // minimal files used by the script
    writeFileSync(join(tempDir, 'cli.js'), SAMPLE, 'utf8');
    writeFileSync(join(tempDir, 'yoga.wasm'), '\u0000', 'binary');
    // a couple of vendor entries to exercise mapping
    mkdirSync(join(tempDir, 'vendor', 'ripgrep', 'x64-linux'), { recursive: true });
    writeFileSync(join(tempDir, 'vendor', 'ripgrep', 'x64-linux', 'rg'), '', 'utf8');
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates cli-native-bundled.js with embedded mappings and patched patterns', () => {
    const r = runScriptInTemp(tempDir, scriptAbs);
    expect(r.exitCode).toBe(0);
    const outPath = join(tempDir, 'cli-native-bundled.js');
    expect(existsSync(outPath)).toBe(true);
    const out = readFileSync(outPath, 'utf8');

    // embedded header and mapping
    expect(out).toContain('Embedded files using Bun\'s native embedding');
    expect(out).toContain("'yoga.wasm'");

    // yoga.wasm patterns patched
    expect(out).toContain("Bun.pathToFileURL(__embeddedFiles?.['yoga.wasm'])");
    expect(out).toContain("__embeddedFiles && __embeddedFiles['yoga.wasm']");

    // ripgrep patterns patched
    expect(out).toContain('Added embedded file handling for ripgrep'); // log present in stdout
    expect(out).toMatch(/vendor\/ripgrep\//);

    // bundled mode indicator
    expect(out).toContain('CLAUDE_CODE_BUNDLED');

    // shell bypass applied
    expect(out).not.toContain('No suitable shell found. Claude CLI requires');
  });
});

