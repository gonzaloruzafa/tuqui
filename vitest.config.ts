/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'lib/**/__tests__/*.test.ts'],
    globals: true,
    testTimeout: 60000,  // 60s for E2E tests
    setupFiles: ['./tests/setup.ts'],  // Load env vars
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
