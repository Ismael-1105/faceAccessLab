import { defineConfig, devices } from '@playwright/test';

/**
 * E2E de FaceAccess-Lab (Fase 4). Requiere:
 *   1. pnpm install && npx playwright install chromium
 *   2. una instancia del backend con datos sembrados:
 *      MONGODB_URI=... pnpm dev
 *   3. pnpm test:e2e
 *
 * Los tests asumen el seed por defecto (admin@faceaccess.lab / admin123 y
 * docente@faceaccess.lab / docente123) y la demo del kiosco.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    locale: 'es-EC',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'pnpm dev',
        url: 'http://localhost:3000/login',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
