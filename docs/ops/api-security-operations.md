# API 安全運用メモ: レート制限・署名鍵ローテーション (Phase 3C)

**ステータス**: Phase 3C 初版（暫定手順）
**対象バージョン**: Phase 2B 以降
**最終更新**: 2025-11-16
**優先度**: P3（Phase 3D/4 での実装予定）

---

## 目的

ステートレス API（`/v1/rounds/start`, `/v1/rounds/next`）の安全な運用を確保するために、レート制限と JWS 署名鍵ローテーションの手順を明文化する。現段階では暫定手順であり、本番規模のトラフィックに応じて調整される。

---

## 現行の API セキュリティ体制

### Token 構造

- **フォーマット**: JWS (JSON Web Signature) with HMAC-SHA256
- **TTL**: 120 秒（デフォルト）
- **署名方式**: `HMAC-SHA256(header.payload, secret)`
- **検証**: Signature + Expiration チェック

**Token 例**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyaWQiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJpZHgiOjAsInRvdGFsIjoxMCwic2VlZCI6ImJhc2U2NHVybCIsImZpbHRlcnNIYXNoIjoiYWJjZGVmMDEiLCJmaWx0ZXJzS2V5Ijoie30iLCJ2ZXIiOjEsImlhdCI6MTczMDc0NzIwMCwiZXhwIjoxNzMwNzQ3MzIwfQ.signature_bytes_base64url
```

**署名鍵保存場所**
- **開発環境**: `workers/api/wrangler.toml` で `JWT_SECRET` にハードコード（プレースホルダ値）
- **本番環境**: Cloudflare Workers Secrets へ設定（環境変数 `JWT_SECRET`）

---

## レート制限（計画中 - Phase 3D/4）

### 現状

**実装状況**: なし。今後 Cloudflare Rate Limiting や Durable Objects で追加予定。

### 計画案

#### エンドポイント別の制限

| エンドポイント | 制限対象 | 制限値（案） | 理由 |
|--------------|--------|----------|------|
| `POST /v1/rounds/start` | clientId あたり | 1 req/sec | クイズ開始は連続呼び出しされないはず |
| `POST /v1/rounds/next` | token（roundId）あたり | 10 req/min | 回答提出の連続呼び出しを防止 |
| `POST /v1/metrics` | clientId あたり | 100 req/min | メトリクス送信のバッチ化を想定 |
| `GET /v1/manifest` | clientId あたり | 1 req/min | キャッシュがあるため頻繁なポール防止 |

#### 実装の流れ（仮）

1. **Phase 3D**: Cloudflare Rate Limiting API を使用した基本実装
2. **Phase 4A**: トラフィック観測データを元に数値最適化
3. **Phase 4B**: Durable Objects で分散レート制限状態管理（オプション）

#### 監視とアラート

- 制限超過時の応答: HTTP 429 Too Many Requests
- ログ: 制限超過イベントをメトリクス `rate_limit_exceeded` として記録
- アラート: 日次超過数 > 100 で Slack #vgm-ops に通知

---

## JWS 署名鍵ローテーション手順

### 概要

ステートレス API では、**署名鍵を変更すると既存の有効な token が検証失敗**になる可能性がある。したがって、「猶予期間を設けて段階的に新鍵へ移行」する手順が必要。

### ローテーション戦略

**デュアルキー方式**（推奨）：
1. **Phase 1**: 新鍵を `JWT_SECRET_NEW` として並行配置
2. **Phase 2**: API で新鍵・旧鍵の両方で検証を試みる
3. **Phase 3**: 猶予期間（24～48h）でフロントエンドが新 token を取得
4. **Phase 4**: 旧鍵を廃棄、新鍵を `JWT_SECRET` に昇格

**実装上の注意**: Cloudflare Workers では複数環境変数を持つ場合、以下のように対応：

```typescript
// workers/shared/lib/token.ts 修正例
export async function verifyJWSTokenDualKey(
  token: string,
  secretPrimary: string,
  secretSecondary?: string,
): Promise<Phase2TokenPayload | null> {
  // 新鍵で試す
  let payload = await verifyJWSToken(token, secretPrimary);

  // 新鍵失敗 + 旧鍵あれば、旧鍵で試す（猶予期間用）
  if (!payload && secretSecondary) {
    payload = await verifyJWSToken(token, secretSecondary);
  }

  return payload;
}
```

### ローテーション実施手順

#### 事前準備（本番対応の前日）

1. **新鍵生成**
   ```bash
   # 強力なランダム文字列を生成（64 文字以上推奨）
   openssl rand -hex 32
   # または
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   出力例: `a3f5e8c2b1d7f9a4c6e2b8d1f3a5e7c9b0d2f4a6c8e0b2d4f6a8c0e2b4d6f8`

