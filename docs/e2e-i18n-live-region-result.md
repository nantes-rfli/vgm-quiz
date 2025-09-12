# E2E: i18n live region（#809）最終結果

## 結果（2025-09-12）
- **緑化**（JA/EN）。CIログ確認済み。
- 目的（DoD）：**初期live region 非空（準備OK/Ready）** と **結果ダイアログ到達** を両立。

## 反映内容（テスト専用・本番挙動は不変）
1. **前進ループ**で結果まで到達（複数問でもOK）。
2. **結果アナウンス**は言語揺れを許容：`結果/スコア/正解/不正解/集計/合計/Correct/Incorrect/Result/Score`。
3. **リセット確認**は非致命（Escape/クローズ試行→診断ログ出力）。
4. **URL `mode=mc` 受理**（`multiple-choice` へ正規化）。

## 参考ログ（一部）
```
[APP:log] features {mode: MC, timer: off}
[APP:info] [DATASET] ready (tracks=%s) 10
[E2E] step=answered-0 ... / next-4 ...
[E2E] reset (nonfatal) status { dlgVisible: true, startVisible: false, questionVisible: false, feedback: 'Incorrect. Correct: 光田康典' }
```

## 備考
- `?mock=1` 下では 1問化に依存しない設計（前進ループ）で安定化。
- 必要になれば test/mock 限定の 1問化（ID優先）を別途導入可能。
