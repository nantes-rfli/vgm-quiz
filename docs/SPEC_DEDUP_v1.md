# SPEC: De-dup v1（近似重複の抑制）

## 目的
自動収集の前に、**同曲/別表記/軽微な差**による重複を抑える。

## 既定パラメータ（v1.10 初期値）
- **N-gram**: 3-gram（タイトル・ゲーム・作曲者の見出し語を統一正規化後にトークン化）
- **類似度閾値**: `θ_main = 0.80`（初期値）  
  - **strictモード**（リスクが高いとき）: `θ_strict = 0.82`
- **減点語（suspicious-title）**: cover / remix / extended / arrange / ost mix / long ver. / karaoke / bgm edit …（適用時は類似度を 0.02 減衰）
- **完全重複**: `provider|id` 一致は即除外

> 調整方針: ゴールデン10件の回帰テストを**必ず**実施し、`θ_main` は 0.78–0.82 の範囲で最適化する。
> Step Summary には `examined/dup-exact/dup-similar` を必須出力。

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

## 正規化（v1.5 実装）
- Unicode 正規化: **NFKC**
- 小文字化、記号→空白に置換、連続空白の圧縮
- 結合対象: `title + game + composer` を半角スペースで連結

## 類似度（3-gram Dice）
- 文字列から**連続3文字の部分列**（3-gram）集合を作る
- **Dice 係数**: `sim = 2 * |A∩B| / (|A| + |B|)`
- **suspicious-title 減点**: either side が `cover/remix/extended/arrange/...` を含むと `sim -= 0.02`

## しきい値
- 既定: `θ_main = 0.80`
- strict: `θ_strict = 0.82`
- 判定: `sim >= θ` を **近似重複**として除外（`provider|id` 完全一致は即除外）

## Step Summary 出力（必須）
- `examined`（入力件数）
- `dup-exact`（完全重複）
- `dup-similar`（近似重複）
- `samples`（最大5組: titleA ↔ titleB, sim）
