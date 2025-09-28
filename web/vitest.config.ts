import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/unit/setup.ts'],
    include: ['tests/unit/**/*.spec.ts'],
    clearMocks: true,
  },
  resolve: {
    alias: {
      '@/': `${path.resolve(__dirname, './')}/`,
    },
  },
});
