import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs';
import { join, resolve } from 'path';
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';

// Variant that triggers alt shell pattern and simple ripgrep.node fallback
const SAMPLE_WIN_ALT = `#!/usr/bin/env node\n(function(){\nprocess.env.CLAUDE_CODE_ENTRYPOINT=\"cli\";\nif(!J){let F=\"No suitable shell found. Claude CLI requires a Posix shell environment. Please ensure you have a valid shell installed and the SHELL environment variable set.\";throw h1(new Error(F)),new Error(F)}\nB=\"./ripgrep.node\";\n})();\n`;

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

describe('prepare-windows-bundle.js (alt branches)', () => {
  const repoRoot = resolve('.');
  const scriptAbs = resolve(repoRoot, 'scripts/build/prepare-windows-bundle.js');
  const tempDir = resolve('tests/.tmp-win-alt');

  beforeAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(join(tempDir, 'cli.js'), SAMPLE_WIN_ALT, 'utf8');
    writeFileSync(join(tempDir, 'sdk.mjs'), 'export const y = 2;\n', 'utf8');
    writeFileSync(join(tempDir, 'sdk.d.ts'), 'export declare const y: number;\n', 'utf8');
    writeFileSync(join(tempDir, 'package.json'), '{"name":"tmp"}', 'utf8');
    writeFileSync(join(tempDir, 'yoga.wasm'), '\u0000', 'binary');
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('applies alt shell bypass and ripgrep.node fallback in Windows bundle', () => {
    const r = runScriptInCwd(tempDir, scriptAbs);
    expect(r.exitCode).toBe(0);

    const outDir = join(tempDir, '.windows-build-temp');
    const cliOut = join(outDir, 'cli-windows.js');
    expect(existsSync(cliOut)).toBe(true);
    const cli = readFileSync(cliOut, 'utf8');

    // Alt shell replacement applied
    expect(cli).toContain('process.platform === "win32"?"cmd.exe":"/bin/sh"');
    // ripgrep.node fallback applied and Windows markers present
    expect(cli).toContain('ripgrep.node');
    expect(cli).toContain('CLAUDE_CODE_WINDOWS_EXECUTABLE');
  });
});

