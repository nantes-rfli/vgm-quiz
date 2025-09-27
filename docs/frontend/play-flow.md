# Play Flow & Result Summary

- Status: Draft
- Last Updated: 2025-09-27

## 目的
`/play`〜`/result` の画面挙動・状態管理・ストレージ利用を整理し、実装とドキュメントを揃える。FE-06 の DoD をサポートするために必要な情報を記載する。

---

## 1. 画面遷移
1. `/play` 読み込み時に `useReducer` でラウンド状態を初期化し、`NEXT_PUBLIC_PLAY_AUTOSTART` が `1`（既定）なら自動で `/v1/rounds/start` を呼ぶ。
2. 問題表示 → 回答 → リビール → 次の問題、を `reducer` のアクション（`SELECT` / `ENTER_REVEAL` / `QUEUE_NEXT` / `ADVANCE`）で遷移させる。
3. `rounds/next` が `finished: true` を返すと `/result` に遷移する。

---

## 2. タイマーとスコア
- 1問あたりの制限時間は **15秒** (`QUESTION_TIME_LIMIT_MS = 15_000`)。
- コンポーネント `Timer` が残り時間を表示。5秒以下で警告色に切り替える。
- 残り時間が0になった場合は `timeout` として自動で回答を確定。
- スコア計算: **正解は 100 + 残秒×5、その他は 0**。`ScoreBadge` が合計ポイントと正誤数を表示。
- 質問履歴 (`history`) とサマリ (`ResultSummary`) を `sessionStorage` に保存し、`/result` で表示。

---

## 3. ストレージの利用
| キー | ストレージ | 用途 |
| --- | --- | --- |
| `vgm2.result.summary` | `sessionStorage` | ラウンド完走結果（合計ポイント、正誤、開始/終了時刻） |
| `vgm2.result.reveals` | `sessionStorage` | 問題ごとのリビール履歴（Result 画面で表示） |
| `vgm2.settings.inlinePlayback` | `localStorage` | インライン再生トグル（0/1） |
| `vgm2.metrics.queue` | `localStorage` | 未送信メトリクスイベントのバッファ |
| `vgm2.metrics.clientId` | `localStorage` | 匿名クライアントID (UUID) |

> `sessionStorage` はタブ単位、`localStorage` は端末単位。プレイ再開時のデータ再利用とプライバシー配慮を両立するための選択。

---

## 4. Result 画面
- `Result` は `ResultSummary` を読み取り、合計スコア／正誤／残秒・ポイントを一覧で表示。
- `Reveal` 履歴と組み合わせて、各問題のリンク・メタ情報・回答内訳を提供。
- インライン再生トグルは `/play` と同一コンポーネントを再利用し、状態を `localStorage` で共有。

---

## 5. エラーとオフライン時の振る舞い
- `rounds/start` / `rounds/next` で失敗した場合は `ErrorBanner` を表示し、ユーザーに再試行を促す（自動リトライは未実装）。
- 現状はラウンド進行がモックで完結するため、オフラインでもクイズを継続可能。実 BE 接続時はオフライン時の UX を再設計する必要がある。

---

## 6. 今後の検討事項
- 実バックエンド接続時のリトライ戦略、部分的なプリフェッチ。
- Result 画面での共有機能や追加指標（正答率グラフ等）。
- `ScoreBadge` の情報を `/play` の上部だけでなく `/result` にも拡張表示するか。

