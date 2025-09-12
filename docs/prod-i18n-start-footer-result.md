# 本番: 初期i18n遅延とフッター空表示の解消（結果）

## 結果（2025-09-12）
- ハードリロード後 **1〜2秒で Start 押下可能**、主要ラベルも同時期に日本語化。
- フッターは **常時表示**（`Dataset • commit • updated`、フェイルセーフあり）。

## 原因（事実）
- DevTools 計測で **i18n-boot / i18n** 周辺の *Microtasks* がメインスレッドを占有し、+  **Start の `disabled` 解除・ラベル適用・フッター更新**が同じ解禁トリガーに束ねられて遅延。

## 対処（最小差分・仕様不変）
1. **Start 解禁を i18n と分離**：`playable≥1` 到達時点で `#start-btn` の `disabled` を即解除（`aria-disabled=false`）。+   仕様（Start ガード）は維持。
2. **i18n MutationObserver を rAF デバウンス**：1フレーム1回＋再入防止で過剰適用を抑止。
3. **フッターの常時 populate**：`build/version.json` / `build/dataset.json` から生成（失敗時は固定文言）。

## 確認観点（回帰チェック）
- `[PLAYABLE] count=` → `[DATASET] ready` → Start 押下可能までが **~1–2s** で収束。
- `Performance` の「JavaScriptとイベント」における i18n 帯が **短時間で収束**。
- E2E は **緑維持**（テスト専用の堅牢化ロジックに変更なし）。

