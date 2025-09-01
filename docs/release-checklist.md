# Release Checklist

- [ ] PR の説明に実行ワークフロー（例: daily.json generator / e2e / lighthouse）と確認 URL を記載
- [ ] 必要に応じて `daily.json generator (JST)` を手動実行（/daily HTML 更新）
- [ ] フッター右の **Dataset / commit / updated** を確認
- [ ] `/daily/YYYY-MM-DD.html?no-redirect=1` が動作するか確認
- [ ] **e2e (daily share & latest smoke)** / **e2e (auto badge smoke)** が緑
- [ ] **lighthouse (budgets, nightly)** の warn をチェック（大きな退行が無いか）
