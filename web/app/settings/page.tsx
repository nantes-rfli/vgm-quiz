"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useTheme } from "next-themes"
import { useI18n } from "@/src/lib/i18n"
import { type Locale } from "@/src/lib/locale"
import InlinePlaybackToggle from "@/src/components/InlinePlaybackToggle"
import { recordMetricsEvent } from "@/src/lib/metrics/metricsClient"

export default function SettingsPage() {
  const { t, locale, setLocale } = useI18n()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [storageData, setStorageData] = useState<Record<string, string>>({})

  useEffect(() => {
    setMounted(true)
    // Load all localStorage data
    const data: Record<string, string> = {}
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith("vgm2.")) {
        data[key] = localStorage.getItem(key) || ""
      }
    }
    setStorageData(data)
  }, [])

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme)
    recordMetricsEvent("settings_theme_toggle", {
      attrs: {
        from: theme || "system",
        to: newTheme,
      },
    })
  }

  const handleLocaleChange = (newLocale: string) => {
    setLocale(newLocale as Locale)
    recordMetricsEvent("settings_locale_toggle", {
      attrs: {
        from: locale,
        to: newLocale,
      },
    })
  }

  const handleReset = () => {
    if (confirm(t("settings.resetConfirm"))) {
      // Clear all vgm2.* keys
      Object.keys(storageData).forEach((key) => {
        localStorage.removeItem(key)
      })
      sessionStorage.clear()
      setStorageData({})
      alert(t("settings.resetSuccess"))
      window.location.href = "/"
    }
  }

  if (!mounted) {
    return null
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">{t("settings.title")}</h1>

        {/* Theme setting */}
        <section className="mb-8 p-6 bg-card rounded-lg border border-border">
          <h2 className="text-xl font-semibold mb-4">{t("settings.theme")}</h2>
          <div className="flex gap-2">
            <button
              onClick={() => handleThemeChange("light")}
              className={`px-4 py-2 rounded-md border transition-colors ${
                theme === "light"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-card-foreground border-border hover:bg-accent"
              }`}
            >
              {t("settings.themeLight")}
            </button>
            <button
              onClick={() => handleThemeChange("dark")}
              className={`px-4 py-2 rounded-md border transition-colors ${
                theme === "dark"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-card-foreground border-border hover:bg-accent"
              }`}
            >
              {t("settings.themeDark")}
            </button>
            <button
              onClick={() => handleThemeChange("system")}
              className={`px-4 py-2 rounded-md border transition-colors ${
                theme === "system" || !theme
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-card-foreground border-border hover:bg-accent"
              }`}
            >
              {t("settings.themeAuto", { resolved: resolvedTheme || "system" })}
            </button>
          </div>
        </section>

        {/* Language setting */}
        <section className="mb-8 p-6 bg-card rounded-lg border border-border">
          <h2 className="text-xl font-semibold mb-4">{t("settings.locale")}</h2>
          <div className="flex gap-2">
            <button
              onClick={() => handleLocaleChange("ja")}
              className={`px-4 py-2 rounded-md border transition-colors ${
                locale === "ja"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-card-foreground border-border hover:bg-accent"
              }`}
            >
              {t("settings.localeJa")}
            </button>
            <button
              onClick={() => handleLocaleChange("en")}
              className={`px-4 py-2 rounded-md border transition-colors ${
                locale === "en"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-card-foreground border-border hover:bg-accent"
              }`}
            >
              {t("settings.localeEn")}
            </button>
          </div>
        </section>

        {/* Inline Playback setting */}
        <section className="mb-8 p-6 bg-card rounded-lg border border-border">
          <h2 className="text-xl font-semibold mb-2">
            {t("settings.inlinePlayback")}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            {t("settings.inlinePlaybackDesc")}
          </p>
          <InlinePlaybackToggle />
        </section>

        {/* Storage usage */}
        <section className="mb-8 p-6 bg-card rounded-lg border border-border">
          <h2 className="text-xl font-semibold mb-4">
            {t("settings.storageUsage")}
          </h2>
          <div className="space-y-2">
            {Object.entries(storageData).map(([key, value]) => (
              <div
                key={key}
                className="flex justify-between items-start p-2 bg-muted rounded text-sm"
              >
                <span className="font-mono text-xs break-all mr-2">{key}</span>
                <span className="text-muted-foreground text-xs">
                  {value.length} chars
                </span>
              </div>
            ))}
            {Object.keys(storageData).length === 0 && (
              <p className="text-muted-foreground text-sm">No data stored</p>
            )}
          </div>
        </section>

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={handleReset}
            className="px-6 py-3 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors"
          >
            {t("settings.resetSettings")}
          </button>
          <Link
            href="/"
            className="px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors inline-block"
          >
            {t("settings.backToHome")}
          </Link>
        </div>
      </div>
    </div>
  )
}