2. **テスト実施**
   ```bash
   # ローカルで新旧鍵の両方でテスト
   cd workers
   JWT_SECRET="[新鍵]" JWT_SECRET_NEW="[新鍵]" npm run test
   ```

3. **検証環境でのテスト（任意）**
   - リポジトリの `wrangler.toml` には単一環境のみ定義されているため、デフォルトでは `wrangler secret put JWT_SECRET_NEW` → `wrangler deploy` でそのまま検証する。
   - チームで追加の Cloudflare Workers 環境（例: staging）を用意している場合のみ、`--env <environment>` を付与して同じ手順を実施する。

#### Phase 1: 新鍵を並行配置（猶予期間開始）

1. **Cloudflare ダッシュボードで新鍵を設定**
   ```bash
   wrangler secret put JWT_SECRET_NEW
   # プロンプトで新鍵の値を貼り付け
   ```

2. **API コードを dual-key 検証に更新**
   - `workers/api/src/routes/rounds.ts` の token 検証部分を修正
   - `verifyJWSTokenDualKey()` を使用（新鍵 → 旧鍵の順）

3. **ステージングで動作確認**
   ```bash
   npm run dev:api  # ローカルで dual-key 検証が機能することを確認
   ```

4. **本番にデプロイ**
   ```bash
   npm run deploy:api
   # ※ この時点で API は新旧両方の鍵で token を受け付ける
   ```

5. **フロントエンド側の新 token 取得確認**
   - Grafana で `/v1/rounds/start` レスポンスの token を監視
   - ※ ローテーション直後、既存 token は旧鍵でも有効なため、新 token は段階的に増える

#### Phase 2: 旧鍵を廃棄・新鍵を昇格（猶予期間終了）

**実施タイミング**: 新鍵導入後 24～48h

1. **旧鍵の利用率確認**
   ```sql
   -- Grafana/Loki で確認（イベントログから）
   count by (token_signed_with) (api_request_success)
   -- 旧鍵の割合が 5% 以下なら廃棄 OK
   ```

2. **API コードを新鍵単一キーに更新**
   - `verifyJWSToken()` で新鍵のみ使用するコードに戻す
   - 旧鍵検証ロジックを削除

3. **テスト**
   ```bash
   JWT_SECRET="[新鍵]" npm run test
   ```

4. **本番にデプロイ**
   ```bash
   npm run deploy:api
   # ※ この時点で新鍵のみが有効
   ```

5. **旧鍵削除**
   ```bash
   wrangler secret delete JWT_SECRET_NEW
   # ※ 念のため、24h 後に実施
   ```

#### Phase 3: 事後対応（トラブル時）

**シナリオ 1: 古い token がまだ多く使用されている場合**
- 猶予期間を延長（48h → 72h）
- フロントエンド側でキャッシュが古い token を返していないか確認

**シナリオ 2: 旧鍵廃棄後に検証エラーが急増**
- ロールバック: `JWT_SECRET` を旧鍵に戻す
- 原因調査: キャッシュされた古い token がまだ利用されていないか確認

### ローテーション時の監視メトリクス

| メトリクス | 監視対象 | アラート条件 |
|-----------|---------|-----------|
| `token_verification_failures` | 検証エラー数 | 日次 > 10 or 率 > 1% |
| `token_age_distribution` | Token の生成時刻 | 旧鍵の token 率 > 20% (猶予期間内), 0% (猶予期間後) |
| `api_request_latency` | API レスポンス時間 | p99 > 500ms（検証処理の遅延を検知） |

