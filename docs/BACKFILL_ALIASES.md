# BACKFILL_ALIASES (v1)

`public/app/daily_auto.json` の `by_date` を走査して、`data/aliases/{game,composer,track}.json` に
不足している正規化キー（小文字化＋空白圧縮）→ 正式表記を追加します。

- 既存値は上書きしません（衝突はスキップ）
- ログ: `build/logs/backfill_YYYYMMDD.txt`
- **注意:** 自動で意味解釈はしません。名称統一は軽微な補完（lower/space）までです。

## 運用手順（PR 自動作成 / PAT 版）

1. GitHub リポジトリに **Secrets → `CPR_PAT`** を追加  
   - Fine-grained PAT / Repository permissions: **Contents: Read & Write**, **Pull requests: Read & Write**
2. Actions の **Workflow permissions** を *Read and write permissions* に設定
3. `aliases backfill` を手動実行  
   - 成果物: `data/aliases/*.json`, `build/logs/backfill_YYYYMMDD.txt`
   - 変更があれば **PR が自動作成**され、`automerge` ラベルにより **自動マージ**（保護ルールを満たす場合）
4. トラブル時は `build/logs/backfill_*.txt` を確認

### メモ
- ブランチは `chore/aliases-backfill-<run_id>`（ユニーク）で作成します。
- `CPR_PAT` が未設定の場合は PR 作成で失敗します（`required secret not found`）。設定後に再実行してください。
