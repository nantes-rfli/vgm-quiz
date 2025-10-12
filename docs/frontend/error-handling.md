# Error Handling – Frontend Error Handling Strategy

**Status**: Implemented (Phase 3)
**Last Updated**: 2025-10-12

## 目的

ユーザー体験を向上させるため、API エラー、ネットワークエラー、オフライン状態を適切にハンドリングし、ユーザーにフレンドリーなフィードバックを提供する。

---

## アーキテクチャ

### 階層設計

```
┌─────────────────────────────────────────┐
│ UI Layer (Toast, ErrorBanner)          │
│  - ユーザーフレンドリーなメッセージ表示 │
│  - 再試行ボタン                          │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│ Error Mapping Layer (mapApiErrorToMessage) │
│  - ApiError → ユーザーメッセージ変換     │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│ API Error Layer (ApiError class)       │
│  - 型安全なエラー分類                    │
│  - リトライ可否の判定                    │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│ Network Layer (datasource.ts)          │
│  - 指数バックオフリトライ                │
│  - オフライン検出                        │
└─────────────────────────────────────────┘
```

---

## コンポーネント

### 1. ApiError クラス ([errors.ts:22-48](../../web/src/features/quiz/api/errors.ts#L22-L48))

**エラー種別** (`ApiErrorKind`):

| 種別 | 説明 | デフォルトリトライ可否 |
|------|------|----------------------|
| `offline` | オフライン状態 | ❌ (オンライン復帰を待つ) |
| `timeout` | リクエストタイムアウト | ✅ |
| `network` | ネットワークエラー (DNS, 接続失敗など) | ✅ |
| `server` | サーバーエラー (5xx, 429) | ✅ |
| `client` | クライアントエラー (4xx, 429以外) | ❌ |
| `decode` | レスポンスのJSONパースエラー | ❌ |
| `abort` | リクエストキャンセル | ❌ |
| `unknown` | 不明なエラー | ❌ |

**プロパティ**:
```typescript
export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status?: number        // HTTPステータスコード
  readonly code?: string           // サーバー返却のエラーコード
  readonly retryable: boolean      // リトライ可否
  readonly details?: unknown       // 追加情報
  readonly cause?: unknown         // 元のエラーオブジェクト
}
```

**使用例**:
```typescript
throw new ApiError('server', 'Service unavailable', {
  status: 503,
  retryable: true,
})
```

---

### 2. リトライロジック ([datasource.ts:17-112](../../web/src/features/quiz/datasource.ts#L17-L112))

#### 2.1 指数バックオフ

```typescript
const DEFAULT_RETRIES = IS_MOCK ? 0 : 3

let attempt = 0
while (attempt <= retries) {
  try {
    // リクエスト処理
  } catch (error) {
    if (apiError.retryable && attempt < retries) {
      const delayMs = 1000 * 2 ** attempt  // 1s, 2s, 4s
      attempt += 1
      await delay(delayMs)
      continue
    }
    throw apiError
  }
}
```

**リトライタイミング**:
- 1回目のリトライ: 1秒後
- 2回目のリトライ: 2秒後
- 3回目のリトライ: 4秒後

#### 2.2 リトライ条件

**自動リトライされるエラー**:
- HTTP 429 (Too Many Requests)
- HTTP 503 (Service Unavailable)
- HTTP 500番台 (Internal Server Error)
- ネットワークエラー (`TypeError`)

**リトライされないエラー**:
- オフライン状態 (`offline`)
- クライアントエラー (4xx, 429以外)
- JSONパースエラー (`decode`)

#### 2.3 オフライン検出

```typescript
// リクエスト前にオフライン状態をチェック
if (!IS_MOCK && isNavigatorOffline()) {
  throw new ApiError('offline', 'Offline detected before request', {
    retryable: false,
  })
}
```

