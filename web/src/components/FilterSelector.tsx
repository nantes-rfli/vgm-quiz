'use client'

import React, { useState } from 'react'
import { useI18n } from '@/src/lib/i18n'
import { useFilter } from '@/src/lib/filter-context'
import { useManifest } from '@/src/lib/use-manifest'
import type { Difficulty, Era, RoundStartRequest } from '@/src/features/quiz/api/manifest'

export interface FilterSelectorProps {
  onStart: (params: Partial<RoundStartRequest>) => void
  disabled?: boolean
}

export default function FilterSelector({
  onStart,
  disabled = false,
}: FilterSelectorProps) {
  const { t } = useI18n()
  const { filters, setDifficulty, setEra, setSeries, reset, isDefault } = useFilter()
  const { manifest } = useManifest()
  const [isLoading, setIsLoading] = useState(false)

  const handleDifficultyChange = (difficulty: Difficulty | '') => {
    setDifficulty(difficulty ? (difficulty as Difficulty) : 'mixed')
  }

  const handleEraChange = (era: Era | '') => {
    setEra(era ? (era as Era) : 'mixed')
  }

  const handleSeriesToggle = (series: string) => {
    const newSeries = filters.series.includes(series)
      ? filters.series.filter((s) => s !== series)
      : [...filters.series, series]
    setSeries(newSeries)
  }

  const handleReset = () => {
    reset()
  }

  const handleStart = async () => {
    setIsLoading(true)
    try {
      const params: Partial<RoundStartRequest> = {}

      // Only include non-default values in the request
      if (filters.difficulty && filters.difficulty !== 'mixed') {
        params.difficulty = filters.difficulty as Difficulty
      }
      if (filters.era && filters.era !== 'mixed') {
        params.era = filters.era as Era
      }
      if (filters.series.length > 0) {
        params.series = filters.series
      }

      onStart(params)
    } finally {
      setIsLoading(false)
    }
  }

  const difficultyOptions = manifest.facets.difficulty.filter((d) => d !== 'mixed')
  const eraOptions = manifest.facets.era.filter((e) => e !== 'mixed')
  const seriesOptions = manifest.facets.series.filter((s) => s !== 'mixed')

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-card rounded-2xl shadow p-6 mb-4 border border-border">
        <h2 className="text-2xl font-semibold mb-2 text-card-foreground">
          {t('filter.title')}
        </h2>
        <p className="text-sm text-muted-foreground mb-6">{t('filter.description')}</p>

        {/* Difficulty Section */}
        <div className="mb-8">
          <label className="block text-lg font-medium mb-3 text-card-foreground">
            {t('filter.difficulty.label')}
          </label>
          <div className="flex gap-3 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="difficulty"
                value="mixed"
                checked={!filters.difficulty || filters.difficulty === 'mixed'}
                onChange={() => handleDifficultyChange('mixed')}
                disabled={disabled || isLoading}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-sm">{t('filter.difficulty.mixed')}</span>
            </label>
            {difficultyOptions.map((d) => (
              <label key={d} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="difficulty"
                  value={d}
                  checked={filters.difficulty === d}
                  onChange={() => handleDifficultyChange(d as Difficulty)}
                  disabled={disabled || isLoading}
                  className="w-4 h-4 accent-primary"
                />
                <span className="text-sm">
                  {t(`filter.difficulty.${String(d)}`)}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Era Section */}
        <div className="mb-8">
          <label className="block text-lg font-medium mb-3 text-card-foreground">
            {t('filter.era.label')}
          </label>
          <div className="flex gap-3 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                value="mixed"
                checked={!filters.era || filters.era === 'mixed'}
                onChange={() => handleEraChange('mixed')}
                disabled={disabled || isLoading}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-sm">{t('filter.era.mixed')}</span>
            </label>
            {eraOptions.map((e) => (
              <label key={e} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  value={e}
                  checked={filters.era === e}
                  onChange={() => handleEraChange(e as Era)}
                  disabled={disabled || isLoading}
                  className="w-4 h-4 accent-primary"
                />
                <span className="text-sm">{t(`filter.era.${String(e)}`)}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Series Section */}
        <div className="mb-8">
          <label className="block text-lg font-medium mb-3 text-card-foreground">
            {t('filter.series.label')}
          </label>
          <div className="flex gap-3 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.series.length === 0}
                onChange={() => setSeries([])}
                disabled={disabled || isLoading}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-sm">{t('filter.series.mixed')}</span>
            </label>
            {seriesOptions.map((s) => (
              <label key={s} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  value={s}
                  checked={filters.series.includes(s)}
                  onChange={() => handleSeriesToggle(s)}
                  disabled={disabled || isLoading}
                  className="w-4 h-4 accent-primary"
                />
                <span className="text-sm">{t(`filter.series.${String(s)}`)}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Preset Button */}
        <div className="mb-6">
          <button
            type="button"
            onClick={handleReset}
            disabled={disabled || isLoading || isDefault()}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {t('filter.preset.daily')}
          </button>
        </div>

        {/* Start Button */}
        <button
          type="button"
          onClick={handleStart}
          disabled={disabled || isLoading}
          className="w-full px-4 py-3 font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? '...' : t('filter.start')}
        </button>
      </div>
    </div>
  )
}
