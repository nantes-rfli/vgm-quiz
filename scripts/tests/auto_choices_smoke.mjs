#!/usr/bin/env node
/**
 * E2E-lite smoke: verify that mc.js picks choices from daily_auto when ?auto=1 pipeline provides them.
 * Runs in Node (no browser). We simulate window.__DAILY_AUTO_CHOSEN and call generateChoices directly.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- Load Node-side canonical normalizer
const { normalizeAnswer: canonical } = await import(path.resolve(__dirname, '../pipeline/normalize.js'));
// ---- Load mc.js (CommonJS export supported by the app)
const mc = await import(path.resolve(__dirname, '../../public/mc.js')).catch(async () => {
  return await import(path.resolve(__dirname, '../../public/mc.cjs'));
});
const { generateChoices } = mc.default || mc;

function setWindow(obj){
  global.window = Object.assign({}, obj);
}

function asSet(a){ return new Set(a.map(s => String(s))); }

async function main(){
  // 1) Prepare a fake daily_auto entry (composer/game choices)
  const entry = {
    title: 'メインテーマ',
    game: 'ゼルダの伝説',
    composer: '近藤浩治',
    choices: {
      composer: ['Toby Fox', '近藤浩治', 'すぎやまこういち', '光田康典'],
      game: ['ゼルダの伝説', 'クロノ・トリガー', 'ドラゴンクエスト', 'UNDERTALE']
    }
  };
  // 2) Prepare a track (same as entry)
  const track = { title: entry.title, game: entry.game, composer: entry.composer };

  // 3) Simulate window with chosen entry and FORCE flag (so record equality isn't required for the test to be stable)
  setWindow({ __DAILY_AUTO_CHOSEN: entry, __DAILY_AUTO_FORCE: true });

  // 4) Ask for choices (game & composer)
  const chGame = generateChoices(track, 'title-game', [], canonical);
  const chComp = generateChoices(track, 'title-composer', [], canonical);

  // 5) Basic assertions
  assert.equal(chGame.length, 4, 'game choices length must be 4');
  assert.equal(chComp.length, 4, 'composer choices length must be 4');
  // must include correct answers
  assert.ok(chGame.some(v => canonical(v) === canonical(entry.game)), 'game choices include correct');
  assert.ok(chComp.some(v => canonical(v) === canonical(entry.composer)), 'composer choices include correct');
  // must be subset of provided options (order may be shuffled, duplicates pruned)
  const providedGame = asSet(entry.choices.game);
  const providedComp = asSet(entry.choices.composer);
  for (const v of chGame) assert.ok(providedGame.has(String(v)), 'game choice is from daily_auto');
  for (const v of chComp) assert.ok(providedComp.has(String(v)), 'composer choice is from daily_auto');

  console.log('auto choices smoke: OK');
}

main().catch(err => {
  console.error('auto choices smoke: FAIL', err);
  process.exit(1);
});
