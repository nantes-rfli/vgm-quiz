# SPEC_NOTABILITY_v1 — Notability v1（v1.10）

## 目的
Pick/配信での“目立つ/埋もれる”の偏りを抑えるため、候補に **notability.score (0..1)** と **band** を付与する。

## 指標（v1最小）
- **official**: Apple 公式音源の存在（`media.apple.*` があれば 1、なければ 0）
- **alias_norm**: 受理解（`answers.acceptables` 等）の件数を 5 で正規化（`min(1, count/5)`）
- **provider_signal**: 媒体の強さ（`apple:1.0 / youtube:0.6 / null:0.2 / other:0.4`）

## スコア
`score = 0.5*official + 0.3*alias_norm + 0.2*provider_signal`  
スコアは `[0,1]` にクランプ。

## バンド
- **high**: `score >= 0.67`
- **low**:  `score <= 0.33`
- **med**: 上記以外

## 出力形
各候補オブジェクトに以下を付加：
```json
{
  "meta": {
    "notability": { "score": 0.74, "band": "high" }
  }
}
```

## KPI（Step Summary）
- `bands: high, med, low` の件数と比率

## 備考
- v1 は **外部Popularityを参照しない**。Appleの有無を official として扱う。
- 今後、Popularityやシリーズ知名度等の特徴量を追加予定（v1.12+）。

