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
// web/src/lib/filter-context.tsx より
export interface FilterState {
  difficulty?: 'easy' | 'normal' | 'hard' | 'mixed'  // オプショナル（undefined の可能性）
  era?: '80s' | '90s' | '00s' | '10s' | '20s' | 'mixed'  // オプショナル（undefined の可能性）
  series: string[] // ['ff', 'dq', 'zelda', ...]
}

// デフォルト
const defaultFilters: FilterState = {
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
  filters: FilterState,                        // { difficulty?: string, era?: string, series: string[] }
  setDifficulty: (value?: Difficulty) => void,  // undefined または 'easy'/'normal'/'hard'/'mixed'
  setEra: (value?: Era) => void,                // undefined または '80s'/'90s'/.../'mixed'
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
- **FilterState 型**: `difficulty` と `era` は **オプショナル** (`?` 付き)
  - `filters.difficulty` が `undefined` になり得る。コンポーネントで使用時は null check が必要
  - 例: `const isMixed = filters.difficulty !== 'mixed' && filters.difficulty !== undefined`
- `setSeries()` は **重複排除・ソートを行いません**。バックエンド側で正規化されます。
- difficulty/era は単一値のみですが、UI/API 層では異なる表現を使用（後述）。

---

### 1.3. Manifest キャッシュ（localStorage + React Query）

**ファイル**: [web/src/features/quiz/api/manifest.ts](web/src/features/quiz/api/manifest.ts) (lines 139-161)

Manifest を `React Query` で管理。効率的なキャッシュと自動再フェッチ。

**キャッシュ戦略** (実装ベース):
```typescript
// web/src/features/quiz/api/manifest.ts より

// 1. localStorage から読み込む補助関数
const loadManifestFromStorage = () => {
  try {
    const cached = localStorage.getItem('vgm2.manifest.cache')
    if (!cached) return null
    const parsed = JSON.parse(cached)
    // キャッシュが 24 時間以上古いかチェック
    if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
      return parsed  // 有効なキャッシュ
    }
  } catch (e) {
    // JSON パースエラーは無視
  }
  return null
}

// 2. ネットワークからフェッチして localStorage に保存
const fetchManifest = async () => {
  const response = await fetch('/v1/manifest')
  if (!response.ok) throw new Error('Failed to fetch manifest')
  const manifest = await response.json()

  // 手動で localStorage に保存
  localStorage.setItem('vgm2.manifest.cache', JSON.stringify({
    data: manifest,
    timestamp: Date.now(),
    version: manifest.schema_version
  }))

  return manifest
}

// 3. useQuery で管理（実装: web/src/features/quiz/api/manifest.ts (lines 139-162)）
export function useManifest() {
  return useQuery({
    queryKey: ['manifest'],
    queryFn: fetchManifest,
    // キャッシュ優先で即座にデータを返し、ローディング状態を避ける
    // キャッシュなければ DEFAULT_MANIFEST を返す
    initialData: loadManifestFromStorage()?.data ?? DEFAULT_MANIFEST,
    // initialData を即座に stale にすることで refetchOnMount を発動させ、最新データを確認
    initialDataUpdatedAt: 0,
    // React Query キャッシュ設定
    staleTime: 1000 * 60 * 60,      // 1時間で stale に
    gcTime: 1000 * 60 * 60 * 24,    // 24時間でガベージ回収
    refetchOnMount: true,            // マウント時に再フェッチ（initialDataUpdatedAt: 0 と組み合わせ）
    refetchOnWindowFocus: false,     // ウィンドウフォーカス時は再フェッチしない
    refetchInterval: 1000 * 60 * 5,  // 5分ごとにバックグラウンド再フェッチ（schema_version 変更検知用）
    refetchOnReconnect: true,        // 再接続時に再フェッチ
    throwOnError: false,             // エラー時は throw しない
    // エラー時でも常に Manifest を返す（initialData か DEFAULT_MANIFEST か select か）
    select: (data) => data ?? DEFAULT_MANIFEST,
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

**リクエストペイロード** ([web/src/components/FilterSelector.tsx](web/src/components/FilterSelector.tsx)):
```json
{
  "mode": "vgm_v1-ja",
  "total": 10,
  "filters": {
    "difficulty": "hard",
    "era": "90s",
    "series": ["ff", "dq"]
  }
}
```

**重要な仕様**:
- **Difficulty & Era**: 文字列形式で送信（例: `"hard"`, `"90s"`）
- **Series**: 複数値を配列で送信（例: `["ff", "dq"]`）
- **Filter が空の場合**: フィルタフィールドを `undefined` または省略（デフォルト・日替わり動作）

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
4. **[Phase 2D-Future]** リセット → Manifest の schema_version 変更を検知したら、無効なフィルタを自動リセット
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

### 5.1. キャッシュ取得フロー（Cache-First 戦略）

**重要な設計**: `initialData` で即座にデータを返し、UI ローディング状態を避ける。

```
useManifest() 呼ばれる
  ↓
【即座に返却】
  initialData: loadManifestFromStorage()?.data ?? DEFAULT_MANIFEST
  - キャッシュあり + 有効 → キャッシュデータを返却
  - キャッシュなし or 無効 → DEFAULT_MANIFEST を返却
  ↓
【同時にバックグラウンド検証開始】（initialDataUpdatedAt: 0 + refetchOnMount: true）
  fetchManifest() でネットワークからフェッチ
  ↓
  - フェッチ成功 → 新しいデータを localStorage に保存 → UI 更新
  - フェッチ失敗 → エラー状態だが select で DEFAULT_MANIFEST を返す（UI は変わらず）
```

**動作の詳細**:
- **1回目訪問**: キャッシュなし → DEFAULT_MANIFEST を返却 → 同時に /v1/manifest をフェッチ → キャッシュに保存
- **2回目以降**: キャッシュを返却（高速） → 同時に最新データをフェッチ（バージョン確認）
- **オフライン**: キャッシュがあれば返却、なければ DEFAULT_MANIFEST（常にデータあり）

### 5.2. キャッシュ有効期限

- **staleTime**: 1 時間 → 1 時間以内は再フェッチしない（ローカルキャッシュから即座に返却）
- **gcTime**: 24 時間 → 24 時間以上古いキャッシュは破棄
- **refetchInterval**: 5 分 → バックグラウンドで 5 分ごとに更新確認（stale 後の自動再フェッチ）

### 5.3. schema_version 変更検知 [Phase 2D-Future]

**現在の実装状況**: このフローは未実装です。

計画中の動作：
- Manifest の `schema_version` が変わった場合に検知
- FilterContext の無効なフィルタ値を自動リセット（例：削除されたシリーズ値）
- ユーザーに通知メッセージを表示

実装予定時期: Issue #115 (QA-01)

---

## 6. エラーハンドリング

### 6.1. Manifest 取得失敗

**実装の特徴**: エラー時の自動フォールバック

useManifest() は常に正常なデータを返します：

```javascript
const { data: manifest, isError, isLoading } = useManifest()
// data は常に存在（キャッシュ、initialData、DEFAULT_MANIFEST のいずれか）

// エラーが発生した場合：
if (isError) {
  // manifestQuery.data は DEFAULT_MANIFEST（select で保証）
  // UI は常に表示可能、ただしデータは最小限のデフォルト値
  // ネットワーク再接続を待つか、ユーザーに再試行を促す
}

// 通常の利用：
const facets = manifest.facets  // 常に存在（undefined チェック不要）
```

**三重のフォールバック**:
1. キャッシュがあれば使用
2. キャッシュなければ DEFAULT_MANIFEST を initialData として返す
3. ネットワーク失敗時も select で DEFAULT_MANIFEST を返す

### 6.2. フィルタ検証失敗 [Phase 2D-Future]

**現在の実装**: 通常の UI バリデーション（Manifest 上の facets に存在しない値を選択した場合のリセット）のみ

計画中の動作（Phase 2D）:
- UserError: Manifest の `schema_version` 変更で無効なフィルタを選択
- → 無効なフィルタを自動リセット + ユーザーに通知
- → 再度フィルタ選択を促す

実装予定時期: Issue #115 (QA-01)

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
