#!/usr/bin/env node
/**
 * scripts/smoke_apple_override.mjs
 * 手動入力（キー or タイトル/ゲーム）から、Appleオーバーライドが適用された
 * build/daily_today.json / .md を生成して、アーティファクトで確認するためのスモークテスト。
 *
 * 使い方（例）:
 *   node scripts/smoke_apple_override.mjs --key "chrono trigger__corridors of time"
 *   node scripts/smoke_apple_override.mjs --game "Chrono Trigger" --title "Corridors of Time"
 *
 * 出力:
 *   build/daily_today.json
 *   build/daily_today.md
 */
import fs from 'node:fs/promises';
import path from 'node:path';

function stripJsonc(raw){
  return String(raw)
    .replace(/\/\*(?:.|\n|\r)*?\*\//g, '')
    .replace(/(^|\s+)\/\/.*$/gm, '');
}
async function readOverridesMaybe(...paths){
  for (const p of paths){
    try {
      const raw = await fs.readFile(p, 'utf-8');
      return JSON.parse(stripJsonc(raw));
    } catch {}
  }
  return null;
}
function normLower(s){ return String(s||'').toLowerCase().trim().replace(/\s+/g,' '); }
function keyCandidatesFrom(item){
  const title = normLower(item?.title);
  const game  = normLower(item?.game?.name || item?.game);
  const answer= normLower(item?.answers?.canonical || item?.norm?.answer || game);
  const keys = [];
  if (game && title) keys.push(`${game}__${title}`);
  if (answer && title) keys.push(`${answer}__${title}`);
  if (answer) keys.push(answer);
  if (title) keys.push(title);
  return Array.from(new Set(keys));
}
function looksValidApple(a){
  if (!a || typeof a !== 'object') return false;
  const hasX = (v)=> typeof v === 'string' && v.includes('xxxxx');
  const isApple = (v)=> typeof v === 'string' && /(https?:)?\/\/(embed\.)?music\.apple\.com\//.test(v);
  const isPreview = (v)=> typeof v === 'string' && /https?:\/\/.*mzstatic\.com\//.test(v) && /\.(m4a|mp3)(\?|$)/.test(v);
  if (hasX(a.url) || hasX(a.embedUrl) || hasX(a.previewUrl)) return false;
  return isApple(a.embedUrl) || isApple(a.url) || isPreview(a.previewUrl);
}
function attachAppleFromOverrides(item, overrides){
  if (!overrides || typeof overrides !== 'object') return item;
  const keys = keyCandidatesFrom(item);
  for (const k of keys){
    const v = overrides[k];
    if (v && v.media && looksValidApple(v.media.apple)){
      item.media = item.media || {};
      item.media.apple = v.media.apple;
      return item;
    }
  }
  for (const v of Object.values(overrides)){
    if (v && v.match){
      const vm = v.match;
      const wantTitle = normLower(vm.title);
      const wantGame  = normLower(vm.game);
      const wantAns   = normLower(vm.answer);
      const title = normLower(item?.title);
      const game  = normLower(item?.game?.name || item?.game);
      const ans   = normLower(item?.answers?.canonical || item?.norm?.answer || game);
      if ((wantTitle?wantTitle===title:true) &&
          (wantGame?wantGame===game:true) &&
          (wantAns?wantAns===ans:true) &&
          v.media && looksValidApple(v.media.apple)){
        item.media = item.media || {};
        item.media.apple = v.media.apple;
        return item;
      }
    }
  }
  return item;
}

function parseArgs(argv){
  const o = { title:null, game:null, answer:null, composer:null, key:null, outDir:'build' };
  for (let i=0;i<argv.length;i++){
    const a = argv[i];
    if (a === '--title' && argv[i+1]) { o.title = argv[++i]; continue; }
    if (a === '--game' && argv[i+1]) { o.game = argv[++i]; continue; }
    if (a === '--answer' && argv[i+1]) { o.answer = argv[++i]; continue; }
    if (a === '--composer' && argv[i+1]) { o.composer = argv[++i]; continue; }
    if (a === '--key' && argv[i+1]) { o.key = argv[++i]; continue; }
    if (a === '--out' && argv[i+1]) { o.outDir = argv[++i]; continue; }
  }
  return o;
}

async function main(){
  const opts = parseArgs(process.argv.slice(2));
  let title = opts.title;
  let game  = opts.game;
  if (opts.key && (!title || !game)){
    const parts = opts.key.split('__');
    if (parts.length >= 2){
      game = game || parts[0];
      title = title || parts.slice(1).join('__');
    }
  }
  if (!title || !game){
    console.error('[smoke] --key "game__title" か --title/--game を指定してください');
    process.exit(2);
  }
  const item = {
    date: new Date().toISOString().slice(0,10),
    title, game, composer: opts.composer || '',
    answers: { canonical: opts.answer || game },
    difficulty: 0.5,
    media: {}
  };

  // attach Apple overrides
  try {
    const overrides = await readOverridesMaybe('data/apple_overrides.jsonc','resources/data/apple_overrides.jsonc');
    attachAppleFromOverrides(item, overrides);
  } catch (e) {
    console.warn('[smoke] overrides read failed:', e?.message || e);
  }

  await fs.mkdir(opts.outDir, { recursive: true });
  await fs.writeFile(path.join(opts.outDir,'daily_today.json'), JSON.stringify({ date: item.date, item }, null, 2), 'utf-8');

  const pickedDate = item.date;
  const mdLink = item?.media?.apple?.url || '';
  const md = `# ${pickedDate}\n\n- **Title**: ${title}\n- **Game**: ${game}\n${mdLink?'- **Media**: '+mdLink+'\n':''}`;
  await fs.writeFile(path.join(opts.outDir,'daily_today.md'), md, 'utf-8');

  console.log('[smoke] wrote build/daily_today.json and .md');
  if (item?.media?.apple) {
    console.log('[smoke] apple:', item.media.apple);
  } else {
    console.log('[smoke] apple: (none)');
  }
}

main().catch(e=>{ console.error(e); process.exit(1); });
