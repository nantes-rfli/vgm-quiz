# Issues Automation (Project-wide)

この仕組みは **vgm-quiz 全体**（FE/BE/API/DATA/DOCS/OPS）で使えるように汎用化しています。  
PR本文の `issuespec-json` から Issues を自動作成/更新し、`docs/issues/*.md` に同期します。

## 使い方（最短）
1. このパックをリポに追加（`.github/...` と `docs/issues/`）
2. GitHub → Settings → Actions → Workflow permissions: **Read and write**
3. PR本文末尾に `issuespec-json` を貼る → PRにラベル **`create-issues`**
4. 自動で Issue 作成/更新 → PRに対応表コメント → `docs/issues/*.md` に同期

## ラベル方針（用意済み）
- **type:** `task` / `bug` / `spike` / `chore`
- **area:** `fe` / `be` / `api` / `data` / `docs` / `ops`
- **priority:** `P0` / `P1` / `P2`
- **size:** `S` / `M` / `L`
- **key:** `key:<任意キー>`（**重複防止の主鍵**。例: `key:FE-01`）

> `issuespec-json` 内に指定されたラベルは、存在しなければ**自動で作成**されます。

## Projects（任意）
`"project": "プロジェクト名"` を入れると存在する **Projects v2** に自動追加します。  
GUIのAuto-addでも代用可。

## 同期先
- `docs/issues/*.md`（front-matter + 本文）  
Issueがローカルで確認できます。
