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
if (Array.isArray(dataset)) {
  for (const t of dataset) {
    const key = t.id || t.slug || t.uid;
    if (!key) continue;
    const ov = overrides[key];
    if (!ov) continue;
    t.media = t.media || {};
    t.media.apple = { ...(t.media.apple || {}), ...(ov.media?.apple || {}) };
    count++;
  }
} else if (dataset && dataset.tracks) {
  for (const t of dataset.tracks) {
    const key = t.id || t.slug || t.uid;
    if (!key) continue;
    const ov = overrides[key];
    if (!ov) continue;
    t.media = t.media || {};
    t.media.apple = { ...(t.media.apple || {}), ...(ov.media?.apple || {}) };
    count++;
  }
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

