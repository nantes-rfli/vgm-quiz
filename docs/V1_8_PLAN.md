# v1.8 計画（Apple優先／Stub卒業／Smoke）

## サマリ（最終化 2025-09-07）
- Apple Overrides v2：Chrono/FF/Sonic を公式URLで運用、任天堂系は原則 YouTube 公式維持
- smoke apple override：inputs 無指定で overrides 先頭キーを自動選択、`build/daily_today.json/.md` を生成
- aliases backfill：PAT／ユニークブランチ／差分なし時は PR スキップ、automerge ラベル付与
- Stub 卒業：`EXPORT_SLIM_STUB_ON_EMPTY=false`（本番常時OFF）、`authoring (schema check)` でのみ stub 許容
- OGP/Feed：`daily (ogp+feeds)` に集約（当日HTMLは生成しない仕様）

**DoD**
- Actions 緑、Smoke アーティファクトで Apple 優先が確認可能
- ドキュメント更新（OPERATIONS_AUTHORING / BACKFILL_ALIASES / 言語ポリシー）

## 目的
- Apple公式を優先し、YouTube 公式・その他をフォールバックにする運用基盤を整える
- Stub を本番では廃止し、データ品質の可視化を明確化する（authoring でのみ例外的に許容）
