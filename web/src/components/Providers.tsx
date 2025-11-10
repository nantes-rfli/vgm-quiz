'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode } from 'react'
import MswBoot from '@/app/_msw'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { THEME_STORAGE_KEY } from '@/src/lib/theme'
import { queryClient } from '@/src/lib/query-client'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <>
      {/* MSW must be initialized before QueryClientProvider to properly intercept fetch calls */}
      <MswBoot />
      <QueryClientProvider client={queryClient}>
        <NextThemesProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          storageKey={THEME_STORAGE_KEY}
          disableTransitionOnChange
        >
          {children}
        </NextThemesProvider>
      </QueryClientProvider>
    </>
  )
}
