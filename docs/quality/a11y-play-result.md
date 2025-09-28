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
| `/play` タイマー読み上げ | ✅ | `role="timer"` + `aria-live="polite"` とスクリーンリーダ向けの非表示テキストを追加。5秒以下で色のみでなく音声でも警告可能。
| `/result` レイアウト | ✅ | ScoreBadge を `<dl>` 化して数値とラベルを関連付け。詳細側も `<dl>` で Started/Finished などを表現。 |
| Reveal リンク | ✅ | ボタンでなく `<a>`、`target="_blank" rel="noopener noreferrer"`。VoiceOver で “Open in {provider}” と読上げ。 |
| 結果サマリ数値 | ✅ | Score / Correct / Wrong / Unanswered を <dt>/<dd> で構造化し、`aria-label` で補足情報を提供。 |

## 3. Automated Report (axe)
- コマンド: `npm run test:a11y`
- 結果: 0 violations / 0 incomplete
- PA11Y 手動実行もサンプル確認済み (`npx pa11y http://localhost:3000/play`) — 既知の Next.js デフォルト HTML（title/lang）は本番 build では解消されるため除外。

## 4. Outstanding Todo / 提案
1. **タイマーの通知頻度最適化**: 長時間のセッションでは 1 秒ごとのアナウンスが煩雑な可能性があるため、必要に応じて節度調整（例: 5秒未満で通知）を検討。
2. **Result カードの詳細読み上げ**: 問題単位のカードに `<dl>` を追加済みだが、よりリッチな説明（例: 正解／選択肢をまとめた aria-describedby）を今後検証する余地がある。

## 5. 結論
DoD を満たす障害は検出されず、主要操作はキーボード/スクリーンリーダーで完走可能。上記の改善候補は次フェーズのエンハンスとして継続検討。
