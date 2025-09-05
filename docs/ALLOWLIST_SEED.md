# Allowlist & Seed 入門（v1.7）

## 目的
- **公式ソース優先**で候補を安定供給するため、手動シードと簡易許可リストを導入します。
- 大規模クローリングは行わず、**再現性の高い入力**を確保します。

## ファイル構成
```
sources/
  ├─ allowlist.json         # 公式チャンネル/パブリッシャ等（任意）
  └─ seed_candidates.jsonl  # 手動シード（1行=1候補）
```

### allowlist.json
```json
{
  "youtubeChannels": ["<channel_id>", "..."],
  "applePublishers": ["square enix", "nintendo", "..."]
}
```
- 省略可。指定した場合、`merge_seed_candidates.mjs` が **YouTubeはchannel_id、Appleはpublisher** で軽くフィルタします。

### seed_candidates.jsonl
- 1行=1 JSON。主要フィールドは以下（最小でOK）
  - `title`, `game{name,series,year}`, `track{name,composer,publisher?}`
  - `clip{provider,id,start?,duration?,channel_id?}`
  - `answers{canonical}`, `sources[{url}]`

## マージ手順（CI/ローカル）
`harvest` の直後にマージします。

```bash
node scripts/harvest_candidates.js --out public/app/daily_candidates.jsonl
node scripts/merge_seed_candidates.mjs \
  --in public/app/daily_candidates.jsonl \
  --seed sources/seed_candidates.jsonl \
  --allow sources/allowlist.json \
  --out public/app/daily_candidates_merged.jsonl
node scripts/score_candidates.js --in public/app/daily_candidates_merged.jsonl --out public/app/daily_candidates_scored.jsonl
```

## 重複判定
- 正規化した `provider|id|answers.canonical` をキーに一意化
- 正規化は **小文字化・空白圧縮・ダッシュ統一・波チルダ統一** の軽量版（詳細はコード参照）

## 注意
- seed は **手動で信頼できるもの**を基本とし、著作権/埋め込み可否に配慮してください。
- allowlist は運用しながら拡張しましょう（PRで差分が見やすい JSON 推奨）。

