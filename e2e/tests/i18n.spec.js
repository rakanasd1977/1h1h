// التحقق الحي من مبدّل اللغة: تبديل العربية/الإنجليزية يترجم شريط التبويبات السفلي ويقلب اتجاه الصفحة،
// ويرجّع نصوص الصفحات الرئيسية المترجمة (Home/Catalog).
import { test, expect } from '@playwright/test';
import crypto from 'node:crypto';

test('مبدّل اللغة: التبديل إلى الإنجليزية يترجم التبويبات ويقلب dir ويترجم Home/Catalog', async ({ page }) => {
  // 0) المحافظة الحالية: بوابة اختيار إلزامية (بلا «الكل»)
  await page.goto('/#/');
  await page
    .locator('.gov-gate .gov-item')
    .filter({ has: page.locator('.gov-item__name', { hasText: 'بغداد' }) })
    .first()
    .click();
  await expect(page.locator('.gov-gate')).not.toBeVisible({ timeout: 10_000 });

  // الوضع الافتراضي عربي: RTL وتبويبات عربية
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('.bottomnav__item', { hasText: 'الرئيسية' }).first()).toBeVisible();

  // مبدّل اللغة انتقل إلى صفحة الحساب بدل الرأس (تعديل مقصود)، لذا نسجّل حساباً مؤقتاً للوصول إليه
  const uniq = crypto.randomBytes(4).toString('hex');
  await page.goto('/#/register');
  const field = (label) => page.locator('.field', { hasText: label }).locator('input, textarea').first();
  await field('الاسم الكامل').waitFor({ state: 'visible' });
  await field('الاسم الكامل').fill(`زبون i18n ${uniq}`);
  await field('البريد الإلكتروني').fill(`e2e-i18n-${uniq}@rafidain.iq`);
  await field('رقم الهاتف').fill(`07${String(Date.now()).slice(-8)}`);
  await field('كلمة المرور').fill('E2ePass@123');
  await page.getByRole('button', { name: 'إنشاء الحساب' }).click();
  await page.waitForURL(/#\/verify/, { timeout: 15_000 });
  await page.getByRole('button', { name: 'تفعيل الحساب ودخول' }).click();
  // ننتظر النزول الفعلي إلى «#/» بعد إتمام التفعيل (لا نسلّم بـ«#/verify» نفسه)
  await page.waitForURL((u) => u.hash === '#/', { timeout: 15_000 });

  // نفتح صفحة الحساب من التبويب السفلي (تنقّل داخلي يبقي حالة الدخول)
  await page.locator('.bottomnav__item', { hasText: 'حسابي' }).first().click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  // نضغط «English» في قسم اللغة بصفحة الحساب
  await page.getByRole('button', { name: 'English' }).first().click();

  // بعد التبديل إلى الإنجليزية: dir=ltr و«Home» في الأسفل
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await page.goto('/#/');
  await expect(page.locator('.bottomnav__item', { hasText: 'Home' }).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.bottomnav__item', { hasText: 'الرئيسية' })).toHaveCount(0);

  // صفحة كتالوج بمزوّد غير موجود (حالة فارغة ثابتة مترجمة بالإنجليزية)
  await page.goto('/#/provider/999999999/catalog');
  await expect(page.locator('.empty__title', { hasText: 'No products found' }).first()).toBeVisible({ timeout: 10_000 });
});

test('الغلاف ثنائي اللغة يبقى عربياً افتراضياً رغم تبديل دائم بعد الجلسة', async ({ page }) => {
  // جلسة جديدة بلا تفضيل محفوظ: تبقى عربية RTL
  await page.goto('/#/');
  await page
    .locator('.gov-gate .gov-item')
    .filter({ has: page.locator('.gov-item__name', { hasText: 'بغداد' }) })
    .first()
    .click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('.bottomnav__item', { hasText: 'الرئيسية' }).first()).toBeVisible({ timeout: 10_000 });
});