// اختبار لوحة الوكيل: تسجيل الدخول + واجهات الدفعة الثانية (مخططات، تفاصيل مزود، زبائن عائدون، سجل نشاط، بث/تذكير).
import { test, expect } from '@playwright/test';

const PANEL = 'http://localhost:5174';

async function login(page) {
  await page.goto(`${PANEL}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type=email]').first().fill('agent.baghdad@rafidain.iq');
  await page.locator('input[type=password]').first().fill('Agent@123');
  await page.getByRole('button', { name: /دخول|تسجيل/i }).first().click();
  await page.waitForURL(/\/$/, { timeout: 15_000 });
  await expect(page).not.toHaveURL(/login/, { timeout: 15_000 });
}

test('لوحة الوكيل: الدفعة الثانية — مخططات، تفاصيل المزود، زبائن عائدون، بث، سجل نشاط', async ({ page }) => {
  await login(page);

  // لوحة المعلومات: المخطط المزدوج + المخطط الدائري + قائمة الانتباه
  await page.goto(`${PANEL}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.month-legend')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.donut-bar')).toBeVisible({ timeout: 10_000 });
  const attention = page.locator('.attention-list');
  if (await attention.count() > 0) await expect(attention.first()).toBeVisible({ timeout: 10_000 });
  expect(await page.locator('.month-row').count()).toBeGreaterThan(0);

  // المزودون: عمود تقييم + فرز + زر إشعار جماعي + زر عرض → صفحة التفاصيل
  await page.goto(`${PANEL}/providers`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('table th', { hasText: 'التقييم' }).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: /إشعار جماعي/i }).first()).toBeVisible();
  const sortOpts = await page.locator('.filters select').last().locator('option').allTextContents();
  expect(sortOpts.some((t) => /تقييم/i.test(t))).toBeTruthy();

  await page.getByRole('button', { name: 'عرض' }).first().click();
  await page.waitForURL(/\/providers\/\d+/, { timeout: 10_000 });
  await expect(page.locator('.kpi-row')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('h3', { hasText: /تقييمات العملاء/ })).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('h3', { hasText: /آخر حركات المحفظة/ })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: /العودة للمزودين/i }).click();
  await page.waitForURL(/\/providers$/, { timeout: 10_000 });

  // الزبائن: شريحة الزبائن العائدين
  await page.goto(`${PANEL}/customers`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.chip', { hasText: /عائدون/ })).toBeVisible({ timeout: 15_000 });
  await page.locator('.chip', { hasText: /عائدون/ }).click();
  await page.waitForTimeout(1000);

  // الطلبات: زر تذكير المعلقات
  await page.goto(`${PANEL}/orders`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: /تذكير المعلقات/i })).toBeVisible({ timeout: 15_000 });

  // سجل النشاط: جدول + فلتر
  await page.goto(`${PANEL}/activity`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('table').first()).toBeVisible({ timeout: 15_000 });
  expect(await page.locator('table tbody tr').count()).toBeGreaterThan(0);
  await page.locator('.filters select').first().selectOption('order_status');
  await page.waitForTimeout(1000);
});
