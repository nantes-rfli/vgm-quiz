# 運用 Runbook（vgm-quiz）

## 1) SW 更新確認（更新バナーを出す手順）
仕様：**新SWが `waiting` になった時だけ**更新バナーを表示します。
手順：
1. `public/app/sw.js` にコメント1行追加 → push（Pages配信）
2. 既存タブでコンソール実行：
   ```js
   navigator.serviceWorker.getRegistration().then(r => r && r.update())
   ```
3. バナー表示→「更新」をクリック（リロード）

## 2) Required チェックが「待機」のまま
- ルールセット上の Required 名：`pages-pr-build` / `ci-fast-pr-build`
- PRブランチに該当のYAMLが未反映の場合：**Update branch** または 空コミット
- `github-actions[bot]` が PR author → **DAILY_PR_PAT** 未設定 or 期限切れの可能性

## 3) DAILY_PR_PAT 期限切れの兆候
- Daily PR の author が `github-actions[bot]`
- Checks が走らない／保留が解けない
対処：
1. PAT 設定を再確認（権限：`repo`、期限）
2. Actions Secrets の値を更新
3. 次回スケジュール or 手動トリガで再検証

## 4) /daily の生成物
- `scripts/generate_daily.js`：JST・FNV1a・直近30日重複回避 → `public/app/daily.json`
- `scripts/generate_daily_index.js` → `/daily/index.html`
- `scripts/generate_daily_feed.js` → `/daily/feed.xml`
- `/daily/latest.html` は当日へのリダイレクト
- Pages 配信直前にも **保険**として index / feed を再生成（`pages.yml`）

## 5) JSON バリデータ（手動実行）
Actions → **json-validate** → **Run workflow**  
成功時：Run Summary に「✅ JSON validate passed」  
失敗時：ログに重複・衝突の詳細（aliases正規化キー／dataset正規化一致）

## 6) Pages が反映されない
- `pages.yml` の配信パス：`public/` を確認
- Actions → Pages → **Run workflow**（手動再配信）

## 7) E2E が不安定
- SW キャッシュの影響 or UI変更
- `?test=1&mock=1&seed=...&nomedia=1` のフォールバックで緩和済み

## 8) よく使うコマンド
```bash
clojure -T:build publish   # build/ を生成
clojure -M:test            # テスト
node scripts/generate_daily_index.js
node scripts/generate_daily_feed.js
```

