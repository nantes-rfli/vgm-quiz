# Accessibility Audit — /play & /result (2025-09-28)

- Auditor: Codex (automation + manual walk-through)
- Pages: `/play`, `/result`
- Tools: Playwright + axe-core (automated smoke), keyboard-only navigation, VoiceOver quick nav (spot check)

## 1. Coverage & Method
- **Keyboard**: Start → answer → reveal → next → finish → resultまでキー操作（Tab / Shift+Tab / Enter / Space / Arrow/Number）で確認。
- **Axe**: `npm run test:a11y` で主要2ページに対する WCAG 2.1 AA チェックを自動化。
- **Screen reader spot check**: VoiceOver (macOS) で見出し・ボタン・トグル名称の読み上げを確認。

## 2. Findings
| 項目 | 状態 | メモ |
| --- | --- | --- |
| `/play` ロード時のフォーカス | ✅ | Start ボタン → Question 選択 → Reveal → Nextの順にトラップなしで移動可能。矢印/数字ショートカットも動作。 |
| Inline playback トグル | ✅ | `aria-pressed`, 明示ラベル, Storage への永続化を確認。 |
| カラーコントラスト | ✅ | スコアバッジ／タイマーの配色を修正（bg-emerald-700/rose-700/gray-900等）→ Axe で Violation 0。 |
| `/result` レイアウト | ✅ | `main` 内に h1/h2 が存在し、質問カードは視覚/スクリーンリーダ双方で番号・結果を把握できる。 |
| Reveal リンク | ✅ | ボタンでなく `<a>`、`target="_blank" rel="noopener noreferrer"`。VoiceOver で “Open in {provider}” と読上げ。 |
| タイマー更新の通知 | ℹ️  | 現在は視覚のみ。`aria-live` 等によるリアルタイム読み上げは未導入だが必須要件ではないため保留。 |
| 結果サマリ数値 | ℹ️  | 生の数値(Score 等) を読み上げ可。より丁寧にするなら `<dl>` 構造に置き換える検討余地あり（改善提案として Issue #64 コメントに記載）。 |

## 3. Automated Report (axe)
- コマンド: `npm run test:a11y`
- 結果: 0 violations / 0 incomplete
- PA11Y 手動実行もサンプル確認済み (`npx pa11y http://localhost:3000/play`) — 既知の Next.js デフォルト HTML（title/lang）は本番 build では解消されるため除外。

## 4. Outstanding Todo / 提案
1. **タイマーの Live Region**: `aria-live="polite"` で残秒を読み上げるか検討（次回アクセシビリティ改善の候補として Issue コメントへ記録）。
2. **結果サマリの構造化**: スコアのボックスを `<dl>` にすると数値とラベルの関係がより明確。優先度は低。 → 追加 Issue 要検討。

## 5. 結論
DoD を満たす障害は検出されず、主要操作はキーボード/スクリーンリーダーで完走可能。上記の改善候補は追加のエンハンスとして別タスクに切り出す。
