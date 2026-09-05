// إعداد مخصّص لاختبار قسم «الأكثر طلباً»: يعيد استخدام الخوادم العاملة حالياً
// (المنافذ 4001/5173/...) بدل تشغيل خوادم جديدة، لتجنّب تعارض المنافذ أثناء التطوير.
import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    locale: 'ar-IQ',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], ...(process.env.CI ? {} : { channel: 'chrome' }) } },
  ],
  webServer: [
    { command: 'npx tsx e2e/server.cjs', port: 4001, reuseExistingServer: true, timeout: 30_000, cwd: root },
    { command: 'npm run dev', port: 5173, reuseExistingServer: true, timeout: 60_000, cwd: path.join(root, 'customer-mobile') },
  ],
});
