import { defineConfig } from '@playwright/test';
import fs from 'node:fs';
const existing = 'C:/Users/taton/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe';
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '*.spec.ts',
  workers: 1,
  timeout: 90000,
  expect: { timeout: 20000 },
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_PATH ?? (fs.existsSync(existing) ? existing : undefined),
    },
  },
  webServer: [
    {
      command: 'node tests/e2e/mock-r2.mjs',
      url: 'http://127.0.0.1:54330/health',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'node tests/e2e/mock-supabase.mjs',
      url: 'http://127.0.0.1:54329/health',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm --filter @ann/admin dev --hostname 127.0.0.1 --port 3100',
      url: 'http://127.0.0.1:3100/login',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54329',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
        APP_ORIGIN: 'http://127.0.0.1:3100',
        NEXT_TELEMETRY_DISABLED: '1',
        ANN_E2E: '1',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role',
        R2_ACCOUNT_ID: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        R2_ACCESS_KEY_ID: 'test-r2-key',
        R2_SECRET_ACCESS_KEY: 'test-r2-secret',
        R2_STAGING_BUCKET: 'private-stage',
        R2_PUBLIC_BUCKET: 'public-images',
        R2_PUBLIC_BASE_URL: 'http://127.0.0.1:54330',
        R2_ENDPOINT: 'http://127.0.0.1:54330',
      },
    },
  ],
});
