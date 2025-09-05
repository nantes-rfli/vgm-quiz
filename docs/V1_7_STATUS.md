# v1.7 Authoring Automation — STATUS (MVP)

## What’s delivered
- **Docs/Schema/Validator** 基盤
- **authoring (validate)**: 検証＆Artifactのみ（リポは汚さない）
- **clip-start heuristics v1**（ルールベース/キーワード＋プロバイダ既定）
- **distractors v1**（ポストプロセス/同作曲者・シリーズ優先）
- **difficulty v1**（ポストプロセス/0..1）
- **authoring (heuristics smoke)**: heuristics→generate→distractors→difficulty→validate を手動で検証
- **daily (auto extended)**: PAT で PR 作成＋必須チェック起動＋Auto-merge（squash）有効化
- **daily quality report**: PR に品質サマリーを自動コメント

## Operability
1. まず `authoring (validate)` で安全確認（Artifactsを目視）  
2. 公開したい日は `daily (auto extended)` を手動実行  
   - date省略＝JST今日 / heuristics, choices, difficulty は既定でON  
   - PRは自動で **Auto-merge enabled** 状態に（必須チェック通過で自動マージ）  
3. PRに **Quality Report** コメントが付与されるので最終確認に利用

## Notes
- PR作成には必ず **`DAILY_PR_PAT`** を使用（`GITHUB_TOKEN`は下流Workflowを起動しない）
- by_date 形状の差（配列/オブジェクト）に対する堅牢化済み（distractors/difficulty）
- 生成は **埋め込み再生のみ**（YouTube/Apple）方針を堅持

## Next
- allowlist/seed の拡充（公式ソースの追加）
- heuristics v2（チャプタ/音響メタの活用）、distractors v2（多様性ペナルティ）
- 難易度の分布を監視しフィードバック（ターゲット帯に寄せる）

