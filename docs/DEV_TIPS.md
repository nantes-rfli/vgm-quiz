# E2E: Start ボタンが有効にならない場合の切り分け（v1.12）

症状: `e2e/test_i18n_a11y_live_region_smoke.mjs` が `start-btn` のクリックで 30s タイムアウト。

原因: 本番では `requestIdleCallback` でデータセットを遅延ロードしているため、E2E/検証でも待ち続けて Start が `disabled` のままになることがある。

対処（アプリ側・最小差分）: `public/app/app.js` にて、**`?test=1` または `?mock=1` の場合は即時 `loadDataset()`** する（本番は従来どおり idle）。

---

## 目視チェック（DevTools コンソール）

以下を貼り付けて返り値を確認する。

```js
new URL(location).searchParams.toString();               // -> 'test=1&mock=1&...'
document.querySelector('#feedback')?.textContent?.trim(); // -> '準備OK...' (ja) / 'Ready...' (en)
document.querySelector('#start-btn')?.disabled;           // -> false が期待値
performance.getEntriesByType('resource')
  .map(e => e.name)
  .filter(n => /mock|dataset/i.test(n));                  // -> mock/dataset.json が含まれる
document.documentElement.lang;                            // -> 'ja' / 'en'
```

## 実装ポリシー

- 本番挙動（ユーザー体験）は不変。E2E/検証モードでのみ即時ロードする。
- Start の有効化は `datasetLoaded` を真にしてから `updateStartButton()` を呼ぶ従来経路を維持する。

---

# 既存の開発メモ

## Service Worker のキャッシュを無効化して確認したい
1. DevTools → Application → Service Workers → **Unregister**。
2. ハードリロード（Cmd+Shift+R）。
3. それでも古い場合は `?v=TIMESTAMP` を付けて再読込。

## E2E Footer が赤のとき
- Artifacts: `e2e/screenshots/footer.png` / `footer.html` を確認。
- SW のキャッシュ影響が疑わしい場合は上記手順で解除。
- バージョン文字列の形式: `Dataset: <ds> • commit: <abcdef0|local> [• updated: YYYY-MM-DD HH:MM]`。
