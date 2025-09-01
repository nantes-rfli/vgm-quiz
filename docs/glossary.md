# Glossary

- **dataset.json**: Clojure ビルドが生成する基礎データ（`public/build/dataset.json`）。
- **daily.json**: アプリが参照する当日/指定日データ（`public/app/daily.json`）。
- **daily_auto.json**: AUTOモードの候補/選択肢出力（`public/app/daily_auto.json`）。
- **choices_override**: AUTO で 4 択を上書きするための情報。
- **allow_heuristic_media**: 検証用途のメディア推定を許可するフラグ。
- **SW（Service Worker）**: `version.json` で更新検知。
- **AUTOバッジ**: `?auto=1` 読み込み成功の UI サイン（右上 "AUTO"）。
- **auto_any**: 検証用フラグ。正規化一致を無視して AUTO を強制適用。
