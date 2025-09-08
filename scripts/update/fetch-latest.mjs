#!/usr/bin/env bun
// SPDX-License-Identifier: MIT OR Apache-2.0

/**
 * Fetch latest @anthropic-ai/claude-code from the npm registry using Bun (no npm CLI),
 * extract it, and refresh local sources.
 *
 * Usage:
 *   bun run scripts/update/fetch-latest.mjs
 */

import { mkdtempSync, rmSync, existsSync, mkdirSync, cpSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

async function bunSpawn(cmd, args, opts = {}) {
  const proc = Bun.spawn([cmd, ...args], { stdout: 'inherit', stderr: 'inherit', ...opts });
  const exit = await proc.exited;
  if (exit !== 0) throw new Error(`${cmd} exited ${exit}`);
}

async function main() {
  const repoRoot = process.cwd();
  const work = mkdtempSync(join(tmpdir(), 'claude-code-update-'));
  try {
    console.log(`Working in ${work}`);

    // 1) Query npm registry for tarball URL
    const metaUrl = 'https://registry.npmjs.org/@anthropic-ai/claude-code';
    console.log(`Fetching metadata: ${metaUrl}`);
    const metaRes = await fetch(metaUrl);
    if (!metaRes.ok) throw new Error(`Failed to fetch metadata: ${metaRes.status}`);
    const meta = await metaRes.json();
    const latest = meta['dist-tags']?.latest;
    if (!latest) throw new Error('Could not determine latest dist-tag');
    const tarball = meta.versions?.[latest]?.dist?.tarball;
    if (!tarball) throw new Error('Could not find tarball URL for latest version');
    console.log(`Latest: ${latest}`);
    console.log(`Tarball: ${tarball}`);

    // 2) Download tarball via Bun
    const tgzPath = join(work, `claude-code-${latest}.tgz`);
    console.log('Downloading tarball...');
    const tgzRes = await fetch(tarball);
    if (!tgzRes.ok) throw new Error(`Failed to download tarball: ${tgzRes.status}`);
    await Bun.write(tgzPath, await tgzRes.arrayBuffer());

    // 3) Extract with tar
    console.log('Extracting tarball...');
    await bunSpawn('tar', ['-xzf', tgzPath, '-C', work]);

    // 4) Copy files from package/* to repo root
    const pkgDir = join(work, 'package');
    const files = ['cli.js', 'sdk.mjs', 'sdk.d.ts', 'yoga.wasm'];
    for (const f of files) {
      const src = join(pkgDir, f);
      const dst = join(repoRoot, f);
      if (existsSync(src)) {
        console.log(`Updating ${f}`);
        cpSync(src, dst, { recursive: false });
      }
    }

    // Vendor directory (ripgrep, etc.)
    const vendorSrc = join(pkgDir, 'vendor');
    const vendorDst = join(repoRoot, 'vendor');
    if (existsSync(vendorSrc)) {
      console.log('Updating vendor/ ...');
      if (!existsSync(vendorDst)) mkdirSync(vendorDst, { recursive: true });
      cpSync(vendorSrc, vendorDst, { recursive: true });
    }

    console.log('\n✓ Update complete. You can now rebuild:');
    console.log('  bun run prepare && bun run compile');
  } finally {
    try { rmSync(work, { recursive: true, force: true }); } catch {}
  }
}

main().catch((err) => {
  console.error('Update failed:', err);
  process.exit(1);
});
