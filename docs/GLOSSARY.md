# Glossary

> 言語ポリシー: 日本語（固有名詞/API名は英語可）

- **Candidate（候補）**: JSONL 1行=1曲の候補。`provider/id/title/game/answers.canonical` を基本項目とし、`provenance` を付与する。
- **Pool（在庫）**: by_date に未配置の候補集合。大量backfill時はまずPoolに積む。
- **by_date（カレンダー）**: `public/app/daily_auto.json` の出題スケジュール。将来は年別分割を併用。
- **Discovery**: ネット上の公式ソースを自動探索する段階（例: iTunes Search API、のちに YT Data / Apple Music）。
- **Harvest**: Discovery で見つかった対象をデータ化（正規化・provenance付与・重複排除）。
- **Guard**: 明らかな不正（provider/id形式、疑似NG語など）を除外/警告する処理。
- **De-dup**: 近似重複の排除。正規化＋N-gram類似＋（将来）pHash/SimHash 等。
- **Difficulty**: 推定難易度（v1.10で再設計）。
- **Notability**: “どれだけ知られているか”の指標（人気/再生/別名頻度/リスト参照など）。
- **Mix（出題ミックス）**: Notability×Difficulty の帯域で日次の構成比を定義すること。
- **Horizon（地平線）**: 未来の先取り上限（日数）。既定は90日を想定。

(以降、既存用語)
