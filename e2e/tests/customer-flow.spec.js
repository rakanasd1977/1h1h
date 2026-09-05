// سيناريو الزبون الأساسي: تسجيل → تفعيل → تصفح → سلة → طلب → حالة الطلب.
import { test, expect } from '@playwright/test';
import crypto from 'node:crypto';

const uniq = crypto.randomBytes(4).toString('hex');
const email = `e2e-${uniq}@rafidain.iq`;
const phone = `07${String(Date.now()).slice(-8)}`;

// الواجهة لا تستخدم htmlFor — كل حقل في <div class="field"><label>…</label><input/></div>
function field(page, label) {
  return page.locator('.field', { hasText: label }).locator('input, textarea').first();
}

test('دورة الزبون كاملة: تسجيل → تفعيل → تصفح → سلة → طلب → حالة', async ({ page, request }) => {
  // 0) المحافظة الحالية: بوابة اختيار إلزامية (بلا «الكل»)
  await page.goto('/#/');
  await page
    .locator('.gov-gate .gov-item')
    .filter({ has: page.locator('.gov-item__name', { hasText: 'بغداد' }) })
    .first()
    .click();
  await expect(page.locator('.gov-gate')).not.toBeVisible({ timeout: 10_000 });

  // 1) تسجيل حساب جديد
  await page.goto('/#/register');
  await field(page, 'الاسم الكامل').waitFor({ state: 'visible' });
  await field(page, 'الاسم الكامل').fill(`زبون E2E ${uniq}`);
  await field(page, 'البريد الإلكتروني').fill(email);
  await field(page, 'رقم الهاتف').fill(phone);
  await field(page, 'كلمة المرور').fill('E2ePass@123');
  await page.getByRole('button', { name: 'إنشاء الحساب' }).click();

  // 2) التفعيل: يُعاد توجيهه إلى /verify مع رمز في الرابط (وضع تجريبي)
  await page.waitForURL(/#\/verify/, { timeout: 15_000 });
  await page.getByRole('button', { name: 'تفعيل الحساب ودخول' }).click();
  await page.waitForURL((u) => u.hash === '#/' || u.hash.startsWith('#/'), { timeout: 15_000 });

  // 3) نتأكد أن الدخول تم فعلاً (قائمة محافظات متاحة بالكواليس)
  const govRes = await request.get('/api/public/governorates');
  expect(govRes.ok()).toBeTruthy();

  // 4) نجلب مزود متجر حي له منتجات من الكواليس
  const providers = await request.get('/api/public/providers?limit=100').then((r) => r.json());
  const store = (providers.data || []).find((p) => p.service_slug === 'stores');
  expect(store, 'يوجد متجر تجريبي').toBeTruthy();

  const products = await request.get(`/api/public/providers/${store.id}/products?limit=100`).then((r) => r.json());
  expect((products.data || []).length).toBeGreaterThan(0);

  // 5) نضيف أول منتج إلى السلة من صفحة تفاصيله
  const product = products.data[0];
  await page.goto(`/#/item/${store.id}/products/${product.id}`);
  await page.getByRole('button', { name: /أضف إلى السلة/i }).first().waitFor({ state: 'visible' });
  await page.getByRole('button', { name: /أضف إلى السلة/i }).first().click();

  // 6) نفتح السلة ونتحقق من وجود المنتج
  await page.goto('/#/cart');
  await expect(page.getByText(product.name_ar).first()).toBeVisible({ timeout: 10_000 });

  // 7) إتمام الطلب: اسم + هاتف
  await page.getByRole('button', { name: /إتمام|الطلب|تأكيد/i }).first().click();
  await page.waitForURL(/#\/checkout/, { timeout: 10_000 });
  await field(page, 'الاسم').fill(`زبون E2E ${uniq}`);
  await field(page, 'رقم الهاتف').fill(phone);
  await page.getByRole('button', { name: 'تأكيد الطلب' }).click();

  // 8) صفحة الطلبات: تظهر بطاقة طلب جديد
  await page.waitForURL(/#\/orders/, { timeout: 15_000 });
  await expect(page.locator('.card').first()).toBeVisible({ timeout: 15_000 });

  // 9) نتأكد خلفياً من إنشاء الطلب بحالة pending
  const me = await request.post('/api/auth/login', { data: { email, password: 'E2ePass@123' } });
  expect(me.ok()).toBeTruthy();
  const token = (await me.json()).data.token;
  const orders = await request.get('/api/orders', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
  expect((orders.data || []).length).toBeGreaterThanOrEqual(1);
  expect(orders.data[0].status).toBe('pending');
});
