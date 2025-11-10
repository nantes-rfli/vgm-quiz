# State Management & Filters

- Status: Active
- Last Updated: 2025-11-11

## 目的

フロントエンドの状態管理全体を把握し、特に Phase 2 で新規追加された**フィルタ状態**と **Manifest キャッシュ**の仕組みを整理する。

---

## 1. 状態管理の三層構造

### 1.1. ラウンド状態（useReducer）

**ファイル**: `web/src/features/quiz/playReducer.ts`

ラウンド進行を `useReducer` で管理。クイズの問題、回答、スコアを一元化。

**State 型**:
```typescript
interface RoundState {
  status: 'idle' | 'loading' | 'playing' | 'finished'
  round?: RoundData
  currentQuestion?: Question
  selectedChoice?: string
  history: HistoryEntry[]
  error?: Error
}
```

**アクション**:
- `STARTED` - ラウンド開始
- `SELECT` - 選択肢を選択
- `ENTER_REVEAL` - リビール開始
- `QUEUE_NEXT` - 次の問題を準備
- `ADVANCE` - 次の問題へ移動
- `FINISHED` - ラウンド完了

---

### 1.2. フィルタ状態（Context + useState）

**ファイル**: `web/src/lib/filter-context.tsx`

フィルタ選択を `React Context` + `useState` で管理。複数コンポーネント間で共有可能。

**State 型**:
```typescript
interface FilterState {
  difficulty: 'easy' | 'normal' | 'hard' | 'mixed'
  era: '80s' | '90s' | '00s' | '10s' | '20s' | 'mixed'
  series: string[] // ['ff', 'dq', 'zelda', ...]
}

// デフォルト
const DEFAULT_FILTERS: FilterState = {
  difficulty: 'mixed',
  era: 'mixed',
  series: [],
}
```

**Provider & Hook**:
```typescript
<FilterProvider>
  <FilterSelector />
  {/* フィルタ情報は useFilter() で任意の子コンポーネントから取得可能 */}
</FilterProvider>

// 使用例 - useFilter() は以下オブジェクトを返却
const { filters, setDifficulty, setEra, setSeries, reset, isDefault } = useFilter()
const { difficulty, era, series } = filters
```

**useFilter() 返却オブジェクト**:
```typescript
{
  filters: FilterState,                        // { difficulty?, era?, series }
  setDifficulty: (value?: string) => void,
  setEra: (value?: string) => void,
  setSeries: (values: string[]) => void,
  reset: () => void,
  isDefault: () => boolean
}
```

**主要メソッド**:
- `setDifficulty(value)` - 難易度を更新（'mixed' 含む）
- `setEra(value)` - 年代を更新（'mixed' 含む）
- `setSeries(values)` - シリーズを複数選択（'mixed' は自動フィルタリング）
- `reset()` - フィルタをデフォルト値に初期化
- `isDefault()` - 全フィルタがデフォルト値かチェック

**重要**:
- `setSeries()` は **重複排除・ソートを行いません**。バックエンド側で正規化されます。
- difficulty/era は単一値のみですが、UI/API 層では異なる表現を使用（後述）。

---

### 1.3. Manifest キャッシュ（localStorage + React Query）

**ファイル**: [web/src/features/quiz/api/manifest.ts](web/src/features/quiz/api/manifest.ts) (lines 139-161)

Manifest を `React Query` で管理。効率的なキャッシュと自動再フェッチ。

**キャッシュ戦略** (実装ベース):
```typescript
const useManifest = () => {
  return useQuery({
    queryKey: ['manifest'],
    queryFn: async () => {
      // 1. localStorage から取得を試みる
      const cached = loadManifestFromStorage()
      if (cached && isCacheValid(cached)) {
        return cached.data  // 即座に返却（React Query は "stale" と判定）
      }

      // 2. ネットワークから取得
      const response = await fetch('/v1/manifest')
      const manifest = await response.json()

      // 3. localStorage に保存
      saveManifestToStorage(manifest)
      return manifest
    },
    staleTime: 1000 * 60 * 60,      // 1時間で stale に
    gcTime: 1000 * 60 * 60 * 24,    // 24時間でガベージ回収
    initialDataUpdatedAt: 0,        // 常に stale として扱う
    refetchOnMount: true,           // マウント時に再フェッチ
    refetchOnWindowFocus: false,    // ウィンドウフォーカス時は再フェッチしない
    refetchInterval: 1000 * 60 * 5, // 5分ごとにバックグラウンド再フェッチ
    refetchOnReconnect: true,       // 再接続時に再フェッチ
    throwOnError: false,            // エラー時は throw しない
    select: (data) => data ?? DEFAULT_MANIFEST,  // フォールバック
  })
}
```

