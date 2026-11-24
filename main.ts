// Token Launch Radar — program entry (model radar-2).
//
// Reads a DefiLlama protocols snapshot and writes the submission output:
//
//   board.json      the ranked board: every watchlist protocol plus every
//                   rankable pre-token protocol below the floor, by implied
//                   issuance value (model radar-2, lib/model.ts).
//   data.js         the same rows plus the live-token tab, for the dashboard.
//   dashboard/      the static dashboard (index.html, app.css, app.js).
//   screenshots/    the three real dashboard screenshots.
//   dossier.json    the makefun dossier, written last from the output dir.
//
// Run from the repository root:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
//
// The run is deterministic: every byte written is a function of the input
// snapshot only. generated_at is the snapshot's own as_of date, never the
// wall clock, so two runs write identical bytes.

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { boardFor, comparableStats, MODEL_VERSION } from './lib/model.ts';
import type { Snapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

function usage(): never {
  console.error('usage: MAKEFUN_OUTPUT_DIR=<dir> node main.ts [--input <snapshot.json>]');
  process.exit(2);
}

function parseArgs(argv: string[]): { input: string } {
  let input = '../input/snapshot.json';
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--input' && i + 1 < argv.length) {
      input = argv[++i]!;
    } else if (argv[i] === '--help' || argv[i] === '-h') {
      usage();
    } else {
      console.error(`unknown argument: ${argv[i]}`);
      usage();
    }
  }
  return { input };
}

function main(): void {
  const { input } = parseArgs(process.argv.slice(2));
  const outputDir = process.env.MAKEFUN_OUTPUT_DIR;
  if (!outputDir || resolve(outputDir) === resolve('/')) usage();

  const snapshot = JSON.parse(readFileSync(input, 'utf8')) as Snapshot;
  if (!Array.isArray(snapshot.protocols) || !Array.isArray(snapshot.watchlist) || !snapshot.as_of) {
    throw new Error('snapshot must carry protocols, watchlist and as_of');
  }
  const bySlug = new Map(snapshot.protocols.map((p) => [p.slug, p]));
  for (const slug of snapshot.watchlist) {
    if (!bySlug.has(slug)) throw new Error(`watchlist slug missing from snapshot: ${slug}`);
  }

  const { board, live } = boardFor(snapshot);
  const comparables = comparableStats(snapshot);

  mkdirSync(outputDir, { recursive: true });
  mkdirSync(join(outputDir, 'dashboard'), { recursive: true });
  mkdirSync(join(outputDir, 'screenshots'), { recursive: true });

  writeFileSync(join(outputDir, 'board.json'), JSON.stringify(board, null, 2) + '\n');
  const data = {
    generated_at: snapshot.as_of,
    as_of: snapshot.as_of,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    comparables,
    rows: board,
    live,
    watchlist: snapshot.watchlist,
  };
  writeFileSync(join(outputDir, 'data.js'), 'window.RADAR = ' + JSON.stringify(data, null, 2) + ';\n');

  const dashboardDir = join(process.cwd(), 'dashboard');
  for (const name of ['index.html', 'app.css', 'app.js']) {
    const src = join(dashboardDir, name);
    if (!existsSync(src)) throw new Error(`missing dashboard file: ${src}`);
    cpSync(src, join(outputDir, 'dashboard', name));
  }

  const shotsDir = join(process.cwd(), 'screenshots');
  const shots = existsSync(shotsDir)
    ? readdirSync(shotsDir).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort()
    : [];
  if (shots.length < 3) {
    throw new Error(`screenshots/ must hold at least 3 screenshots, found ${shots.length}`);
  }
  for (const name of shots) cpSync(join(shotsDir, name), join(outputDir, 'screenshots', name));

  writeFileSync(
    join(outputDir, 'dossier.json'),
    buildDossier(outputDir, {
      text_max_bytes: 65536,
      screenshots: { max: 4, max_bytes: 512 * 1024 },
      dashboard: { max_files: 400, max_bytes: 4 * 1024 * 1024 },
    }),
  );

  console.log(`board: ${board.length} rows (${snapshot.watchlist.length} watchlist + ${board.length - snapshot.watchlist.length} early)`);
  console.log(`live tab: ${live.length} rows`);
  console.log(`top implied value: ${board[0]?.name ?? 'none'} $${board[0]?.implied_value_usd ?? 0}`);
  console.log(`screenshots: ${shots.length} (${shots.join(', ')})`);
  console.log(`wrote ${outputDir}/`);
}

main();
