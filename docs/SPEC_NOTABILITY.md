# SPEC: Notability（知名度スコア）

## 目的
“誰も当てられない”状態を回避するため、**難易度**とは独立に **知名度**を導入し、出題ミックスを制御する。

## 既定パラメータ（v1.10 初期値）
- **帯域（High/Med/Low）比率**: **75% / 20% / 5%**（Explore枠は Low に含む）
- **正規化**: 供給元のバイアスを係数で補正した上で min-max（0–1）
- **閾値**: 例）High ≥ 0.67、Med ≥ 0.33、Low < 0.33（導入時は観測分布で再調整）

## 特徴量の例
- Apple側の人気度/ランキング（公開API域）
- YouTube公式の再生/公開年/チャンネル種別（のちにAPI導入）
- 別名（aliases）の豊富さ/一致頻度
- 既知の名曲リストとの一致（ホワイトリストやコミュニティ投票）

## スコアリング
- 0–1 の連続値、あるいは High/Med/Low の3帯にビニング
- スケールは単純比較可能になるよう min-max 正規化（提供元ごとのバイアスは係数で補正）

## 出題ミックスの例（デフォルト）
- High: 70–80%（メジャー層）
- Med: 15–25%
- Low: 5–10%（Explore枠、連続しないよう制御）

## Gate（自動採用のしきい値 θ）

### 目的
Discovery/Harvest で得た候補のうち、**十分に信頼できるものだけを自動採用**し、それ以外は **PR 承認**へ回す。

### スコア式（初期案）
- `score = 0.5 * notability + 0.3 * provider_trust + 0.2 * guard_score`
  - `notability`：本ドキュ上部の 0–1 値（High/Med/Low を内包）
  - `provider_trust`：供給元の信頼係数（下表）
  - `guard_score`：メタ完備性・重複危険度からの減点後スコア（下表）

#### Provider trust（初期係数）
| provider | 種別 | trust |
|---|---|---|
| apple | iTunes Preview / Music API | 1.00 |
| youtube | 公式チャンネル（将来導入） | 0.85 |
| youtube | ユーザー投稿（将来導入） | 0.35 |
| stub | なし | 0.10 |

#### Guard（減点の目安）
| 条件 | 影響 |
|---|---|
| provenance 欠落（6項目のいずれか） | `guard_score = 0` |
| license_hint=unknown | `guard_score *= 0.5` |
| composer 欠落 | `guard_score *= 0.8` |
| de-dup θ ≥ 0.85（近似重複が強い） | `guard_score *= 0.5` |
| de-dup θ ≥ 0.95 | `guard_score = 0` |

> `guard_score` は初期値 1.0 からの乗算。未該当なら 1.0 のまま。

### しきい値（θ）と動作
- 既定（初期値）: **θ = 0.72**  
  - `score ≥ θ` → **自動採用**（Pool へ直接追加）
  - `0.50 ≤ score < θ` → **PR 承認キュー**へ（人間レビュー）
  - `score < 0.50` → **reject**（ログのみ）
- しきい値は **Workflow inputs** または **Repo Variables** で切替可能（未設定ならログのみ）。

### 運用（概要）
- Discovery は **dry-run** で `score` を出すだけ（書き込まない）。
- Harvest/Gate 段では `θ` を入力で受け取り、**Summary に `auto_accept_rate` / `pr_queue_size`** を表示。
- 将来：PR は自動ラベル `queue:collector` を付与。

## 運用
- Repo Variables や Workflow inputs で帯域比率を調節可能にする
- KPI: 直近30日の正答率分布が目標帯（60–85%）に収まるかをモニタ