**localStorage キー**: `vgm2.manifest.cache`

**キャッシュデータ構造**:
```json
{
  "data": {
    "schema_version": 2,
    "modes": [...],
    "facets": {...}
  },
  "timestamp": 1731284400000,
  "version": 2
}
```

**重要な特徴**:
- **Cache-First 戦略**: localStorage にあれば即座に返す → 同時にバックグラウンド再フェッチ（最新性確保）
- **TTL 整合性**: localStorage キャッシュは 24 時間、React Query staleTime は 1 時間
- **schema_version 変更検知**: Phase 2D で実装予定。キャッシュ内 version 変更を検知したら FilterContext をリセット
- **エラーハンドリング**: ネットワーク + localStorage 両失敗時は DEFAULT_MANIFEST にフォールバック

---

## 2. フロントエンド ↔ バックエンド 統合

### 2.1. /v1/manifest エンドポイント

GET リクエストで Manifest を取得。レスポンス例：

```json
{
  "schema_version": 2,
  "modes": [
    {
      "id": "vgm_v1-ja",
      "title": "VGM Quiz Vol.1 (JA)",
      "defaultTotal": 10,
      "locale": "ja"
    }
  ],
  "facets": {
    "difficulty": ["easy", "normal", "hard", "mixed"],
    "era": ["80s", "90s", "00s", "10s", "20s", "mixed"],
    "series": ["ff", "dq", "zelda", "mario", "sonic", "pokemon", "mixed"]
  },
  "features": {
    "inlinePlaybackDefault": false,
    "imageProxyEnabled": false
  }
}
```

**重要な設計**:
- `schema_version` - スキーマの互換性チェック用。変更検知時は FilterContext をリセット（Phase 2D 実装予定）
- `facets` - フロントエンド UI が受け入れる値の完全なリスト
- `features` - フロント機能のフラグ

### 2.2. /v1/rounds/start エンドポイント

POST リクエストでフィルタを指定してラウンド開始。

**リクエストペイロード**:
```json
{
  "mode": "vgm_v1-ja",
  "total": 10,
  "filters": {
    "difficulty": ["hard"],
    "era": ["90s"],
    "series": ["ff", "dq"]
  }
}
```

**重要な仕様**:
- Difficulty & Era は単一値でも配列形式で送信（バックエンド正規化に対応）
- Series は複数値をそのまま配列で送信
- Filter が空の場合は整数フィルタを `undefined` に（デフォルト動作）

**レスポンス**:
```json
{
  "round": {
    "id": "uuid",
    "mode": "vgm_v1-ja",
    "date": "2025-11-11",
    "filters": {
      "difficulty": "hard",
      "era": "90s",
      "series": ["ff", "dq"]
    },
    "progress": { "index": 1, "total": 10 },
    "token": "..."
  },
  "question": {...},
  "choices": [...]
}
```

---

## 3. フロント ↔ バック状態同期

### 3.1. フィルタ検証フロー

1. **Manifest 取得** → FilterSelector が `facets` から valid な値の一覧を取得
2. **ユーザー選択** → FilterContext に保存
3. **フィルタ検証** → 選択値が現在の Manifest 内に存在するか確認
4. **リセット** → Manifest の schema_version 変更を検知したら、無効なフィルタを自動リセット
5. **送信** → 検証済みフィルタを `/v1/rounds/start` に送信

### 3.2. バックエンドフィルタ検証

バックエンドは独立してフィルタを検証：

1. **型強制**: 文字列または配列に正規化
2. **'mixed' 除外**: 'mixed' 値をフィルタリング（全選択を意味するため）
3. **複数値チェック**: Difficulty & Era は最大1値、Series は無制限
4. **マニフェスト照合**: 各値が Manifest の facets に存在するか確認
5. **正規化**: Series のソート＆重複排除

**エラー例**:
```json
{
  "error": {
    "code": "bad_request",
    "message": "unknown difficulty: expert",
    "details": { "pointer": "/filters/difficulty" }
  }
}
```

---

## 4. ストレージ戦略

### 4.1. sessionStorage（ラウンド単位）

クイズプレイの進行状態や結果。タブを閉じるとリセット。

| キー | 用途 |
|------|------|
| `vgm2.result.summary` | ラウンド完走結果 |
| `vgm2.result.reveals` | 問題ごとのリビール履歴 |

### 4.2. localStorage（端末単位）

ユーザー設定やキャッシュ。復帰後も維持。

