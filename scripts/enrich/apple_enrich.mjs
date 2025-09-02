#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function readJsonMaybeJsonc(p) {
  const raw = fs.readFileSync(p, "utf8");
  const stripped = raw
    .replace(/\/\*(?:.|\n|\r)*?\*\//g, "") // /* */ コメント除去
    .replace(/(^|\s+)\/\/.*$/gm, "");           // // コメント除去
  return JSON.parse(stripped);
}

function usage() {
  console.error("Usage: node scripts/enrich/apple_enrich.mjs <dataset.json> <overrides.jsonc> [--write <out.json>]\n\n" +
    "Typical: node scripts/enrich/apple_enrich.mjs build/dataset.json data/apple_overrides.jsonc --write build/dataset.json");
  process.exit(2);
}

const args = process.argv.slice(2);
if (args.length < 2) usage();
const [datasetPath, overridesPath, flag, outPathArg] = args;
const outPath = flag === "--write" ? (outPathArg ?? datasetPath) : (outPathArg ?? "-");

const dataset = readJsonMaybeJsonc(datasetPath);
const overrides = readJsonMaybeJsonc(overridesPath);

let count = 0;

function applyApple(t, ov) {
  t.media = t.media || {};
  t.media.apple = { ...(t.media.apple || {}), ...(ov.media?.apple || {}) };
  count++;
}

function norm(s) { return (s ?? "").toString().trim().toLowerCase(); }

function byKeyMerge(arr, map) {
  for (const t of arr) {
    const key = t.id || t.slug || t.uid;
    if (!key) continue;
    const ov = map[key];
    if (!ov) continue;
    applyApple(t, ov);
  }
}

function byMatchMerge(arr, arrOverrides) {
  for (const ov of arrOverrides) {
    const m = ov.match || {};
    const mt = norm(m.title);
    const mg = norm(m.game);
    if (!mt && !mg) continue;
    for (const t of arr) {
      const tt = norm(t.title);
      const tg = norm(t.game);
      if ((mt ? tt === mt : true) && (mg ? tg === mg : true)) {
        applyApple(t, ov);
      }
    }
  }
}

if (Array.isArray(dataset)) {
  if (Array.isArray(overrides)) byMatchMerge(dataset, overrides);
  else if (overrides && typeof overrides === 'object') byKeyMerge(dataset, overrides);
} else if (dataset && Array.isArray(dataset.tracks)) {
  const arr = dataset.tracks;
  if (Array.isArray(overrides)) byMatchMerge(arr, overrides);
  else if (overrides && typeof overrides === 'object') byKeyMerge(arr, overrides);
} else {
  console.error("Unsupported dataset shape. Expected array or {tracks: []}.");
  process.exit(1);
}

const json = JSON.stringify(dataset, null, 2);
if (outPath === "-") {
  process.stdout.write(json);
} else {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, json);
}
console.error(`[apple_enrich] merged for ${count} track(s) → ${outPath}`);