---

## 鍵管理のベストプラクティス

### 一般的な注意事項

1. **鍵の保管**
   - Cloudflare Workers Secrets で管理（環境変数経由）
   - ローカルファイルにハードコードしない
   - Git にコミットしない

2. **鍵の寿命**
   - 計画的なローテーション: 3～6 ヶ月ごと推奨
   - 緊急時: セキュリティ侵害疑いの場合は即座にローテーション

3. **ローテーション時の通知**
   - Slack #vgm-ops に「鍵ローテーション予定」を 1 日前に通知
   - ローテーション完了後、監視メトリクスのスクリーンショットを共有

4. **バックアップ/復旧**
   - ローテーション前に旧鍵のバックアップを Vault/Secret Manager に保管
   - 万一廃棄した旧鍵が必要になった場合に復旧可能に

---

## テストとシミュレーション

### ローカルテスト

1. **Dual-Key 検証のテスト**
   ```bash
   cd workers

   # 新旧両鍵でテスト
   JWT_SECRET_NEW="new-secret" JWT_SECRET="old-secret" npm run test -- token.spec.ts
   ```

2. **Token TTL テスト**
   ```bash
   # 120秒後の検証失敗を確認
   npm run test -- token.spec.ts -- --timeout 130000
   ```

### ステージング環境でのテスト

1. **ローテーション前シミュレーション**
   - ステージング環境で新鍵を導入
   - `/v1/rounds/start` → `/v1/rounds/next` フロー全体をテスト
   - Playwright E2E で token 更新フローを検証
   ```bash
   cd web
   npm run test:e2e -- --grep "token rotation"  # テスト名で filter
   ```

2. **メトリクス確認**
   - Grafana で token 検証成功率が 100% を維持しているか確認

---

## 関連ドキュメント・リソース

- [api/rounds-token-spec.md](../api/rounds-token-spec.md) - JWS token 仕様詳細
- [workers/shared/lib/token.ts](../../workers/shared/lib/token.ts) - Token 生成・検証実装
- [workers/api/src/routes/rounds.ts](../../workers/api/src/routes/rounds.ts) - Token 使用箇所
- [Cloudflare Workers Secrets 管理](https://developers.cloudflare.com/workers/platform/bindings/environment-variables/) - 環境変数管理ガイド
- [ops/observability.md](observability.md) - モニタリング・アラート設定

---

## 実装ロードマップ

### Phase 3C（現在）
- ✅ 鍵ローテーション手順書（このドキュメント）
- ✅ Dual-key 検証の設計

### Phase 3D
- [ ] Dual-key 検証コード実装・テスト
- [ ] ステージング環境でローテーション試行

### Phase 4A
- [ ] 本番環境での初回鍵ローテーション実施
- [ ] メトリクス監視・アラート設定
- [ ] 運用手順の改善

### Phase 4B (Optional)
- [ ] Cloudflare Rate Limiting API の統合
- [ ] レート制限メトリクスの集計・アラート

---

## トラブルシューティング

### よくある問題

**Q1: Token 検証エラーが突然増加した**
- A: 鍵の設定ミス（タイポ、不完全なコピー）を確認。Cloudflare dashboard で `JWT_SECRET` が正確か確認。

**Q2: ローテーション後、クライアント側が旧 token を返し続ける**
- A: localStorage キャッシュを確認。`vgm2.session.token` が残っていないか確認し、クライアント側で強制更新。

**Q3: Dual-key 検証の実装後、レスポンス遅延が増加**
- A: 暗号化計算量削減。新鍵での検証失敗時に旧鍵を試すため、新鍵を優先順位高く設定（実装時に注意）。

---

## 変更履歴

- **2025-11-16**: Phase 3C 初版作成（Issue #37）
  - レート制限の計画案を追加
  - JWS 署名鍵ローテーション手順を記載
  - テスト・監視メトリクスを定義
