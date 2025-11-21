# Source Catalog (Phase 4A draft)

収集ソースの優先度・メタデータを JSON 管理するためのスキーマとサンプル。`workers/pipeline` で参照する想定。

## スキーマ（候補）
- `id`: プロバイダ固有 ID（YouTube channelId / playlistId, Spotify artistId / playlistId）
- `provider`: `youtube` | `spotify` | `apple`
- `kind`: `channel` | `playlist` | `artist`
- `tier`: `L1` | `L2` | `L3`（優先度）
- `name`: 表示用ラベル
- `notes`: 任意メモ（レーベル名、根拠等）
- `active`: boolean。false ならスキップ
- `updatedAt`: ISO 8601 文字列（手動更新用）

## サンプル
サンプル JSON はリポジトリに含めず、Secrets/Config（例: ENV 変数 `SOURCE_CATALOG_JSON`）で管理する。必要に応じてこのファイルのスキーマを参照して生成すること。

## 運用メモ
- L1/L2/L3 の降格ロジックは `tier` 基準。クォータ枯渇時は低 tier からスキップする。
- ブラックリストや一時停止は `active=false` で表現し、次回再開時に `updatedAt` を更新。
- Apple Music は PoC 評価用に `active=false` で初期登録する。