**`isNavigatorOffline()` の実装** ([errors.ts:97-101](../../web/src/features/quiz/api/errors.ts#L97-L101)):
```typescript
export function isNavigatorOffline(): boolean {
  if (typeof navigator === 'undefined') return false  // SSR対応
  if (!('onLine' in navigator)) return false
  return navigator.onLine === false
}
```

---

### 3. エラーメッセージマッピング ([errors.ts:67-95](../../web/src/features/quiz/api/errors.ts#L67-L95))

**`mapApiErrorToMessage()`**:
エラー種別に応じてユーザーフレンドリーなメッセージを返却。

| エラー種別 | メッセージ例 |
|-----------|------------|
| `offline` | "You appear to be offline. Check your internet connection and try again." |
| `timeout` | "The request is taking longer than expected. Please retry in a moment." |
| `network` | "We could not reach the server. Please verify your connection and try again." |
| `server` (429) | "The request rate limit was reached. Please wait a few seconds and try again." |
| `server` (503) | "The service is temporarily unavailable. Please try again shortly." |
| `server` (5xx) | "The server encountered an error (HTTP 500). Please try again shortly." |
| `client` | "Your request could not be processed (HTTP 400). Please refresh the page and try again." |
| `decode` | "Received an unexpected response from the server. Please retry." |
| `abort` | "The request was cancelled. Please try again." |
| `unknown` | "Something went wrong. Please try again." |

**国際化対応**:
現在は英語のみ実装。将来的には `i18n` を使用して多言語対応予定。

---

### 4. トースト通知 ([Toast.tsx](../../web/src/components/Toast.tsx))

#### 4.1 コンポーネント仕様

```typescript
export type ToastProps = {
  message: string             // 表示メッセージ
  actionLabel?: string        // アクションボタンのラベル (e.g., "再試行")
  onAction?: () => void       // アクションボタンのクリックハンドラ
  onClose?: () => void        // 閉じるボタンのクリックハンドラ
  duration?: number           // 自動消滅時間 (ミリ秒, デフォルト: 5000)
  variant?: 'info' | 'error'  // 表示スタイル (デフォルト: 'info')
  closeLabel?: string         // 閉じるボタンのaria-label
}
```

#### 4.2 自動消滅

```typescript
React.useEffect(() => {
  if (!duration) return
  const timer = window.setTimeout(() => {
    onClose?.()
  }, duration)
  return () => window.clearTimeout(timer)
}, [duration, onClose, message])
```

#### 4.3 スタイル

- **エラー**: 赤背景 (`bg-red-600`, `border-red-500`)
- **情報**: ダークグレー背景 (`bg-gray-900`, `border-gray-800`)
- **位置**: 画面下部中央 (`bottom: 1.5rem`, `left: 50%`, `translateX(-50%)`)
- **z-index**: 40 (他の要素より前面)

#### 4.4 アクセシビリティ

- `role="status"`: スクリーンリーダーで読み上げ
- `aria-label`: 閉じるボタンのラベル

---

### 5. オンライン復帰時の自動リトライ ([page.tsx:102-114](../../web/app/play/page.tsx#L102-L114))

**実装**:
```typescript
const pendingRetryRef = React.useRef<(() => void) | null>(null)

React.useEffect(() => {
  function handleOnline() {
    if (pendingRetryRef.current) {
      const retry = pendingRetryRef.current
      pendingRetryRef.current = null
      closeToast()
      retry()  // 自動リトライ実行
    }
  }

  window.addEventListener('online', handleOnline)
  return () => window.removeEventListener('online', handleOnline)
}, [closeToast])
```

**フロー**:
1. オフライン検出時、`pendingRetryRef` にリトライ関数を保存
2. `window.addEventListener('online', ...)` でオンライン復帰を監視
3. オンライン復帰時、保存されたリトライ関数を実行
4. トーストを自動的に閉じる

---

## 統合例

### Play ページでのエラーハンドリング ([page.tsx:83-98](../../web/app/play/page.tsx#L83-L98))

```typescript
const scheduleRetry = React.useCallback(
  (error: ApiError, retryFn: () => void) => {
    const message = mapApiErrorToMessage(error)
    const wrappedRetry = () => {
      pendingRetryRef.current = null
      retryFn()
    }
    showToast(message, {
      actionLabel: t('toast.retry'),
      onAction: wrappedRetry,
      variant: 'error',
    })
    if (error.kind === 'offline') {
      pendingRetryRef.current = wrappedRetry  // オフライン時は自動リトライ用に保存
    }
  },
  [showToast, t]
)
```

### useAnswerProcessor での利用 ([useAnswerProcessor.ts:197-204](../../web/src/features/quiz/useAnswerProcessor.ts#L197-L204))

```typescript
} catch (e: unknown) {
  const apiError = ensureApiError(e, 'Failed to load next.')
  const message = mapApiErrorToMessage(apiError)
  dispatch({ type: 'ERROR', error: message })
  const retry = () => {
    void process(mode)
  }
  onError?.(apiError, retry)  // scheduleRetry が呼ばれる
}
```

---

## テストシナリオ

### E2E テスト (推奨)

1. **429エラー時のリトライ**:
   - MSW で 429 レスポンスを返却
   - 1秒後、2秒後、4秒後にリトライされることを確認

2. **オフライン→オンライン復帰**:
   - `navigator.onLine` を `false` に設定 (Chrome DevTools)
   - オフラインメッセージが表示されることを確認
   - `navigator.onLine` を `true` に戻す
   - 自動リトライが実行されることを確認

3. **トースト表示とクローズ**:
   - エラー発生時にトーストが表示されることを確認
   - 5秒後に自動消滅することを確認
   - 閉じるボタンで手動クローズできることを確認

### ユニットテスト

- `mapApiErrorToMessage()` の各エラー種別に対するメッセージ
- `isNavigatorOffline()` の SSR 対応
- `ApiError` のデフォルトリトライ可否判定

---

## パフォーマンス考慮事項

### リトライによる負荷

- **最大リトライ回数**: 3回 (合計4回のリクエスト)
- **合計待機時間**: 7秒 (1 + 2 + 4)
- **モック環境では無効**: `DEFAULT_RETRIES = 0` (開発時の高速化)

### トーストの自動消滅

- **デフォルト5秒**: ユーザーの邪魔にならない程度
- **手動クローズ可能**: すぐに消したい場合の救済策

---

## 今後の改善案

### 1. リトライ回数の可視化 (任意)

```typescript
const retryMsg = attempt > 0 ? ` (Retry ${attempt}/${retries})` : ''
showToast(`${message}${retryMsg}`, ...)
```

**メリット**: ユーザーにリトライ中であることを伝える
**デメリット**: 技術的すぎる情報でUXを損なう可能性

### 2. E2E テストでのエラーシナリオ検証

現在は手動テストのみ。Playwright でエラーシナリオを自動化することを推奨。

### 3. メトリクス送信失敗時のリトライ

[metricsClient.ts](../../web/src/lib/metrics/metricsClient.ts) にも同様のリトライロジックを適用することを検討。

---

## 関連ドキュメント

- [API Error Types](../../web/src/features/quiz/api/errors.ts) — エラー型定義
- [Datasource](../../web/src/features/quiz/datasource.ts) — リトライロジック実装
- [Toast Component](../../web/src/components/Toast.tsx) — トースト UI
- [Play Flow](./play-flow.md) — Play ページの状態遷移
- [Phase 3 Issue](../issues/104-phase3-error-handling.md) — Phase 3 実装詳細
