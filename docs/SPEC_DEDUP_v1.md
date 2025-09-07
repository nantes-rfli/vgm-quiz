# SPEC: De-dup v1（近似重複の抑制）

## 目的
自動収集の前に、**同曲/別表記/軽微な差**による重複を抑える。

## 正規化
- 小文字化、空白圧縮、CJK間スペース除去、長音/波ダッシュ統一、ローマ数字分離、記号類の標準化
- `normalize_core.mjs` をベースに、Clojure側でも同等関数を実装（言語差異はテストで担保）

## 類似度
- 見出し語トークン化＋N-gram（3-gram推奨）
- Jaccard / Cosine を簡易に用いる（閾値は0.8前後から調整）
- “同曲別アレンジ”の抑制: `suspicious-title` ワード（cover/remix/extended/...）を減点

## ハッシュ（将来）
- pHash/SimHash の導入を検討（まずはメタデータ起因の一意性から）

## 判定
- 完全重複: provider|id が同一 → 即排除
- 近似重複: 類似度≥θ1 かつ suspicious減点後でも類似度≥θ2 → 排除

## 記録
- 重複除外は **Step Summary に件数/サンプル** を出力
- 除外理由: `dup-exact`, `dup-similar`, `arrangement-variant` 等

## テスト
- 代表曲の別表記セットでゴールデンテストを作成し、CIで閾値劣化を検出
