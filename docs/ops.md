# Ops / Runbook

日々の運用で迷いやすいポイントを集約します。**まず困ったらここを見る**、を目指します。

## 目次
- SW更新確認フロー（waiting→更新バナー）
- Required ジョブ名の注意・Checks が待機のままの対処
- DAILY_PR_PAT の期限切れ兆候と対処
- Actions からの手動実行（json-validate / Pages / e2e）
- /daily の JS リダイレクトとデバッグ
- よくある落とし穴（YAML / Shell 展開 / daily_auto）

---

## Actions 手動実行のコツ

- **Pages**: `pages.yml` を Run → OGPや `/daily/index.html` の再生成も含む
- **json-validate**: `dataset.json` / `aliases*.json` / `daily.json` を軽量チェック
- **e2e (light regressions)**: キーボード操作／Share CTA の軽量回帰
  - `date`: 生成済みの日付（例: `2025-09-01`）を入れると安定
  - `app_url` / `share_base`: 空欄でOK（既定は本番URL）
  - 失敗時はアーティファクト（`kb_flow_failure.*` / `share_cta*.html`）を参照

## /daily の JS リダイレクトとデバッグ

- **シェアページ**: `public/daily/YYYY-MM-DD.html` は **JS リダイレクト**で `/app/?daily=YYYY-MM-DD` へ遷移
- **デバッグクエリ**:
  - `?no-redirect=1` → 自動遷移を抑止し、ページ内の導線（「AUTOで遊ぶ」など）を目視確認
  - `?redirectDelayMs=1500` → 遷移まで 1.5 秒間の余裕を作る
- **latest**: `/daily/latest.html` でも上記クエリ使用可。実装は相対リンクやテキスト日付での誘導でもOK

## よくある落とし穴（YAML / Shell / daily_auto）

### GitHub Actions YAML
- **ハイフン入りの outputs**（例: `pull-request-number`）は **ブラケット記法で参照**:  
  `steps.cpr.outputs['pull-request-number']`  
  ドット記法は NG（syntax error / 実行時エラーの原因）。
- `if:` の式で空 evaluates を避けるため、`||` でフォールバックを入れると安全。

### Shell / Node
- `node -e "…${{ … }}…"` のような **シェル展開**は、引用ミスで壊れやすい。  
  → 可能なら **Here-Doc** で渡すか、**`node - <<'JS' … JS`** 形式を推奨。

### daily_auto（AUTOモード）
- `daily_auto.json` に **差分が無いと** PRは作られない（正常挙動）。
- `?auto=1` は **choices の有無と独立**：ファイルが読めれば**右上バッジに AUTO**が出る。
- **適用されない時**の確認順:
  1. URLに `?auto=1` が付いているか
  2. 対象曲の **正規化一致**を満たしているか（検証時は `?auto_any=1` を併用）

## Required / Checks が待機のまま

- Rulesets 側で **Required 名**（`pages-pr-build` / `ci-fast-pr-build`）とジョブ名が一致しているかを確認。  
  ジョブ名を変更した場合、Rulesetsも併せて更新が必要です。

## Docs 整合性 / Roadmap ガード

- **docs-enforcer**: コード変更があるPRで **ドキュメント差分**（`README` / `docs/**` / `FEATURES.*` / `ROADMAP` / `CHANGELOG`）が無いと **fail**。  
  例外は **`docs:skip`** ラベルで明示。
- **roadmap-guard（非ブロッキング）**: `docs/FEATURES.yml` の **planned** が `docs/ROADMAP.md` に見当たらない場合、**警告コメント**をPRに付与。  
  正本は **FEATURES.yml**。Roadmapは**背景/順序の説明**として整合させる。

## トラブルシューティング

- **Share が真っ白→即遷移して見えない**: `?no-redirect=1` で抑止、`?redirectDelayMs=1500` で観察時間を確保。
- **latest.html の導線がテストで落ちる**: 実装が相対リンク・テキスト誘導の場合あり。テストは緩和済（相対/テキストも許容）。
- **Playwright が見つからない**: `e2e-light-regressions.yml` は Playwright をインストールするステップ込。個別実行時は `npm i playwright && npx playwright install chromium` を確認。


## Pages デプロイの確認（詳細）

1. **Pages ワークフロー**が `main` への push（または CI Fast の `workflow_run`）で起動し、成功していることを確認。
2. **CIメタデータ** の sanity check：
   - `public/build/version.json`（`dataset_version`, `commit`(short_sha), `generated_at`）
   - SW ハンドシェイクを確認するには、`/app/../build/version.json` も同値で取れることを確認
   - `/build.json?ts=NOW` および `/app/build.json?ts=NOW` が 200 で返ること
3. **フッターの表記** が最新であること：  
   `Dataset: vN • commit: abcdefg • updated: YYYY-MM-DD HH:mm`

> Quick links（本番。`NOW` はキャッシュバスター置換）  
> - `/build/version.json` / `/app/../build/version.json`  
> - `/build.json?ts=NOW` / `/app/build.json?ts=NOW`
