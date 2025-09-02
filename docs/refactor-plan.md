
# Refactor Windows & Policy

目的: プロダクト速度と品質のバランスを取るため、**リファクタリングを“窓”で行う**運用を定義。

## スケジュール（提案）
- **Window A**: v1.3 リリース直後（半日〜1日）
  - 目的: media 周りの関数分割・名前整理（`media_player.mjs` / `clip_start.mjs` 分離）
- **Window B**: v1.5 リリース直後（1日）
  - 目的: i18n 導入後のテキスト資産・UI構造の整理、スタイル共通化
- **再検討ポイント**: v1.5 後に **Monorepo packages** へ段階移行するかを判断

## 実施ルール
- **No behavior change** を原則（E2E/ライトE2E/Lighthouse 緑のまま）
- 1PRを **~300行以内** / 小さくマージ可能な粒度へ分割
- **feature flag** を活用してリスクを分割（例: `?clip2=1`）
- ロールバック手順を PR に明記（`git revert` で戻せる構成）
- Docs 更新を同梱（`docs/` と `FEATURES.yml`）

## チェックリスト
- [ ] 影響範囲の洗い出し（機能/テスト/Docs）
- [ ] 事前ベンチ or Lighthouse のベースライン採取
- [ ] スモークテスト項目（起動・1問・シェア導線・メディア）
- [ ] リリースノート追記（変更なしでも “内部改善” を記録）
