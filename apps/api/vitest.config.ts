import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules',
        'test/**',
        'dist/**',
        '**/*.d.ts',
        '**/*.config.ts',
        'src/index.ts',
        'src/db/seed.ts',
        'src/db/schema.ts',
        'src/db/index.ts',
        'src/config.ts',
        'src/utils/logger.ts',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
  },
});
