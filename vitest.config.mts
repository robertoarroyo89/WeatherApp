import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    // Domain logic runs in plain Node; files that need a DOM opt in with
    // `// @vitest-environment jsdom`.
    environment: 'node',
    include: ['lib/**/*.test.ts'],
    setupFiles: ['lib/testing/setupStorage.ts'],
    environmentOptions: {
      // jsdom only provides localStorage for a real origin, not about:blank.
      jsdom: { url: 'http://localhost:3000/' },
    },
  },
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, '.') },
  },
});
