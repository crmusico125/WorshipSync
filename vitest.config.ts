import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'url'

export default defineConfig({
  resolve: {
    alias: {
      '@test': fileURLToPath(new URL('./test', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    include: ['src/main/**/*.test.ts'],
    testTimeout: 15000,
  },
})
