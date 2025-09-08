#!/usr/bin/env bun
// Enforce coverage thresholds from a summary JSON or LCOV file.

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

function parseArgs() {
  const args = new Map();
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) args.set(m[1], m[2]);
  }
  return args;
}

function readJSON(p) {
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

function findCoverage() {
  const base = 'coverage';
  const candidates = [
    join(base, 'coverage-summary.json'),
    join(base, 'coverage-final.json'),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return { kind: 'json', path: c };
  }
  const lcov = join(base, 'lcov.info');
  if (existsSync(lcov)) return { kind: 'lcov', path: lcov };
  return null;
}

function percentFromLCOV(lcovText) {
  // Very rough parser: compute totals from TN lines
  let linesFound = 0, linesHit = 0;
  let funcsFound = 0, funcsHit = 0;
  let stmtsFound = 0, stmtsHit = 0; // LCOV maps lines to statements
  for (const line of lcovText.split(/\r?\n/)) {
    if (line.startsWith('LF:')) stmtsFound += parseInt(line.slice(3), 10) || 0;
    if (line.startsWith('LH:')) stmtsHit += parseInt(line.slice(3), 10) || 0;
    if (line.startsWith('FNF:')) funcsFound += parseInt(line.slice(4), 10) || 0;
    if (line.startsWith('FNH:')) funcsHit += parseInt(line.slice(4), 10) || 0;
    if (line.startsWith('LF:')) linesFound += parseInt(line.slice(3), 10) || 0;
    if (line.startsWith('LH:')) linesHit += parseInt(line.slice(3), 10) || 0;
  }
  const pct = (hit, found) => (found ? (100 * hit) / found : 100);
  return {
    lines: pct(linesHit, linesFound),
    statements: pct(stmtsHit, stmtsFound),
    functions: pct(funcsHit, funcsFound),
  };
}

function main() {
  const args = parseArgs();
  const threshold = Number(args.get('threshold') || '90');
  const cov = findCoverage();
  if (!cov) {
    console.error('Coverage summary not found under coverage/. Did you run with --coverage?');
    process.exit(2);
  }
  let totals;
  if (cov.kind === 'json') {
    const data = readJSON(cov.path);
    const total = data && (data.total || data);
    if (!total || !total.lines || !total.statements || !total.functions) {
      console.error('Invalid coverage summary JSON:', cov.path);
      process.exit(2);
    }
    totals = {
      lines: total.lines.pct,
      statements: total.statements.pct,
      functions: total.functions.pct,
    };
  } else {
    const text = readFileSync(cov.path, 'utf8');
    totals = percentFromLCOV(text);
  }

  const fail = [];
  for (const [k, v] of Object.entries(totals)) {
    if (v < threshold) fail.push(`${k} ${v.toFixed(2)}% < ${threshold}%`);
  }
  if (fail.length) {
    console.error('Coverage below threshold:', fail.join('; '));
    process.exit(1);
  }
  console.log(`Coverage OK: lines ${totals.lines.toFixed(2)}%, statements ${totals.statements.toFixed(2)}%, functions ${totals.functions.toFixed(2)}% (>= ${threshold}%)`);
}

main();

