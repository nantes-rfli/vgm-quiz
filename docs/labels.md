# Labels / Conventions

運用に使う主要ラベルとその意味を定義します。最低限に絞っています。

## ドキュメント関連

- `docs:skip`  
  コード変更のPRだが**ドキュメント更新が不要**な場合に付与。  
  - 例：CIの軽微な修正、コメントのみの変更、README以外に影響しない内部リファクタ
  - **docs-enforcer** はこのラベルがあれば pass します。

## ロードマップ / 計画

- `roadmap:v1.1` / `roadmap:v1.2` / …  
  そのPR/Issueがどのマイルストーン（Roadmap）に紐づくかのメタ情報。
  - `docs/ROADMAP.md` における節と対応。

## 稼働影響

- `ops:low-risk` / `ops:high-risk`  
  Pages 配信やE2Eに影響する変更度合いのメモ。レビュー/配信の段取りに利用。

## 使い方の指針

- ラベルは**多過ぎると運用負荷**が上がるため、まずは上記だけで運用開始。必要になったら増やす。

## 参考
- `docs/ci.md` – CIとRequiredチェック
- `docs/ROADMAP.md` – マイルストーンの背景とDoD
- `docs/FEATURES.yml` – 機能の正本

