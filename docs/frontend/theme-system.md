# テーマシステム

## 概要

VGM Quiz は [`next-themes`](https://github.com/pacocoursey/next-themes) を使用して、Light、Dark、Auto（システム設定に追従）の3つのテーマモードをサポートしています。

## アーキテクチャ

### プロバイダーの設定

テーマシステムは [app/layout.tsx](../../web/app/layout.tsx) のルートレベルで初期化されます：

```tsx
<ThemeProvider>
  <HtmlLangSync />
  <MswBoot />
  {children}
</ThemeProvider>
```

### ストレージ

- **キー**: `vgm2.settings.theme`
- **保存先**: `localStorage`
- **値**: `"light"`, `"dark"`, `"system"`
- **デフォルト**: `"system"` (OS/ブラウザの設定に追従)

### 実装ファイル

- [web/src/lib/theme.ts](../../web/src/lib/theme.ts) — テーマの型定義とストレージユーティリティ
- [web/src/components/ThemeProvider.tsx](../../web/src/components/ThemeProvider.tsx) — `next-themes` のラッパー
- [web/src/components/ThemeToggle.tsx](../../web/src/components/ThemeToggle.tsx) — テーマ切り替えUIコンポーネント
- [web/app/globals.css](../../web/app/globals.css) — ライト/ダークテーマ用のCSSカスタムプロパティ

## CSS変数

テーマカラーは `globals.css` でCSSカスタムプロパティとして定義されています：

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --card: 0 0% 100%;
    /* ... */
  }

  .dark {
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
    --card: 240 10% 3.9%;
    /* ... */
  }
}
```

すべてのUIコンポーネントは、ハードコードされた色クラスの代わりにセマンティックトークン（例: `bg-background`, `text-foreground`）を使用します。

## 使い方

### コンポーネント内での使用

```tsx
import { useTheme } from 'next-themes'

function MyComponent() {
  const { theme, setTheme, resolvedTheme } = useTheme()

  return (
    <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
      Current: {resolvedTheme}
    </button>
  )
}
```

### ThemeToggleコンポーネント

[ThemeToggle](../../web/src/components/ThemeToggle.tsx) コンポーネントは、1つのボタンでテーマを順次切り替えます：

- クリック → Light → Dark → Auto → Light... の順に切り替わる
- 現在解決されているテーマをアイコン付きで表示
- `settings_theme_toggle` メトリクスイベントを記録

### 設定ページ

[/settings](../../web/app/settings/page.tsx) ページでは、3つのボタン（Light/Dark/Auto）で明示的にテーマを選択できます。

## アクセシビリティ

- **ARIA**: テーマ切り替えボタンには、現在の状態とアクションを説明する `aria-label` が含まれています
- **フォーカス**: ライト・ダークの両テーマで表示される、視認可能なフォーカスインジケーター
- **コントラスト**: すべてのテーマの組み合わせがWCAG AAのコントラスト比を満たしています（axe-coreでテスト済み）
- **トランジション**: テーマ切り替え時のフラッシュを防ぐため、トランジションを無効化（`disableTransitionOnChange`）

## メトリクス

テーマ変更時に以下のイベントが送信されます：

```ts
recordMetricsEvent('settings_theme_toggle', {
  attrs: {
    from: 'light', // 変更前のテーマ
    to: 'dark',    // 変更後のテーマ
  },
})
```

## テスト

- **E2E**: [accessibility.spec.ts](../../web/tests/e2e/accessibility.spec.ts) でライト・ダークモード両方のWCAG準拠を検証
- **ユニット**: `theme.ts` のテーマユーティリティはエッジケース（SSR、ストレージエラー）を処理

## 既知の制限事項

- テーマの設定はローカルのみ保存（デバイス間で同期されない）
- システムテーマ検出は `prefers-color-scheme` メディアクエリに依存（IE11は非対応）
- `<html>` タグの `suppressHydrationWarning` でFOUC（スタイル未適用のフラッシュ）を防止
