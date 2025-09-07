# Authoring Operations (v1.7)

本書は v1.7（Authoring Automation, MVP）の**日次運用手順**と**トラブルシュート**をまとめたものです。

## 1. 何ができる？
- 毎日 1 件の出題データを **自動生成 → 検証 → PR 作成 → 自動マージ**。
- 失敗しても **最低 1 件を保証**（`ensure_min_items_v1_post.mjs`）。
- 最終生成物は **by_date フラット形**で `title/game/composer/media/answers/norm` を保証。

## 2. パイプライン（GitHub Actions）
1) **harvest / merge**（候補統合）  
2) **score / enrich / clip-start**（属性付与・再生開始）  
3) **generate daily**（暫定の当日データ）  
4) **ensure_min_items**（空なら 1 件注入）  
5) **distractors_v1 / difficulty_v1**（選択肢補完・難易度付与）  
6) **finalize_daily_v1**（フラット形 + 必須フィールド補完）  
7) **validate**（`validate_nonempty_today` → `validate_authoring`）  
8) **export_today_slim**（検収用 `build/daily_today.json/.md`）  
9) **PR 作成 → Auto-merge**

> ジョブ: `authoring (heuristics smoke)` / `daily (auto extended)`

## 3. 見るべきアーティファクト
- `build/daily_today.md`：**人間読み**サマリ（タイトル、正答、メディア、難易度）
- `build/daily_today.json`：当日 1 件の JSON
- `public/app/daily_auto.json`：フル（過去分含む）

## 4. よくある詰まり・対処
- **当日が空で fail** → `merge_seed_candidates` が空でも `ensure_min_items` が補う。`sources/seed_candidates.jsonl` を 1–3 件追加すると安定。
- **バリデータで title/game/composer/norm が無い** → finalize が入っているか確認。`finalize_daily_v1` のログに `normalized by_date ...` が出ること。
- **PR が “check 待機”で止まる** → `auto-merge.yml` の権限/イベント/条件を確認（既知事例は docs/ISSUES にメモ）。

## 5. 手動実行
- Actions タブ → 該当ワークフロー → **Run workflow** → date 未指定で当日（JST）。

## 6. データ入力の増やし方
- `sources/allowlist.json`：チャンネル/パブリッシャの拡充（任意）
- `sources/seed_candidates.jsonl`：安全な候補（`provider:auto` も可）を数件ずつ追加

### PR 自動作成でのトラブル回避（重要・再掲）
自動生成された PR で必須チェック（`ci-fast-pr-build` / `pages-pr-build` / `required-check`）が**起動しない/待機のまま**になる場合、
PR作成に **GITHUB_TOKEN** を使っていることが原因です。**必ず PAT を使用**してください。

- ワークフロー: `daily (ogp+feeds)`（`ogp-and-feeds.yml`）
- 対応: `peter-evans/create-pull-request` の `token` に **`${{ secrets.DAILY_PR_PAT }}`** を指定
- 必要権限: PAT は `repo` スコープ
- 参考: GitHub の仕様として、GITHUB_TOKEN で作成した PR/commit では他の Workflow の `pull_request` イベントが起動しない場合があります

この要件は `daily (auto extended)` と同様です。両方で **PAT** を使ってください。

## 7. 日次チェックリスト（軽監視）
- `build/daily_today.json/.md` の当日 1 件を確認（**choices** が 1 or 4、欠損がない）
- **difficulty** が `0.00–1.00` の範囲に収まっている
- **media.provider / media.id** が存在（`?provider=auto&test=1&mock=1&autostart=1` で埋め込み可）
- **answers.canonical** が正規化済み
- Actions ログに `[difficulty] date=… values=[…]` の数値出力がある



## v1.8 追補 — スキーマ検証の仕様更新
- **入力の自動アンラップ**：`build/daily_today.json` の `{ date, item }` 形を自動で `{ date, ...item }` に展開して検証します。
- **フォールバック**：`build/daily_today.json` が無い/壊れている場合は `public/app/daily_auto.json` の `by_date` から最新日付を選びます（JST想定）。
- **composer の互換**：`item.composer` と `item.track.composer` の **どちらでも可**（過去データの互換保持）。
- **difficulty は警告**：`0..1` の範囲外や欠落は `::warning::` として注記し、**ジョブは失敗させません**。

### 手動確認メモ
- Actions の `authoring (schema check)` を実行し、`schema: OK file=... date=YYYY-MM-DD` を確認。
- 必須欠落（title/game/composer/media.provider/id/answers.canonical）がある場合は `::error::` が出て **失敗**します。

### Empty-day handling
If `by_date[<today>]` is empty (e.g. `{ items: [] }`) and no earlier non-empty date exists, you can temporarily allow CI to pass:

- Set `SCHEMA_CHECK_ALLOW_EMPTY=true` (emits a warning, but the job succeeds)
- After wiring the authoring pipeline to produce `build/daily_today.json`, remove this env to restore strictness.

### Stub-on-empty (exporter)
When you need the exporter to succeed even if no valid item is found, enable a minimal stub:

