# SPEC — choices_mode（出題の選択肢制御）

最終更新: 2025-09-05

## 目的
データの厚みに応じて **4択** と **1択** を自動で切り替え、体験の一貫性と安全性を両立する。

## 設定
`config/authoring.json`
```json
{
  "choices_mode": "auto" // "auto" | "always4" | "one"
}
```
- 既定は `auto`

## 動作
- `auto`：
  - 当日の distractor 候補が **品質ゲート**（異作品・異作曲者バランス、表記重複なし）を満たせば 4択
  - 未達なら **自動で1択** にフォールバック（理由をログへ出力）
- `always4`：ゲート未達でも 4択を強制（開発・検証向け）
- `one`：常に 1択

## 品質ゲート（例）
- 異なるシリーズ（または作品）から最低2件
- メイン/正解と **同一作曲者** の distractor は最大1件まで
- すべて `answers.canonical` がユニーク

## ログ
`[choices] mode=auto selected=one reason="insufficient unique distractors"`

## 導入手順
1. `choices_mode` の値を読み取る実装を追加（v1.8でフラグだけ先行導入）
2. v1.8.x 〜 v1.9 で `auto` の閾値を調整
3. データ・辞書の充実後、既定を `always4` に変更する判断を行う

## テスト観点
- データが薄い日：自動で 1択になること／ログ理由が明確
- データが十分な日：4択が生成され、表記重複や同一作曲者過密がない

## 既知の課題
- 表記ゆれ対策は正規化の充実（`docs/NORMALIZATION_RULES.md`）に依存
- 人気シリーズ偏重は Collector/Difficulty 改良（v1.9〜）で是正
