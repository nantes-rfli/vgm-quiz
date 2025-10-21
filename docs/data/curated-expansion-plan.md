# curated.json Expansion Plan (Phase 2A)

## 現状スナップショット（2025-10-19 更新）
- **トラック総数: 122** ✅ 目標超過達成!
- **ユニークゲーム数: 102** ✅ 最小4ゲームルール満たす & 同一タイトル上限2曲ルール適用
- **difficulty**: easy 44 / normal 42 / hard 36
- **era**: 80s 12 / 90s 28 / 00s 29 / 10s 42 / 20s 11
- **major series coverage**: ff 18 / dq 12 / mario 7 / sonic 8 / zelda 6 / chrono 2 / others 57タイトル
- **same-title limit**: 最大2曲/タイトル（FF15, FF14, FF13, FF8, FF7, FF6, DQ11, DQ10, DQ8, DQ7, DQ6など）

## 目標分布（100トラック想定）
- difficulty: easy 30 / normal 50 / hard 20
- era: 80s 15 / 90s 30 / 00s 30 / 10s 20 / 20s 5
- major series: ff 10 / dq 10 / zelda 10 / mario 10
- genres: rpg 30 / jrpg 25 / platformer 15 / action-adventure 15 / shooter 10 / puzzle 10 / fighting 10 / strategy 10 （仮）

## 優先追加バッチ（Phase 2 スプリント案）
1. **Batch A (FF / DQ中心 24曲)**
   - Final Fantasy I〜XVI から iconic track を年代順に選出
   - Dragon Quest I〜XI から序曲／フィールド／バトルをバランスよく
   - era: 80s/90s比率を底上げ
   - difficulty: easy 8 / normal 12 / hard 4
2. **Batch B (Nintendoフラッグシップ 24曲)**
   - Super Mario mainline 10曲（2D/3D混在）
   - The Legend of Zelda mainline 10曲（80s〜20sで散らす）
   - 補完: Metroid / Kirby から各2曲
   - difficulty: easy 10 / normal 10 / hard 4
3. **Batch C (Action/FPS/Indie 16曲)**
   - Halo, DOOM, Splatoon, Overwatch, Hades, Celeste など
   - shooter / indie / action ジャンルを補強
   - difficulty: easy 4 / normal 8 / hard 4
4. **Batch D (JRPG/Strategy 深掘り 18曲)**
   - Persona, Xenoblade, Fire Emblem, Civilization, Monster Hunter
   - strategy / jrpg の偏り調整
   - difficulty: easy 4 / normal 10 / hard 4
5. **Batch E (2000s〜2020s モダン 22曲)**
   - Genshin Impact, NieR:Automata（未収録曲）, Octopath Traveler, Splatoon 3 等
   - era: 10s / 20s を目標値に近づける
   - difficulty: easy 4 / normal 10 / hard 8

## メタデータ取得ワークフロー
1. `docs/data/curated-sources.md` に記載の公式プレイリストを順にスキャン
2. 曲単位で以下項目を収集（Notion/CSVで管理）
   - id（3桁ゼロ埋め採番）
   - title / game / series / composer / platform / year
   - youtube_url / spotify_url （片方しか無い場合はメモ）
   - difficulty / genres[] / seriesTags[] / era
3. `yt-dlp` を用いた公式チャンネル検索テンプレート
   ```bash
   yt_dlp() {
     /Users/nanto/Library/Python/3.9/bin/yt-dlp "ytsearch1:$1" --skip-download --print "%(webpage_url)s\t%(channel)s\t%(title)s"
   }
   ```
4. Spotify URI は web クライアントの share リンクをコピーし CSV に貼付
5. 入力完了後 `npm run validate:curated` で整合チェック

## 未解決事項
- Dragon Quest / Chrono などで公式配信が存在しない場合の代替（OST配信の確認中）
- `npm run validate:facet-distribution` を実装済（workers/scripts/validate-facet-distribution.ts）。非メジャーシリーズ（chrono/portal/undertale等）は閾値を1に緩和する仕様へ更新。主要不足は下記。
  - 00s×strategy/simulation（hard/normalのしきい値）：C&C Generals, AoE III, Civ IV系で継続補強
  - fps/shooter（easy）：Portalをeasyへ是正済。もう1〜2タイトル（例: Overwatch/TF2）で底上げ
  - fighting（90s/easy）：SFII等の公式配信要確認
- `apple_music_url` フィールドを追加し、公式配信が Apple Music 限定のトラックも登録可能にした（Dragon Quest 旧作サントラなど）。
  - 改善済みの代表例: `seriesTags=mario|era=00s` は4作品到達（Sunshine/NSMB/Galaxy/MKWii）、`seriesTags=zelda|era=90s` も4作品到達（ALttP/LA/LA DX/OoT）。
- curated.json 内の `series` 欄の命名統一（"The Legend of Zelda" vs "Legend of Zelda" 等）
