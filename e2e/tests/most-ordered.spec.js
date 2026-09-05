// اختبار E2E مخصّص: قسم «الأكثر طلباً» يعرض منتجات فعلية حسب المبيعات
// (بالإضافة إلى إعلانات مموّلة من الإدارة إن وُجدت).
import { test, expect } from '@playwright/test';

test('قسم الأكثر طلباً يعرض منتجات حقيقية بعد اختيار المحافظة', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });

  // بوابة اختيار المحافظة (إن ظهرت)
  const baghdad = page.getByText('بغداد', { exact: true });
  if (await baghdad.count()) {
    await baghdad.first().click();
    await page.waitForTimeout(1000);
  }

  // عنوان القسم ظاهر
  await expect(page.getByText('الأكثر طلباً', { exact: false }).first()).toBeVisible({ timeout: 15000 });

  // بطاقات منتجات حقيقية
  await expect(page.locator('.product-card').first()).toBeVisible({ timeout: 15000 });
  const productCount = await page.locator('.product-card').count();
  expect(productCount).toBeGreaterThanOrEqual(1);

  // علامة المباعات تظهر (باع/طلب)
  await expect(page.getByText(/باع|طلب/, { exact: false }).first()).toBeVisible({ timeout: 15000 });
});
