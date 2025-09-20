# Issues Automation (Project-wide, Developer Guide)

この仕組みは **vgm-quiz 全体**（FE/BE/API/DATA/DOCS/OPS）で使えます。  
PR本文の `issuespec-json` から Issues を自動作成/更新し、`docs/issues/*.md` に同期します。

## 使い方（最短）
1. このパックをリポに追加（`.github/...` と `docs/issues/`）
2. GitHub → Settings → Actions → Workflow permissions: **Read and write**
3. PR本文末尾に `issuespec-json` を貼る → PRにラベル **`create-issues`**
4. 自動で Issue 作成/更新 → PRに対応表コメント → `docs/issues/*.md` に同期

## ラベル方針（自動作成）
- **type:** `task` / `bug` / `spike` / `chore`
- **area:** `fe` / `be` / `api` / `data` / `docs` / `ops`
- **priority:** `P0` / `P1` / `P2`
- **size:** `S` / `M` / `L`
- **key:** `key:<任意キー>`（重複防止の主鍵）

## Projects（任意）
`"project": "プロジェクト名"` を入れると、存在する **Projects v2** に自動追加します。

> この文書は開発者向け運用ガイドのため、**docs/dev/automation/** 配下に配置しています。

### 付録
- サンプル: `docs/dev/automation/examples/issuespec-mvp-sample.json`
