// Token Radar: build the ranked board from the sealed DefiLlama snapshot.
//
//   node main.ts [--input <snapshot.json>] [--output <dir>]
//
// Reads the snapshot (default /input/snapshot.json, the sealed file the
// grader mounts), scores every pre-token protocol with the comps-calibrated
// model in lib/model.ts, and writes:
//
//   <out>/board.json     the ranked board, 100+ rows with implied values
//   <out>/data.js        the same board as window.TOKEN_RADAR for the page
//   <out>/dashboard/     a copy of dashboard/ (index.html + app.css + app.js)
//   <out>/screenshots/   a copy of screenshots/ (the board, a detail, a filter)
//   <out>/dossier.json   buildDossier's exact bytes for the judge
//
// The output directory is --output, else $MAKEFUN_OUTPUT_DIR, else /output.
// Node 22+ runs this file directly (type stripping); no build step.

import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildBoard } from "./lib/model.ts";
import type { Snapshot } from "./lib/model.ts";
import { buildDossier } from "./vendor/makefun-board.ts";

// Paths are resolved against this file, not the working directory, so the
// grader can run `node main.ts` from anywhere.
const repoRoot = dirname(fileURLToPath(import.meta.url));

function argValue(argv: string[], name: string): string | null {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null;
}

function findSnapshot(explicit: string | null): string {
  const candidates = [
    explicit,
    "/input/snapshot.json",
    resolve("input/snapshot.json"),
    resolve("../input/snapshot.json"),
  ].filter((c): c is string => c !== null);
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  throw new Error(
    "token radar: no snapshot found: pass --input <snapshot.json|directory> or mount the sealed /input",
  );
}

function findOutput(explicit: string | null): string {
  const fromEnv = process.env.MAKEFUN_OUTPUT_DIR;
  return explicit ?? (fromEnv && fromEnv.length > 0 ? fromEnv : "/output");
}

function main(): void {
  const argv = process.argv.slice(2);
  const inputPath = findSnapshot(argValue(argv, "--input"));
  const outDir = findOutput(argValue(argv, "--output"));
  mkdirSync(outDir, { recursive: true });

  const raw = readFileSync(inputPath, "utf8");
  const snapshot = JSON.parse(raw) as Snapshot;
  const board = buildBoard(snapshot);

  const boardDoc = {
    title: "Token Radar — pre-token protocols ranked by implied launch value",
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    counts: board.counts,
    rows: board.rows,
  };
  writeFileSync(join(outDir, "board.json"), JSON.stringify(boardDoc, null, 1) + "\n", "utf8");

  const dataDoc = {
    asOf: snapshot.as_of,
    source: snapshot.source,
    floorUsd: snapshot.floor_usd,
    counts: board.counts,
    comps: board.comps,
    rows: board.rows,
    excluded: board.excluded,
  };
  writeFileSync(
    join(outDir, "data.js"),
    `window.TOKEN_RADAR = ${JSON.stringify(dataDoc)};\n`,
    "utf8",
  );

  cpSync(join(repoRoot, "dashboard"), join(outDir, "dashboard"), { recursive: true });
  cpSync(join(repoRoot, "screenshots"), join(outDir, "screenshots"), { recursive: true });

  const dossier = buildDossier(outDir, { text_max_bytes: 65536 });
  writeFileSync(join(outDir, "dossier.json"), dossier);

  console.log(
    `token radar: ${board.counts.protocols} protocols, ${board.counts.watchlist} on the watchlist, ` +
      `${board.counts.boardRows} rows scored (${board.counts.excludedAboveFloor} large non-launchers set aside)`,
  );
  console.log(
    `token radar: wrote ${outDir}/board.json, ${outDir}/data.js, ${outDir}/dashboard, ` +
      `${outDir}/screenshots and ${outDir}/dossier.json`,
  );
}

main();
