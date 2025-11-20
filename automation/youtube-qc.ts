// Phase 4A: YouTube プレイリスト品質チェック用の雛形スクリプト
// 実装方針: まずはメタデータ取得と簡易オーディオ統計に分割し、後続で並列処理とストレージ連携を拡張する。

type PlaylistItem = {
  videoId: string
  title: string
  channelTitle: string
  url: string
}

type AudioStats = {
  lufs: number | null
  silenceRatio: number | null
  clipRatio: number | null
}

async function fetchPlaylistItems(_playlistId: string): Promise<PlaylistItem[]> {
  // TODO: YouTube Data API v3 で playlistItems を取得
  throw new Error('fetchPlaylistItems not implemented (stub)')
}

async function measureAudio(_videoId: string): Promise<AudioStats> {
  // TODO: 音声サンプルを取得し、LUFS/無音率/クリッピング率を計測
  // - まずはダミー値を返し、後で ffmpeg + loudnorm などで実装
  throw new Error('measureAudio not implemented (stub)')
}

async function main() {
  const playlistId = process.argv[2]
  if (!playlistId) {
    console.error('Usage: ts-node automation/youtube-qc.ts <PLAYLIST_ID>')
    process.exit(1)
  }

  console.warn('Stub script: do not run in production. Implement API fetch + audio stats before using.')
  const items = await fetchPlaylistItems(playlistId)
  console.log(`Fetched ${items.length} items (stub, audio stats not computed)`) // placeholder
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
