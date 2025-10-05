# Accessibility Audit — /play & /result

## Audit History

### Phase 3 Audit (2025-09-28)
- Auditor: Codex (automation + manual walk-through)
- Pages: `/play`, `/result`
- Tools: Playwright + axe-core (automated smoke), keyboard-only navigation, VoiceOver quick nav (spot check)

#### Coverage & Method
- **Keyboard**: Start → answer → reveal → next → finish → resultまでキー操作（Tab / Shift+Tab / Enter / Space / Arrow/Number）で確認。
- **Axe**: `npm run test:a11y` で主要2ページに対する WCAG 2.1 AA チェックを自動化。
- **Screen reader spot check**: VoiceOver (macOS) で見出し・ボタン・トグル名称の読み上げを確認。

#### Findings
| 項目 | 状態 | メモ |
| --- | --- | --- |
| `/play` ロード時のフォーカス | ✅ | Start ボタン → Question 選択 → Reveal → Nextの順にトラップなしで移動可能。矢印/数字ショートカットも動作。 |
| Inline playback トグル | ✅ | `aria-pressed`, 明示ラベル, Storage への永続化を確認。 |
| カラーコントラスト | ✅ | スコアバッジ／タイマーの配色を修正（bg-emerald-700/rose-700/gray-900等）→ Axe で Violation 0。 |
| `/play` タイマー読み上げ | ✅ | `role="timer"` + `aria-live="polite"` とスクリーンリーダ向けの非表示テキストを追加。5秒以下で色のみでなく音声でも警告可能。
| `/result` レイアウト | ✅ | ScoreBadge を `<dl>` 化して数値とラベルを関連付け。詳細側も `<dl>` で Started/Finished などを表現。 |
| Reveal リンク | ✅ | ボタンでなく `<a>`、`target="_blank" rel="noopener noreferrer"`。VoiceOver で "Open in {provider}" と読上げ。 |
| 結果サマリ数値 | ✅ | Score / Correct / Wrong / Unanswered を <dt>/<dd> で構造化し、`aria-label` で補足情報を提供。 |

### Phase 4 強化対応 (2025-10-05)
- Issue: [#74](https://github.com/nantes-rfli/vgm-quiz/issues/74)
- フォーカス: タイマー読み上げの最適化 + Result ページのセマンティック構造改善

#### 実装内容

##### 1. タイマー読み上げ最適化 (Timer.tsx)
- **変更前**: カウントダウン中、毎秒 `aria-live="polite"` でアナウンス
- **変更後**:
  - 残り5秒以下の場合のみ `aria-live="assertive"` でアナウンス
  - 5秒超の場合は `aria-live="off"` に設定し、過度な読み上げを抑制
  - プログレスバーに `role="progressbar"` と `aria-valuemin/max/now` を追加
  - アナウンス専用の独立した live region div を分離
- **効果**: スクリーンリーダーの冗長性を削減しつつ、緊急時の警告は維持

##### 2. Result ページのセマンティック構造改善 (result/page.tsx)
- **問題カード**: Outcome/残り時間/獲得ポイントの表示を `<dl>` 構造で明示
  - "Outcome"、"Time remaining"、"Points earned" に視覚的に隠された `<dt>` ラベルを追加
  - あなたの回答/正解を `<dl>` 構造に変換し、視認可能な `<dt>` ラベルを付与
- **Reveal メタデータ**: 作品/曲名/作曲者の表示改善
  - `<dl>` 構造に変換し、`flex gap-2` レイアウトを適用
  - 視認可能な `<dt>` ラベルを muted スタイルで追加
- **ダークモード対応**: `text-foreground`、`text-muted-foreground`、`border-border` などのテーマトークンを使用し、一貫性を向上

##### 3. 国際化対応
- `play.seconds` 翻訳キーを追加（英語: "seconds"、日本語: "秒"）
- タイマー読み上げの適切な複数形対応とローカライゼーションを実現

#### 自動テスト結果
```bash
npm run test:a11y
# 結果: 2 passed (25.2s)
# - play ページ: WCAG AA 違反 0件
# - result ページ: WCAG AA 違反 0件
```

#### 今後の改善提案
1. **タイマー aria-live の制御**: 現在は "assertive" と "off" を切り替える実装。`aria-atomic="true"` をlive region に追加することで、完全なアナウンスを保証することを検討。
2. **問題カードの aria-describedby**: 各問題カードに outcome/スコア/時間を統合した aria-describedby を追加することで、スクリーンリーダーの包括的なコンテキスト提供が可能。

## 現在の状態
Phase 3 および Phase 4 のアクセシビリティ要件をすべて満たしています。WCAG AA 違反は検出されず、`/play` および `/result` フローにおけるキーボードおよびスクリーンリーダーのナビゲーションは完全に機能しています。
