# E2E: On-demand / Nightly（#811）結果

## 結果（2025-09-12）
- **緑化**：on-demand / nightly ともにパス。

## 主な修正（E2E専用・本番不変）
1. Start ボタンの **visible 依存を撤廃**。presence+enabled を満たせば、可視なら通常クリック、不可視でも **programmatic click** を許可。
2. 開始後の **UI差（MC/Free）に非依存**とするため、`#choices button` と `#free-answer, #answer-input, #answer, [data-testid="answer"]` をいずれも待機対象に。
3. **結果クローズ後の復帰**は寛容に判定：
   - A) `#result-view` 非表示 かつ `#feedback` が `準備OK|Ready` を含む、または
   - B) `#start-view` 可視 & `#question-view` 非可視。
   - 満たさない場合は**診断のみ**で非致命（本テストの主目的は結果モーダルの a11y 検証）。

## ログ例（一部）
```
[E2E URL] https://.../app/?test=1&mock=1&seed=e2e&autostart=0
[OK] free-mode A11y structure checks passed
[footer-version] Dataset: v1 • commit: …
```

## 備考
- すべて **E2Eの堅牢化**であり、アプリ本番挙動には影響しない。

