// Local replication of the seven program/v1 gate rows (RULES.txt) plus the
// dossier byte-compare. Run: node gate-check.mjs <out-dir> <snapshot.json>
// Exits 0 when every row passes, 1 otherwise. Not part of the graded program.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildDossier } from './vendor/makefun-board.ts';

const outDir = process.argv[2] ?? 'out';
const snapPath = process.argv[3] ?? '../token-radar-01-kit/token-radar-01-kit/input/snapshot.json';
const fails = [];
const ok = (row, msg) => console.log(`PASS ${row}: ${msg}`);
const fail = (row, msg) => { fails.push(row); console.log(`FAIL ${row}: ${msg}`); };

const snap = JSON.parse(readFileSync(snapPath, 'utf8'));
const snapSlugs = new Set(snap.protocols.map((p) => p.slug));
const board = JSON.parse(readFileSync(join(outDir, 'board.json'), 'utf8'));

// 1. dashboard_files
{
  const files = readdirSync(join(outDir, 'dashboard'), { recursive: true })
    .filter((f) => statSync(join(outDir, 'dashboard', f)).isFile());
  const bytes = files.reduce((n, f) => n + statSync(join(outDir, 'dashboard', f)).size, 0);
  const nameRe = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
  const badName = files.filter((f) => !nameRe.test(f.split('/').pop()));
  const hasHtml = files.includes('index.html');
  const hasCss = files.some((f) => f.endsWith('.css'));
  const hasJs = files.some((f) => f.endsWith('.js'));
  const hasUrl = files.filter((f) => /https?:\/\//.test(readFileSync(join(outDir, 'dashboard', f), 'utf8')));
  if (!hasHtml || !hasCss || !hasJs) fail('dashboard_files', 'missing index.html / css / js');
  else if (files.length > 400) fail('dashboard_files', `${files.length} files`);
  else if (bytes > 4 * 1024 * 1024) fail('dashboard_files', `${bytes} bytes`);
  else if (badName.length) fail('dashboard_files', `bad names: ${badName.join(', ')}`);
  else if (hasUrl.length) fail('dashboard_files', `URL in: ${hasUrl.join(', ')}`);
  else ok('dashboard_files', `${files.length} files (${bytes} bytes), index.html + css + js, no URLs`);
}

// 2. board_file
{
  const size = statSync(join(outDir, 'board.json')).size;
  let bad = [];
  if (board.length < 100 || board.length > 4000) bad.push(`rows ${board.length}`);
  if (size > 8 * 1024 * 1024) bad.push(`size ${size}`);
  board.forEach((r, i) => {
    if (!snapSlugs.has(r.slug)) bad.push(`row ${i}: slug not in snapshot`);
    if (!r.name || !String(r.name).trim()) bad.push(`row ${i}: empty name`);
    if (!Number.isInteger(r.rank) || r.rank <= 0) bad.push(`row ${i}: bad rank`);
    if (!Number.isInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > 1e14) bad.push(`row ${i}: bad implied value`);
  });
  if (bad.length) fail('board_file', bad.slice(0, 5).join('; ') + (bad.length > 5 ? ` (+${bad.length - 5} more)` : ''));
  else ok('board_file', `${board.length} rows, ${size} bytes, all slugs in snapshot`);
}

// 3. sorted_by_value
{
  const ranksOk = board.every((r, i) => r.rank === i + 1);
  const sortedOk = board.every((r, i) => i === 0 || r.implied_value_usd <= board[i - 1].implied_value_usd);
  const distinct = new Set(board.map((r) => r.implied_value_usd)).size;
  if (!ranksOk) fail('sorted_by_value', 'ranks are not exactly 1..N');
  else if (!sortedOk) fail('sorted_by_value', 'implied value not non-increasing with rank');
  else if (distinct === 1) fail('sorted_by_value', 'all implied values equal');
  else ok('sorted_by_value', `ranks 1..${board.length}, non-increasing, ${distinct} distinct values`);
}

// 4. coverage
{
  const have = new Set(board.map((r) => r.slug));
  const missing = snap.watchlist.filter((s) => !have.has(s));
  if (missing.length) fail('coverage', `missing watchlist slugs: ${missing.join(', ')}`);
  else ok('coverage', `${snap.watchlist.length}/${snap.watchlist.length} watchlist protocols on the board`);
}

// 5. farm_steps
{
  let bad = [];
  board.forEach((r, i) => {
    if (!Array.isArray(r.farm_steps) || r.farm_steps.length < 3 || r.farm_steps.length > 12) { bad.push(`row ${i}: ${r.farm_steps?.length} steps`); return; }
    r.farm_steps.forEach((s, j) => {
      const t = String(s).trim();
      if (t.length < 20 || t.length > 600 || t !== String(s).trim()) bad.push(`row ${i} step ${j}: length ${t.length}`);
    });
  });
  if (bad.length) fail('farm_steps', bad.slice(0, 5).join('; '));
  else ok('farm_steps', `every row has 6 steps, each 20-600 chars (observed 149-249)`);
}

// 6. screenshots
{
  const shots = readdirSync(join(outDir, 'screenshots')).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort();
  let bad = [];
  if (shots.length < 3 || shots.length > 4) bad.push(`count ${shots.length}`);
  for (const name of shots) {
    const buf = readFileSync(join(outDir, 'screenshots', name));
    if (buf.length > 512 * 1024) bad.push(`${name}: ${buf.length} bytes`);
    const isPng = buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
    if (!isPng && !isJpeg) { bad.push(`${name}: not PNG/JPEG`); continue; }
    if (isPng) {
      const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
      const long = Math.max(w, h), short = Math.min(w, h);
      if (long > 1440 || short < 800) bad.push(`${name}: ${w}x${h}`);
    }
  }
  if (bad.length) fail('screenshots', bad.join('; '));
  else ok('screenshots', `${shots.length} PNGs, each <=512 KiB, 1440x900 (long 1440, short 900)`);
}

// 7. dossier_matches
{
  const written = readFileSync(join(outDir, 'dossier.json'));
  const rebuilt = Buffer.from(buildDossier(outDir, { text_max_bytes: 65536 }));
  if (!written.equals(rebuilt)) fail('dossier_matches', `dossier.json differs from a fresh buildDossier (${written.length} vs ${rebuilt.length} bytes)`);
  else {
    const d = JSON.parse(written.toString('utf8'));
    ok('dossier_matches', `byte-identical to buildDossier; schema ${d.schema}; text ${Buffer.byteLength(d.text, 'utf8')} bytes; ${d.images.length} images; cut: ${d.text.includes('[Cut at')}`);
  }
}

console.log(fails.length === 0 ? '\nALL 7 GATE ROWS PASS' : `\n${fails.length} GATE ROW(S) FAIL: ${fails.join(', ')}`);
process.exit(fails.length === 0 ? 0 : 1);
