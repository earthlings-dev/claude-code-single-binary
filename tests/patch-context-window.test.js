import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';

function runScriptInCwd(cwd, scriptAbsPath, env = {}) {
  const { spawnSync } = Bun;
  const p = spawnSync({
    cmd: ['bun', scriptAbsPath],
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, ...env },
  });
  return p;
}

describe('patch-context-window.js', () => {
  const repoRoot = resolve('.');
  const scriptAbs = resolve(repoRoot, 'scripts/build/patch-context-window.js');
  const tempDir = resolve('tests/.tmp-context');

  beforeAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
    mkdirSync(tempDir, { recursive: true });
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('replaces common 32k clamps with DEFAULT_MAX', () => {
    const src = [
      'const n = Math.min(a, 32768, b);',
      'if (x > 32768) x = 32768;',
      'if (32768 <= y) y = 1;',
      'let z = 32768;',
    ].join('\n');
    writeFileSync(join(tempDir, 'cli-native-bundled.js'), src, 'utf8');

    const r = runScriptInCwd(tempDir, scriptAbs);
    expect(r.exitCode).toBe(0);

    const out = readFileSync(join(tempDir, 'cli-native-bundled.js'), 'utf8');
    expect(out).toContain('Math.min(a, 1048576, b)');
    expect(out).toContain('if (x > 1048576) x = 1048576;');
    expect(out).toContain('if (1048576 <= y) y = 1;');
    expect(out).toMatch(/let z = 1048576[;,]/);
  });

  it('respects CLAUDE_CODE_MAX_CONTEXT_TOKENS env var', () => {
    writeFileSync(join(tempDir, 'cli-native-bundled.js'), 'const k = 32768;', 'utf8');
    const r = runScriptInCwd(tempDir, scriptAbs, { CLAUDE_CODE_MAX_CONTEXT_TOKENS: '262144' });
    expect(r.exitCode).toBe(0);
    const out = readFileSync(join(tempDir, 'cli-native-bundled.js'), 'utf8');
    expect(out).toContain('262144');
  });

  it('warns when no target files exist (no crash)', () => {
    // Ensure no files
    rmSync(join(tempDir, 'cli-native-bundled.js'), { force: true });
    rmSync(join(tempDir, '.windows-build-temp'), { recursive: true, force: true });
    const r = runScriptInCwd(tempDir, scriptAbs);
    // Should still exit 0 and not create files
    expect(r.exitCode).toBe(0);
    expect(existsSync(join(tempDir, 'cli-native-bundled.js'))).toBe(false);
  });
});