- Set `EXPORT_SLIM_STUB_ON_EMPTY=true` (emits a warning and writes a stub item)
- The stub contains minimal schema-compliant fields: 
  - `title:"(stub) pending fill"`
  - `game:"(stub)"`
  - `composer:"(stub)"`
  - `media:{provider:"mock", id:"stub"}`
  - `answers:{canonical:"(stub)"}`
  - `difficulty:0`

> Remove this env once real data is available to keep the pipeline strict.

### Authoring pipeline input
Authoring post scripts **must** receive `--in public/app/daily_auto.json` so they can form today's artifact:

```bash
node scripts/finalize_daily_v1.mjs --in public/app/daily_auto.json
node scripts/ensure_min_items_v1_post.mjs --in public/app/daily_auto.json
node scripts/validate_nonempty_today.mjs --in public/app/daily_auto.json
node scripts/difficulty_v1_post.mjs --in public/app/daily_auto.json
node scripts/distractors_v1_post.mjs --in public/app/daily_auto.json
node scripts/export_today_slim.mjs --in public/app/daily_auto.json
```

### GitHub Actionsでの候補生成
ローカル実行しない場合は、専用ワークフローを手動実行してください。

1. **Actions → "apple overrides (generate)" → Run workflow**
   - 必要なら `jsonl_path` に `public/app/daily_candidates_scored_enriched.jsonl` 等を指定
2. アーティファクト `apple_override_candidates` をダウンロード
3. 中身を確認し、必要なエントリに Apple の URL / embedUrl を記入
4. `data/apple_overrides.jsonc` に反映してコミット → 通常の `daily` ワークフローで反映を確認

## オーバーライド候補の自動抽出
- 既存の候補JSONLから、Appleオーバーライドの **正規化キー** を自動生成できます。
- 出力は JSONC。各エントリに `media.apple` の空テンプレが入るため、URLを埋めて保存すればそのまま適用可能です。

### 使い方
```bash
node scripts/generate_apple_override_candidates.mjs --out build/apple_override_candidates.jsonc
# 内容を確認・編集してから data/apple_overrides.jsonc へ反映
cp build/apple_override_candidates.jsonc data/apple_overrides.jsonc
```

- キーの優先順: `norm.game__norm.title` → `norm.answer__norm.title` → `norm.answer` → `norm.title`
- 厳密一致をしたい場合は、各エントリに `match: { title, game, answer }` を付けてください。

## Stub 運用の卒業（v1.8）
- 原則として **stub に依存しません**。出題がゼロの日は `ensure_min_items_v1_post.mjs` により最低 1 件を補います。
- `scripts/export_today_slim.mjs` は **厳格モード**（有効データがない場合は非ゼロ終了）を維持します。
- 日次の入力（候補）は `sources/seed_candidates.jsonl` と `sources/allowlist.json` を継続拡充してください。
- トラブル時は `build/logs/backfill_YYYYMMDD.txt` を確認（本チャットで追加されたバックフィルログ）。


## Apple優先のメディア添付（v1.8）
- `scripts/export_today_slim.mjs` は **Appleのオーバーライド**（`data/apple_overrides.jsonc` または `resources/data/apple_overrides.jsonc`）を自動適用します。
- オーバーライドのキーは以下の **正規化キー** を推奨します（いずれか一致で適用）。
  - `norm.game__norm.title` 例: `super mario bros.__main theme`
  - `norm.answer__norm.title`
  - `norm.answer`
  - `norm.title`
- 値の形式例：
  ```jsonc
  {
    "super mario bros.__main theme": {
      "media": { "apple": {
        "url": "https://music.apple.com/jp/album/xxxxx",
        "embedUrl": "https://embed.music.apple.com/jp/album/xxxxx",
        "previewUrl": "https://is1-ssl.mzstatic.com/.../preview.m4a"
      }}
    },
    "any-key-with-match": {
      "match": { "title": "main theme", "game": "super mario bros." },
      "media": { "apple": { "url": "...", "embedUrl": "...", "previewUrl": "..." } }
    }
  }
  ```
  - クライアント側の再生は `public/app/media_player.mjs` により **Apple優先** でレンダリングされます（`media.apple.embedUrl | previewUrl | url` が存在すれば Apple を選択）。

### スタブ運用の終了（stub-on-empty → OFF）
- `scripts/export_today_slim.mjs` の **stub-on-empty は運用終了**しました。通常は **厳格モード（見つからなければ fail）** で動作します。
- どうしても暫定的にスタブを出したい場合のみ、手動実行で
  ```bash
  EXPORT_SLIM_STUB_ON_EMPTY=true node scripts/export_today_slim.mjs --in public/app/daily_auto.json
  ```
  を使用してください（CIでは常にOFF）。


## 正規化（v1.8 Phase 2）
- 入力揺れを `scripts/normalize_core.mjs` で統一します。

### 使い方
```bash
node scripts/normalize_core.mjs --in public/app/daily_auto.json
```

