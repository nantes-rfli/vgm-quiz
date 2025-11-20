# curated.json Data Sources

このリストは Phase 2A の curated.json 拡充で参照する主要ソースを整理したもの。優先度は Issue #110 の方針に従い、公式配信・信頼性の高いメタデータを重視する。

## 優先度1: 公式配信
- Square Enix Music Channel (YouTube) — https://www.youtube.com/channel/UCMx60HYcw1ieiPlZZagfqXQ
- Square Enix Music Portal — https://www.jp.square-enix.com/music/
- Chill Square Enix Music 24/7（YouTube Live & Spotify 同時配信）— https://www.youtube.com/live/svb-FVtbDf8
- Nintendo Music アプリ（Nintendo Switch Online 加入者向け公式配信）— https://www.nintendo.com/us/nintendo-music/
- Pokémon Game Sound Library — https://soundlibrary.pokemon.co.jp/asia-en/
- Capcom Game Music 公式ポータル — https://www.capcom-games.com/en/music/
- SEGA SOUND TEAM（Spotify 公式アーティストページ）— https://open.spotify.com/artist/4ShgdWtm52xvEr8uYmT0V6
- PlayStation | The Concert（公式ライブツアー情報）— https://www.playstation.com/en-us/theconcert
- Symphonic Suite Dragon Quest（Apple Music オリジナル音源）— https://music.apple.com/us/album/overture-xi/1824666024

## 優先度2: データベース
- VGMdb — https://vgmdb.net/ （サウンドトラック情報の確認に使用、直接リンクは登録しない）
- IGDB — https://www.igdb.com/ （ゲーム発売年やプラットフォームの確認）

## 優先度3: コミュニティ・手動キュレーション
- Reddit: r/gamemusic — https://www.reddit.com/r/gamemusic/
- VGMO -Video Game Music Online- — https://www.vgmonline.net/
- 個人所蔵および既存ナレッジ

## 補足
- 公式配信で見つからないトラックは、作曲者・年の裏付けに VGMdb/IGDB を用いる。
- YouTubeは公式チャンネルを優先し、非公式アップロードを利用する場合は将来的な差し替えを想定してトラッキングする。
- Spotifyのみ/YouTubeのみのトラックは片方だけでも登録可。ただし両方揃う場合を優先する。

---

## Phase 4A intake ソースカタログ（初版ドラフト）
YouTube／Spotify／Apple Music の 3 系列を L1/L2/L3 に分けて取り込み順を定義する。L1→L2→L3 の順でフェイルオーバーし、同日に枠を使い切ったら翌日に持ち越す。

### ソース階層
- **L1 公式**: パブリッシャー公式チャンネル / OST 公式配信（例: NintendoMusic, CAPCOM, SQUARE ENIX MUSIC, SEGA SOUND TEAM）
- **L2 レーベル**: 公認レーベル・流通（例: Brave Wave, Materia Collective, Scarlet Moon Records）
- **L3 高品質プレイリスト**: 再生数/保存数が高いキュレーション（例: “Official VGM Playlist” タグ付き、フォロワー>5k、週次更新）

### 除外基準（共通）
- 権利警告・DMCA 申告が付与されたアイテム
- 音質: LUFS -22〜-10 を外れる、無音率 >3%、クリッピング >0.1%
- メタ欠損: タイトル/ゲーム名/作曲者のいずれか欠落（L3 ではゲーム名 or 作曲者が欠けても候補とするが Guard で落とす）
- Duration: 30s 未満または 8 分超（staging では 10s〜12m に緩和）

### 優先度付きリスト（例）
- L1:  
  - Nintendo Music / Nintendo (YouTube)  
  - CAPCOM Channel (YouTube)  
  - SQUARE ENIX MUSIC (YouTube)  
  - SEGA SOUND TEAM (Spotify アーティスト)  
- L2:  
  - Brave Wave Productions (YouTube/Spotify)  
  - Materia Collective (YouTube/Spotify)  
  - Scarlet Moon Records (YouTube/Spotify)  
- L3:  
  - “Official VGM Playlist” (YouTube, >=5k フォロワー, 直近更新 <30 日)  
  - “Game Soundtrack Highlights” (Spotify, 編集者公式マーク付き)  

### 運用メモ
- 1 日の API クォータが逼迫した場合は L1 優先で L2/L3 を翌日に繰り越す。
- ソースリストは JSON 化（`SOURCE_CATALOG_JSON`）で playlist/channel/artist ID と優先度を保持する。
- Spotify/Apple の ID も同一カタログで管理し、`provider` フィールドで区別する。
