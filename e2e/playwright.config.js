// إعداد Playwright لاختبارات E2E لتطبيق الزبون.
// يشغّل خادم API على قاعدة مؤقتة (e2e/server.cjs) ثم واجهة الزبون عبر Vite (منفذ 5173).
import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    locale: 'ar-IQ',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], ...(process.env.CI ? {} : { channel: 'chrome' }) } },
  ],
  webServer: [
    {
      command: 'npx tsx e2e/server.cjs',
      port: 4001,
      reuseExistingServer: false,
      timeout: 30_000,
      cwd: root,
    },
    {
      command: 'npm run dev',
      port: 5173,
      reuseExistingServer: false,
      timeout: 60_000,
      cwd: path.join(root, 'customer-mobile'),
    },
    {
      command: 'npm run dev',
      port: 5174,
      reuseExistingServer: false,
      timeout: 60_000,
      cwd: path.join(root, 'agent-panel'),
    },
    {
      command: 'npm run dev',
      port: 5175,
      reuseExistingServer: false,
      timeout: 60_000,
      cwd: path.join(root, 'admin-panel'),
    },
    {
      command: 'npm run dev',
      port: 5176,
      reuseExistingServer: false,
      timeout: 60_000,
      cwd: path.join(root, 'provider-panel'),
    },
  ],
});
