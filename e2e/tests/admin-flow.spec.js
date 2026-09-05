// اختبار لوحة المسؤول: الدفعة الثالثة — التقرير المالي (أبعاد + تصدير CSV) + فلتر التاريخ في سجل النشاط.
import { test, expect } from '@playwright/test';

const PANEL = 'http://localhost:5175';

async function login(page) {
  await page.goto(`${PANEL}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type=email]').first().fill('admin@rafidain.iq');
  await page.locator('input[type=password]').first().fill('Admin@123');
  await page.getByRole('button', { name: /دخول/i }).first().click();
  await page.waitForURL(`${PANEL}/`, { timeout: 15_000 });
  await expect(page).not.toHaveURL(/login/, { timeout: 15_000 });
}

test('لوحة المسؤول: التقرير المالي + تصدير CSV + فلتر التاريخ في النشاط', async ({ page }) => {
  await login(page);

  // التقرير المالي: بطاقات الملخص + الجدول + تبديل الأبعاد
  await page.goto(`${PANEL}/financial-report`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /التقرير المالي/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.grid .stat-card').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('table').first()).toBeVisible({ timeout: 15_000 });
  const summaryCount = await page.locator('.grid .stat-card').count();
  expect(summaryCount).toBeGreaterThanOrEqual(6);

  const groupSelect = page.locator('.filters select').first();
  await groupSelect.selectOption('governorate');
  await page.waitForTimeout(1200);
  const govRows = await page.locator('table tbody tr').count();
  await groupSelect.selectOption('day');
  await page.waitForTimeout(1200);

  // تصدير CSV عبر الوكيل (blob + download)
  const dlPromise = page.waitForEvent('download', { timeout: 15_000 });
  await page.getByRole('button', { name: /تصدير CSV/ }).first().click();
  const download = await dlPromise;
  expect(download.suggestedFilename()).toMatch(/financial-report.*\.csv$/);

  // سجل النشاط: فلتر التاريخ (نطاق سليم ثم نطاق عكسي لا يكسر الصفحة)
  await page.goto(`${PANEL}/activity`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('table').first()).toBeVisible({ timeout: 15_000 });
  const dates = page.locator('.filters input[type=date]');
  await dates.nth(0).fill('2026-01-01');
  await dates.nth(1).fill('2026-12-31');
  await page.waitForTimeout(1200);
  await expect(page.locator('table').first()).toBeVisible({ timeout: 15_000 });
  await dates.nth(0).fill('2026-12-31');
  await dates.nth(1).fill('2026-01-01');
  await expect(page.locator('.toast.error').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: /سجل النشاطات/ })).toBeVisible();
});
