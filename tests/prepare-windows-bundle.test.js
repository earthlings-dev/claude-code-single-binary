import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs';
import { join, resolve } from 'path';
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { SAMPLE } from './fixtures/minified-cli-sample.js';

function runScriptInCwd(cwd, scriptAbsPath) {
  const { spawnSync } = Bun;
  const p = spawnSync({
    cmd: ['bun', scriptAbsPath],
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env },
  });
  return p;
}

describe('prepare-windows-bundle.js', () => {
  const repoRoot = resolve('.');
  const scriptAbs = resolve(repoRoot, 'scripts/build/prepare-windows-bundle.js');
  const tempDir = resolve('tests/.tmp-win');

  beforeAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
    mkdirSync(tempDir, { recursive: true });
    // files required by the windows script (reads cli.js, sdk.mjs, vendor/, etc.)
    writeFileSync(join(tempDir, 'cli.js'), SAMPLE, 'utf8');
    writeFileSync(join(tempDir, 'sdk.mjs'), 'export const x = 1;\n', 'utf8');
    writeFileSync(join(tempDir, 'sdk.d.ts'), 'export declare const x: number;\n', 'utf8');
    writeFileSync(join(tempDir, 'package.json'), '{"name":"tmp"}', 'utf8');
    writeFileSync(join(tempDir, 'yoga.wasm'), '\u0000', 'binary');
    mkdirSync(join(tempDir, 'vendor', 'ripgrep', 'x64-win32'), { recursive: true });
    writeFileSync(join(tempDir, 'vendor', 'ripgrep', 'x64-win32', 'rg.exe'), '', 'utf8');
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('produces Windows temp bundle with patched cli and sdk', () => {
    const r = runScriptInCwd(tempDir, scriptAbs);
    expect(r.exitCode).toBe(0);

    const outDir = join(tempDir, '.windows-build-temp');
    const cliOut = join(outDir, 'cli-windows.js');
    const sdkOut = join(outDir, 'sdk.mjs');
    expect(existsSync(cliOut)).toBe(true);
    expect(existsSync(sdkOut)).toBe(true);

    const cli = readFileSync(cliOut, 'utf8');
    const sdk = readFileSync(sdkOut, 'utf8');

    // Windows compatibility header and import.meta replacements
    expect(cli).toContain('Windows executable compatibility');
    expect(cli).toContain('__toFileURL(__filename)');
    expect(cli).toContain('CLAUDE_CODE_WINDOWS_EXECUTABLE');

    expect(sdk).toContain('Windows executable compatibility wrapper');
    expect(sdk).toContain('__toFileURL(__filename)');
  });
});

