#!/usr/bin/env node
/**
 * clip_start_heuristics_v1.mjs
 * 最小ルールベースの開始秒推定。
 *
 * 入力:  JSONL（1行=1候補）
 *   - 期待フィールド（存在すれば利用）: title, track.name, game.name, clip{provider,id,start,duration}
 * 出力:  JSONL（clip.start が無い/auto の場合に限り推定して付与。--force で上書き）
 *
 * ルール（優先順）:
 *  1) 既存 start が数値なら尊重（--force がない限り上書きしない）
 *  2) タイトル/トラック名のキーワード:
 *     - "Opening","Prologue","Title","Main Theme","序曲","オープニング","タイトル" → 0
 *     - "Boss","Battle","Stage","Zone","Act","Level","Field","Dungeon","VS","戦","ボス","ステージ" → 12
 *     - "Ending","Credits","Staff Roll","エンディング","スタッフロール","スタッフ ロール" → 20
 *  3) プロバイダ特性:
 *     - apple: プレビュー想定で 15 を既定候補（短い導入を避ける）
 *     - youtube: 10 を既定候補
 *  4) 何も当たらなければ defaultStart（既定=45）
 *
 * 制約:
 *  - 出力 start は 0 <= start <= maxStart（既定=120）に clamp。
 *  - duration が存在すれば 1 <= duration <= 60 を尊重（変更しない）。
 *
 * 使い方:
 *  node scripts/clip_start_heuristics_v1.mjs --in input.jsonl --out output.jsonl [--default 45] [--max 120] [--force]
 */
import fs from 'node:fs';
import readline from 'node:readline';
function parseArgs(argv) {
  const args = { default: 45, max: 120, force: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--in') args.in = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--default') args.default = Number(argv[++i]);
    else if (a === '--max') args.max = Number(argv[++i]);
    else if (a === '--force') args.force = true;
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
}
function usage() {
  console.log(`Usage:
  node scripts/clip_start_heuristics_v1.mjs --in input.jsonl --out output.jsonl [--default 45] [--max 120] [--force]
`);
}
const args = parseArgs(process.argv);
if (args.help || !args.in || !args.out) {
  usage();
  process.exit(args.help ? 0 : 1);
}

const MIN_SEGMENT_SEC = 15;     // 短すぎ対策（常に最低15sは確保）
const YT_MIN_OFFSET_SEC = 3;    // YouTubeは冒頭ノイズ/ジングルを避けて+3s
const CHORUS_DEFAULT_SEC = 45;  // サビ/Chorus は目安で45s（曲による）
function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}
function hasNumericStart(clip) {
  return clip && typeof clip.start === 'number' && Number.isFinite(clip.start);
}
function textOf(entry) {
  const parts = [];
  if (entry?.title) parts.push(String(entry.title));
  if (entry?.track?.name) parts.push(String(entry.track.name));
  if (entry?.game?.name) parts.push(String(entry.game.name));
  return parts.join(' • ').toLowerCase();
}
function keywordStart(text) {
  // 先に「冒頭系」
  const opening = /(opening|prologue|title|main\s*theme|序曲|ｵｰﾌﾟﾆﾝｸﾞ|オープニング|タイトル)/i;
  if (opening.test(text)) return 0;
  // 次に「ボス/戦闘/面」
  const battle = /(boss|battle|stage|zone|act|level|field|dungeon|\bvs\b|戦|ボス|ステージ)/i;
  if (battle.test(text)) return 12;
  // 末尾系
  const ending = /(ending|credits|staff\s*roll|エンディング|スタッフ.?ロール)/i;
  const chorus = /(chorus|サビ)/i;
  if (ending.test(text)) return 20;
  if (chorus.test(text)) return CHORUS_DEFAULT_SEC;
  return null;
}
function providerDefault(provider) {
  if (!provider) return null;
  const p = String(provider).toLowerCase();
  if (p.includes('apple')) return 15;
  if (p.includes('youtube')) return 10;
  return null;
}
function guessStart(entry, { defaultStart = 45, maxStart = 120 } = {}) {
  const t = textOf(entry);
  const k = keywordStart(t);
  if (k != null) return clamp(k, 0, maxStart);
  const p = providerDefault(entry?.clip?.provider);
  if (p != null) return clamp(p, 0, maxStart);
  return clamp(defaultStart, 0, maxStart);
}
async function run(inputPath, outputPath, { defaultStart, max, force }) {
  const rl = readline.createInterface({
    input: fs.createReadStream(inputPath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  const out = fs.createWriteStream(outputPath, { encoding: 'utf8' });
  let total = 0;
  let updated = 0;
  for await (const line of rl) {
    if (!line.trim()) { out.write('\n'); continue; }
    let obj;
    try {
      obj = JSON.parse(line);
    } catch (e) {
      console.error('[WARN] skip invalid JSON line');
      continue;
    }
    total++;
    obj.clip = obj.clip || {};
    const hadNumeric = hasNumericStart(obj.clip);
    if (!hadNumeric || force) {
      let flags = [];
      let s = guessStart(obj, { defaultStart, maxStart: max });
      if (!Number.isFinite(obj.clip.duration)) {
        obj.clip.duration = MIN_SEGMENT_SEC;
      } else if (obj.clip.duration < MIN_SEGMENT_SEC) {
        obj.clip.duration = MIN_SEGMENT_SEC;
        flags.push('too_short');
      }
      if (obj.clip.provider && String(obj.clip.provider).toLowerCase().includes('youtube') && s < YT_MIN_OFFSET_SEC) {
        s = YT_MIN_OFFSET_SEC;
        flags.push('start_below_min');
      }
      if (s === max) {
        flags.push('late_start_clamped');
      }
      obj.clip.start = s;
      if (flags.length) obj.clip.flags = Array.from(new Set([...(obj.clip.flags||[]), ...flags]));
      updated++;
    }
    out.write(JSON.stringify(obj) + '\n');
  }
  out.end();
  console.log(`[heuristics] total=${total} updated=${updated} default=${defaultStart} max=${max} force=${force}`);
}
run(args.in, args.out, { defaultStart: args.default, max: args.max, force: args.force }).catch((e) => {
  console.error(e);
  process.exit(1);
});