| キー | 用途 | TTL |
|------|------|-----|
| `vgm2.settings.inlinePlayback` | インライン再生トグル | 無期限 |
| `vgm2.metrics.queue` | 未送信メトリクスバッファ | 無期限 |
| `vgm2.metrics.clientId` | 匿名クライアント ID | 無期限 |
| `vgm2.manifest.cache` | Manifest キャッシュ | 24 時間 |

---

## 5. Manifest キャッシュの詳細

### 5.1. キャッシュ取得フロー

```
useManifest() 呼ばれる
  ↓
localStorage から取得を試みる
  ↓
  - キャッシュあり + 有効 → キャッシュデータを返却 + バックグラウンド再フェッチ
  - キャッシュなし or 無効 → ネットワークからフェッチ
  ↓
  ネットワークフェッチ成功 → localStorage に保存 + 返却
  ネットワークフェッチ失敗 → DEFAULT_MANIFEST を返却
```

### 5.2. キャッシュ有効期限

- **staleTime**: 5 分 → 5 分以内は再フェッチしない（同期的に返却）
- **gcTime**: 24 時間 → 24 時間以上古いキャッシュは破棄
- **refetchInterval**: 5 分 → バックグラウンドで 5 分ごとに更新確認

### 5.3. schema_version 変更検知

Manifest の `schema_version` が変わった場合：
1. 新しい schema_version をキャッシュに保存
2. FilterContext の `isDefault()` で有効性を再確認
3. 無効なフィルタ値は自動リセット（例：削除されたシリーズ値）

---

## 6. エラーハンドリング

### 6.1. Manifest 取得失敗

```javascript
if (manifestQuery.isError) {
  // フォールバック: DEFAULT_MANIFEST を使用
  // DEFAULT_MANIFEST は基本的なファセット値を含む最小限のマニフェスト
  // ユーザーは制限されたフィルタ選択肢でプレイ可能
}
```

### 6.2. フィルタ検証失敗

```javascript
if (filterError) {
  // UserError: Manifest の schema_version 変更で無効なフィルタを選択
  // → 無効なフィルタをリセット + ユーザーに通知
  // → 再度フィルタ選択を促す
}
```

### 6.3. /v1/rounds/start 失敗

```javascript
if (startError.code === 'no_questions') {
  // Inventory: 選択フィルタに対して利用可能な問題がない
  // → フィルタを緩和するよう促す
}

if (startError.code === 'insufficient_inventory') {
  // Inventory: リクエスト問題数が利用可能数を超過
  // → total を減らすよう提案
}
```

---

## 7. パフォーマンス最適化

### 7.1. Manifest キャッシュ活用

- **初回**: ネットワークフェッチ（若干遅延）
- **2回目以降**: キャッシュから即座に返却（UI レスポンス向上）
- **バックグラウンド**: 5 分ごとに更新確認（ユーザー体験を損なわない）

### 7.2. フィルタ選択の最適化

- **ローカルバリデーション**: Manifest キャッシュを使用して即座に valid/invalid を判定
- **早期送信中止**: 無効なフィルタ値は API 送信前にリセット
- **デバウンス**: Series 複数選択時の再レンダリングを抑制（実装検討）

---

## 8. テスト戦略

### 8.1. Manifest キャッシュのテスト

```typescript
describe('useManifest', () => {
  it('キャッシュから Manifest を返却', () => {
    // localStorage に Manifest キャッシュを設定
    // useManifest() 呼ぶ
    // → 即座にキャッシュデータを返却
  })

  it('schema_version 変更を検知したら新フェッチ', () => {
    // schema_version が変わったレスポンスをモック
    // → 新キャッシュに置き換え
  })

  it('フェッチ失敗時は DEFAULT_MANIFEST にフォールバック', () => {
    // ネットワークエラーをモック
    // → DEFAULT_MANIFEST を返却
  })
})
```

### 8.2. フィルタ検証のテスト

```typescript
describe('FilterContext', () => {
  it('有効なフィルタ値を受け入れる', () => {
    // setDifficulty('hard')
    // → difficulty === 'hard'
  })

  it('無効なフィルタ値をリセット', () => {
    // Manifest に存在しない series 値を設定
    // schema_version 変更を検知
    // → series をリセット
  })

  it('Series 複数選択時に重複を排除', () => {
    // setSeries(['ff', 'ff', 'dq'])
    // → ['dq', 'ff'] (ソート済み)
  })
})
```

---

## 9. 今後の検討事項

- **複合フィルター**: 現在は OR ロジック（Series の複数値）。AND ロジック対応
- **新ファセット**: genre, platform 等の追加時の拡張戦略
- **キャッシュ戦略の調整**: ユーザー行動データに基づいて staleTime / gcTime を最適化
- **オフラインサポート**: Manifest キャッシュの活用を強化してオフライン対応を検討
