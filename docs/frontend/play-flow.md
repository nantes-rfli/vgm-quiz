# Play Flow & Result Summary

- Status: Active
- Last Updated: 2025-11-11

## 目的
`/play`〜`/result` の画面挙動・状態管理・ストレージ利用を整理し、実装とドキュメントを揃える。Phase 2（フィルタ UI + Manifest 統合）を含む最新フローを記載する。

---

## 1. フィルタ選択フロー（Phase 2+）

### 1.1. Manifest 取得
1. `/play` 読み込み時に `useManifest()` フック で `/v1/manifest` を取得する
   - **キャッシュ戦略**: localStorage に 24 時間キャッシュ + 5 分ごとにバックグラウンド再フェッチ
   - **フォールバック**: キャッシュとネットワーク両方失敗時は `DEFAULT_MANIFEST` を使用
2. Manifest 応答例：
   ```json
   {
     "schema_version": 2,
     "modes": [{ "id": "vgm_v1-ja", "title": "VGM Quiz Vol.1 (JA)", "defaultTotal": 10 }],
     "facets": {
       "difficulty": ["easy", "normal", "hard", "mixed"],
       "era": ["80s", "90s", "00s", "10s", "20s", "mixed"],
       "series": ["ff", "dq", "zelda", "mario", "sonic", "pokemon", "mixed"]
     }
   }
   ```
3. Manifest の schema_version 変更を検知したら、フィルタ選択を自動リセット

### 1.2. フィルタ選択UI
1. `FilterSelector` コンポーネントが Manifest 上のファセット値でドロップダウンを生成
2. ユーザー選択：
   - **Difficulty**: 単一選択（easy / normal / hard / mixed）
   - **Era**: 単一選択（80s / 90s / 00s / 10s / 20s / mixed）
   - **Series**: 複数選択（ff, dq, zelda, mario, sonic, pokemon）
   - 各選択は `FilterContext` (`useFilter()`) で管理
3. **利用可能な問題数**: 選択フィルタに対して `/v1/manifest` キャッシュから推定値を表示（実値は次ステップで確認）
4. 不正なフィルタ選択（例：キャッシュ古化で削除されたファセット値）は自動的にリセット

### 1.3. ラウンド開始
1. ユーザーが「スタート」ボタンをクリック → `bootAndStart(filters)` が呼ばれる
2. `/v1/rounds/start` に以下のペイロードを送信：
   ```json
   {
     "filters": {
       "difficulty": ["hard"],
       "era": ["90s"],
       "series": ["ff", "dq"]
     },
     "total": 10,
     "mode": "vgm_v1-ja"
   }
   ```
   - **Difficulty & Era**: 単一値でも配列形式で送信（バックエンド正規化のため）
   - **Series**: 複数値をそのまま配列で送信
   - **Filters が空の場合**: 整数フィルタは `undefined` に（デフォルト・日替わり動作）
3. バックエンドが フィルタ済み質問セット を返却
   - レスポンスには `round.filters` が含まれ、リクエストで指定したフィルタが返される

---

## 2. 画面遷移（クイズフロー）
1. フィルタ選択 → `/v1/rounds/start` → 最初の問題表示
2. 問題表示 → 回答 → リビール → 次の問題、を `reducer` のアクション（`SELECT` / `ENTER_REVEAL` / `QUEUE_NEXT` / `ADVANCE`）で遷移させる
3. `rounds/next` が `finished: true` を返すと `/result` に遷移する

---

## 3. タイマーとスコア
- 1問あたりの制限時間は **15秒** (`QUESTION_TIME_LIMIT_MS = 15_000`)。
- コンポーネント `Timer` が残り時間を表示。5秒以下で警告色に切り替える。
- 残り時間が0になった場合は `timeout` として自動で回答を確定。
- スコア計算: **正解は 100 + 残秒×5、その他は 0**。`ScoreBadge` が合計ポイントと正誤数を表示。
- 質問履歴 (`history`) とサマリ (`ResultSummary`) を `sessionStorage` に保存し、`/result` で表示。

---

## 4. ストレージの利用
| キー | ストレージ | 用途 |
| --- | --- | --- |
| `vgm2.result.summary` | `sessionStorage` | ラウンド完走結果（合計ポイント、正誤、開始/終了時刻） |
| `vgm2.result.reveals` | `sessionStorage` | 問題ごとのリビール履歴（Result 画面で表示） |
| `vgm2.settings.inlinePlayback` | `localStorage` | インライン再生トグル（0/1） |
| `vgm2.metrics.queue` | `localStorage` | 未送信メトリクスイベントのバッファ |
| `vgm2.metrics.clientId` | `localStorage` | 匿名クライアントID (UUID) |
| `vgm2.manifest.cache` | `localStorage` | Manifest キャッシュ（タイムスタンプ + schema_version 含む） |

> `sessionStorage` はタブ単位、`localStorage` は端末単位。プレイ再開時のデータ再利用とプライバシー配慮を両立するための選択。

---

## 5. Result 画面
- `Result` は `ResultSummary` を読み取り、合計スコア／正誤／残秒・ポイントを一覧で表示。
- `Reveal` 履歴と組み合わせて、各問題のリンク・メタ情報・回答内訳を提供。
- インライン再生トグルは `/play` と同一コンポーネントを再利用し、状態を `localStorage` で共有。

---

## 6. エラーとオフライン時の振る舞い
- `rounds/start` / `rounds/next` で失敗した場合は `ErrorBanner` を表示し、ユーザーに再試行を促す（自動リトライは未実装）。
- フィルタ選択フェーズで Manifest 取得失敗時は、キャッシュ値またはデフォルトマニフェストを利用してフォールバック

---

## 7. 今後の検討事項
- 実バックエンド接続時のリトライ戦略、部分的なプリフェッチ。
- Result 画面での共有機能や追加指標（正答率グラフ等）。
- `ScoreBadge` の情報を `/play` の上部だけでなく `/result` にも拡張表示するか。

