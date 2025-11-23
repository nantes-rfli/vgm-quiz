'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react'
import type { Difficulty, Era } from '@/src/features/quiz/api/manifest'

export interface FilterState {
  difficulty?: Difficulty
  era?: Era
  series: string[]
  mode?: string
}

const defaultFilters: FilterState = {
  difficulty: 'mixed',
  era: 'mixed',
  series: [],
  mode: undefined,
}

const FilterContext = createContext<{
  filters: FilterState
  setDifficulty: (difficulty?: Difficulty) => void
  setEra: (era?: Era) => void
  setSeries: (series: string[]) => void
  setMode: (mode?: string) => void
  reset: () => void
  isDefault: () => boolean
}>({
  filters: defaultFilters,
  setDifficulty: () => {},
  setEra: () => {},
  setSeries: () => {},
  setMode: () => {},
  reset: () => {},
  isDefault: () => true,
})

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<FilterState>(defaultFilters)

  const setDifficulty = (difficulty?: Difficulty) => {
    setFilters((prev) => ({
      ...prev,
      difficulty: difficulty || 'mixed',
    }))
  }

  const setEra = (era?: Era) => {
    setFilters((prev) => ({
      ...prev,
      era: era || 'mixed',
    }))
  }

  const setSeries = (series: string[]) => {
    setFilters((prev) => ({
      ...prev,
      series: series.filter((s) => s && s !== 'mixed'),
    }))
  }

  const setMode = (mode?: string) => {
    setFilters((prev) => ({
      ...prev,
      mode: mode || undefined,
    }))
  }

  const reset = () => {
    setFilters(defaultFilters)
  }

  const isDefault = () => {
    return (
      (filters.difficulty === 'mixed' || filters.difficulty === undefined) &&
      (filters.era === 'mixed' || filters.era === undefined) &&
      filters.series.length === 0 &&
      !filters.mode
    )
  }

  return (
    <FilterContext.Provider
      value={{
        filters,
        setDifficulty,
        setEra,
        setSeries,
        setMode,
        reset,
        isDefault,
      }}
    >
      {children}
    </FilterContext.Provider>
  )
}

export function useFilter() {
  const context = useContext(FilterContext)
  if (!context) {
    throw new Error('useFilter must be used within FilterProvider')
  }
  return context
}
