// اختبار النشر عبر nginx المحلي: الواجهات تُقدَّم من dist والـ /api يعمل عبر الوكيل.
// يُتخطى تلقائياً إذا لم يكن nginx مشغلاً على المنافذ 8081/8083.
import { test, expect } from '@playwright/test';

const BASE_CUSTOMER = 'http://localhost:8081';
const BASE_ADMIN = 'http://localhost:8083';

async function up(url) {
  try { const r = await fetch(url, { signal: AbortSignal.timeout(3000) }); return r.status < 500; }
  catch { return false; }
}

test('النشر عبر nginx: الزبون يعمل ولوحة المسؤول تسجّل وتصل للتقرير المالي', async ({ page }) => {
  test.skip(!(await up(BASE_CUSTOMER + '/')), 'nginx غير مشغل — تشغيل: deploy/start-nginx.ps1');

  // تطبيق الزبون عبر nginx (محتوى + بروكسي api سليم)
  await page.goto(`${BASE_CUSTOMER}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('اختر محافظتك')).toBeVisible({ timeout: 15_000 });

  // لوحة المسؤول عبر nginx: دخول + التقرير المالي عبر الوكيل
  await page.goto(`${BASE_ADMIN}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type=email]').first().fill('admin@rafidain.iq');
  await page.locator('input[type=password]').first().fill('Admin@123');
  await page.getByRole('button', { name: /دخول/i }).first().click();
  await page.waitForURL(`${BASE_ADMIN}/`, { timeout: 15_000 });
  await page.goto(`${BASE_ADMIN}/financial-report`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.grid .stat-card').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('table').first()).toBeVisible({ timeout: 15_000 });
});
