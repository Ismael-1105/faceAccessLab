import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: [
        'lib/auth.ts',
        'lib/rbac.ts',
        'lib/kiosk-verification.ts',
        'lib/attendance-idempotency.ts',
        'lib/scheduling.ts',
        'lib/evidence.ts',
        'lib/biometrics.ts',
        'lib/csrf.ts',
        'lib/rate-limit.ts',
        'lib/distributed-rate-limit.ts',
        'lib/validation.ts',
        'lib/consent.ts',
      ],
      thresholds: {
        statements: 75,
        branches: 65,
        functions: 75,
        lines: 75,
      },
      reportsDirectory: 'coverage',
    },
  },
});
