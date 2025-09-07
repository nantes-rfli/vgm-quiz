# Architecture

> 言語ポリシー: 日本語（固有名詞/API名は英語可）

## 全体像（データパイプライン）
```
        +-----------+     +---------+     +-------+     +--------+     +-------+
        | Discovery | --> | Harvest | --> | Guard | --> | De-dup | --> | Score |
        +-----------+     +---------+     +-------+     +--------+     +-------+
                                                                     (Difficulty/Notability)
                                     +--------------------------------------------+
                                     |                                            |
                                     v                                            v
                            +-----------------+                           +---------------+
                            |   Pool (在庫)   | --> pick(by_date)  --->   | Export/Front |
                            +-----------------+         (cron/bulk)       +---------------+
```

### 役割分担（Clojure / JS）
- **Clojure（`src/vgm`）**: 収集・正規化・重複排除・難易度/知名度推定などの**データ処理中核**。長時間・並列・再処理向き。  
- **JS（Actions/スクリプト/フロント）**: **オーケストレーション**（CI/PR/配信）、可視化、Webアプリ。

両者は **JSONL/JSON 契約**で接続する。例：`public/app/daily_candidates*.jsonl`、`public/app/daily_auto.json`。

### JSONL 契約（候補）
```json
{
  "provider": "apple",
  "id": "1550828100",
  "title": "Corridors of Time",
  "game": "Chrono Trigger",
  "answers": { "canonical": "Corridors of Time" },
  "provenance": {
    "source": "itunes-lookup",
    "collected_at": "2025-09-07T00:00:00Z",
    "hash": "sha1:...",
    "license_hint": "official"
  }
}
```

### スケーラビリティ指針
- **年別分割**: `public/app/by_year/YYYY.json` に分ける
- **未来地平線**: 先取りは最大90日、超過分は Pool に留める
- **PR粒度**: 30–90日/PR でレビュー可能性を確保

### 人手ドア（Human-in-the-loop）
- **Gate** で信頼度 θ 未満は PR 承認（自動マージ禁止ラベルで制御）。
- しきい値やミックスは Repo Variables で切り替え可能にする（`WITH_CHOICES`, `STRICT_GUARD`, `AUTO_GATE_THRESHOLD` など）。

## 既存 Clojure コードの位置づけ
- `src/vgm/*.clj[cs]` の処理は **ingest / aliases / export / stats** 等に対応。  
  これらを上図の **Harvest/Normalize/De-dup/Score** に段階的に寄せていく。

## 失敗時のリカバリ
- いつでも **停止できるスイッチ**（Repo Variables / Workflow inputs）。
- **ロールバック**：PR単位/日付単位で `by_date` を戻す手順を定義。

(以降、既存記述)

## Data -> App -> Pages
1. **Data Build (Clojure)** → `public/build/dataset.json`
2. **Node Scripts** → `public/app/daily.json`, `public/app/daily_auto.json`, `/public/daily/*.html`
3. **App (GitHub Pages)** → `/public/app/` を配信、`?daily=...` で表示
4. **SW 更新検知** → `public/app/version.json` でハンドシェイク（~60s）

## Pipelines
- **daily.json generator (JST)**: daily.json と /daily HTML を更新
- **daily (auto …)**: daily_auto.json を更新（HTML には触れない）

## E2E / Monitoring
- smoke テスト（/daily + latest / AUTO バッジ）
- Lighthouse Budgets（warn）
