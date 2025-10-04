# 国際化 (i18n) ガイド

## 概要

VGM Quiz は日本語 (ja) と英語 (en) のローカライゼーションに対応しており、ブラウザの設定に基づいて自動的に言語を検出します。

## アーキテクチャ

### サポートされるロケール

- **日本語** (`ja`) — プライマリロケール
- **英語** (`en`) — デフォルトのフォールバック

### ストレージ

- **キー**: `vgm2.settings.locale`
- **保存先**: `localStorage`
- **値**: `"ja"`, `"en"`
- **検出の優先順位**:
  1. ユーザーの明示的な選択（localStorageに保存）
  2. ブラウザ言語（`navigator.language`）
  3. デフォルトのフォールバック（`en`）

### 実装ファイル

- [web/src/lib/locale.ts](../../web/src/lib/locale.ts) — ロケールの型定義と検出ロジック
- [web/src/lib/i18n.tsx](../../web/src/lib/i18n.tsx) — i18nコンテキストプロバイダーと `useI18n` フック
- [web/locales/ja.json](../../web/locales/ja.json) — 日本語翻訳
- [web/locales/en.json](../../web/locales/en.json) — 英語翻訳
- [web/src/components/HtmlLangSync.tsx](../../web/src/components/HtmlLangSync.tsx) — `<html lang>` 属性を現在のロケールに同期
- [web/src/components/LocaleSwitcher.tsx](../../web/src/components/LocaleSwitcher.tsx) — 言語切り替えUIコンポーネント

## 翻訳ファイル

### 構造

翻訳キーは機能/ページごとに整理されています：

```json
{
  "play": {
    "answerButton": "回答 (Enter)",
    "nextButton": "次へ (Enter)",
    "timeRemaining": "残り時間"
  },
  "reveal": {
    "listenWatch": "視聴する",
    "openIn": "{provider}で開く"
  },
  "result": {
    "title": "結果",
    "totalScore": "合計スコア {points}"
  },
  "settings": {
    "title": "設定",
    "locale": "言語"
  },
  "outcome": {
    "correct": "正解",
    "wrong": "不正解"
  }
}
```

### パラメータ補間

動的な値には波括弧を使用します：

```json
{
  "greeting": "こんにちは、{name}さん！",
  "score": "{points}点を獲得しました"
}
```

コンポーネント内での使用：

```tsx
const { t } = useI18n()
t('greeting', { name: 'Alice' })  // "こんにちは、Aliceさん！"
t('score', { points: '450' })      // "450点を獲得しました"
```

## 使い方

### コンポーネント内での使用

```tsx
import { useI18n } from '@/src/lib/i18n'

function MyComponent() {
  const { t, locale, setLocale } = useI18n()

  return (
    <div>
      <p>{t('play.answerButton')}</p>
      <button onClick={() => setLocale(locale === 'ja' ? 'en' : 'ja')}>
        言語を切り替え
      </button>
    </div>
  )
}
```

### LocaleSwitcherコンポーネント

[LocaleSwitcher](../../web/src/components/LocaleSwitcher.tsx) コンポーネントは、1つのボタンで言語をトグルします：

- クリック → 日本語 ⇄ English を切り替え
- `settings_locale_toggle` メトリクスイベントを記録

### 設定ページ

[/settings](../../web/app/settings/page.tsx) ページでは、2つのボタン（日本語/English）で明示的にロケールを選択できます。

## HTML Lang属性の同期

`<html lang>` 属性は現在のロケールに合わせて自動的に更新されます：

- 日本語 → `<html lang="ja">`
- 英語 → `<html lang="en">`

これは [HtmlLangSync](../../web/src/components/HtmlLangSync.tsx) コンポーネントが処理し、ロケール変更時に副作用として属性を更新します。

## 新しい翻訳の追加

1. **両方のロケールファイルにキーを追加** (`ja.json` と `en.json`)
2. **ドット記法を使用** ネストされたキーには `"section.subsection.key"` 形式を使用
3. **ロケール間で構造を同一に保つ**
4. **両方のロケールでテスト** キーの欠落がないことを確認

例：

```json
// web/locales/ja.json
{
  "newFeature": {
    "title": "新機能",
    "description": "{count}個のアイテムがあります"
  }
}

// web/locales/en.json
{
  "newFeature": {
    "title": "New Feature",
    "description": "You have {count} items"
  }
}
```

## メトリクス

ロケール変更時に以下のイベントが送信されます：

```ts
recordMetricsEvent('settings_locale_toggle', {
  attrs: {
    from: 'ja',  // 変更前のロケール
    to: 'en',    // 変更後のロケール
  },
})
```

## テスト

- **E2E**: [accessibility.spec.ts](../../web/tests/e2e/accessibility.spec.ts) で言語切り替えをテスト
- **型安全性**: すべての翻訳キーはTypeScriptの型推論によって型安全
- **キーの欠落**: フォールバックとしてキー自体を返す（例: 見つからない場合は `"section.missing"`）

## 既知の制限事項

- **コンテンツ翻訳のみ**: ゲームメタデータ（作曲者名、曲名）はMVPでは翻訳されません
  - 将来: APIが `meta_ja` と `meta_en` フィールドを提供する可能性
- **複数形非対応**: 英語の複数形（"1 items" vs "2 items"）は処理されません
  - 回避策: 中立的な表現を使用するか、数値を文字列に含める
- **RTL非対応**: 右から左に書く言語は現在サポートされていません
- **静的なロケールリスト**: 新しい言語を追加するにはコード変更が必要

## 今後の拡張

- SEO向けのサーバーサイドロケール検出（静的エクスポートから移行時）
- 複数形ライブラリの導入（例: `i18next`, `formatjs`）
- API レスポンスでのメタデータ翻訳サポート
- デバイス間でのユーザー設定同期（認証が必要）
