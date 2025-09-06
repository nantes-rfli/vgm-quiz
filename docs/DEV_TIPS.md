# DEV Tips

## Service Worker のキャッシュを無効化して確認したい
1. DevTools → Application → Service Workers → **Unregister**。
2. ハードリロード（Cmd+Shift+R）。
3. それでも古い場合は `?v=TIMESTAMP` を付けて再読込。

## E2E Footer が赤のとき
- Artifacts: `e2e/screenshots/footer.png` / `footer.html` を確認。
- SW のキャッシュ影響が疑わしい場合は上記手順で解除。
- バージョン文字列の形式: `Dataset: <ds> • commit: <abcdef0|local> [• updated: YYYY-MM-DD HH:MM]`。
