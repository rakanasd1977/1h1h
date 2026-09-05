// دورة النزاع والفواتير (Item 4): ينشئ الزبون طلباً (API) → يُكمل المزوّد حالته →
// يفتح الزبون نزاعاً من واجهة الزبون ويعرض الفاتورة → يحسم المسؤول النزاع من لوحة الإدارة.
import { test, expect } from '@playwright/test';
import crypto from 'node:crypto';

const CUSTOMER = 'http://localhost:5173';
const ADMIN = 'http://localhost:5175';
const uniq = crypto.randomBytes(4).toString('hex');

// نستخدم زبون البذر الموثّق مسبقاً (يفتح الطلب ويصعد حالته عبر API لاختبار النزاع/الفاتورة).
const customerEmail = 'customer.demo@rafidain.iq';
const password = 'Customer@123';

// حماية CSRF: نقرأ كعكة rafidain_csrf من سياق الطلب ونرسلها كرأس (مثل الواجهة).
// يستخدم page.request لأن تسجيل الدخول عبره يخزّن كعكات الجلسة داخل سياق المتصفح.
async function apiReq(page, method, url, { token, data } = {}) {
  let headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (method !== 'GET' && method !== 'HEAD') {
    try {
      const csrf = (await page.request.storageState().then((s) => (s.cookies || [])))
        .find((c) => c.name === 'rafidain_csrf' || c.name === '__Host-rafidain_csrf');
      if (csrf) headers['X-CSRF-Token'] = csrf.value;
    } catch (e) {}
  }
  return page.request[method.toLowerCase()](url, { headers, data });
}

test('نزاع وفاتورة: زبون يفتح نزاعاً، يعرض الفاتورة، والمسؤول يحسمه (UI)', async ({ page, browser }) => {
  // 0) تسجيل دخول زبون البذر (API عبر سياق المتصفح) للحصول على التوكن والجلسة/CSRF
  let r = await apiReq(page, 'POST', '/api/auth/login', {
    data: { email: customerEmail, password, role: 'customer' },
  });
  expect(r.ok(), 'تسجيل دخول زبون البذر').toBeTruthy();
  const customerToken = (await r.json()).data.token;

  // حقن مستخدم موثّق في localStorage قبل تحميل الواجهة حتى لا تُعيد التوجيه/البوابة
  // بينما كعكة الجلسة من page.request تُثبّت طلبات customerApi فعلياً.
  const meRes = await apiReq(page, 'GET', '/api/auth/me', { token: customerToken }).then((x) => x.json());
  const meUser = (meRes && meRes.data) ? meRes.data : null;
  await page.addInitScript((u) => {
    try { localStorage.setItem('user', JSON.stringify(u || null)); } catch (e) {}
  }, meUser);

  // 1) اختيار متجر حي وأول منتج (قراءة عبر سياق المتصفح)
  const providers = await apiReq(page, 'GET', '/api/public/providers?limit=100').then((x) => x.json());
  const store = (providers.data || []).find((p) => p.service_slug === 'stores');
  expect(store, 'متجر تجريبي').toBeTruthy();
  const products = await apiReq(page, 'GET', `/api/public/providers/${store.id}/products?limit=10`).then((x) => x.json());
  expect((products.data || []).length).toBeGreaterThan(0);
  const product = products.data[0];

  // 2) إنشاء طلب (API عبر سياق المتصفح) بالحالة pending
  r = await apiReq(page, 'POST', '/api/orders', {
    token: customerToken,
    data: {
      provider_id: store.id,
      customer_name: `زبون نزاع ${uniq}`,
      customer_phone: `07${String(Date.now()).slice(-8)}`,
      items: [{ kind: 'products', item_id: product.id, quantity: 1 }],
    },
  });
  expect(r.ok(), `إنشاء الطلب: ${r.status()} ${JSON.stringify(await r.json().catch(() => ({})))}`).toBeTruthy();
  const orderId = (await r.json()).data.id;

  // 3) شحن محفظة المزود (مسؤول) ثم يحرّك المزوّد حالة الطلب حتى completed
  //    نستخدم سياقات متصفح مستقلة لكل دور حتى لا تتضارب كعكات الجلسة/CSRF مع الزبون.
  const adminCtx = await browser.newContext({ baseURL: CUSTOMER });
  const adminCtxReq = adminCtx.request;
  const admLogin = await adminCtxReq.post('/api/auth/login', {
    data: { email: 'admin@rafidain.iq', password: 'Admin@123', role: 'admin' },
  });
  expect(admLogin.ok()).toBeTruthy();
  const adminToken = (await admLogin.json()).data.token;
  const adminCsrf = (await adminCtxReq.storageState().then((s) => (s.cookies || [])))
    .find((c) => c.name === 'rafidain_csrf');
  const fund = await adminCtxReq.post(`/api/wallets/${store.id}/recharge`, {
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json', 'X-CSRF-Token': adminCsrf?.value },
    data: { amount: 100000 },
  });
  expect(fund.ok(), `شحن محفظة المزود: ${fund.status()}`).toBeTruthy();
  await adminCtx.close();

  const provCtx = await browser.newContext({ baseURL: CUSTOMER });
  const provCtxReq = provCtx.request;
  const provLogin = await provCtxReq.post('/api/auth/login', {
    data: { email: 'provider.demo@rafidain.iq', password: 'Provider@123', role: 'provider' },
  });
  expect(provLogin.ok()).toBeTruthy();
  const providerToken = (await provLogin.json()).data.token;
  const provCsrf = (await provCtxReq.storageState().then((s) => (s.cookies || [])))
    .find((c) => c.name === 'rafidain_csrf');
  for (const st of ['confirmed', 'in_progress', 'completed']) {
    const up = await provCtxReq.put(`/api/orders/${orderId}/status`, {
      headers: {
        Authorization: `Bearer ${providerToken}`,
        'Content-Type': 'application/json',
        ...(provCsrf ? { 'X-CSRF-Token': provCsrf.value } : {}),
      },
      data: { status: st },
    });
    expect(up.ok(), `حالة ${st} (${up.status()} ${JSON.stringify(await up.json().catch(() => ({})))})`).toBeTruthy();
  }
  await provCtx.close();

  // 4) فتح النزاع عبر واجهة الزبون (الواجهة تتطلب بوابة المحافظة أولاً)
  await page.goto(`${CUSTOMER}/#/`);
  const gate = page.locator('.gov-gate');
  if (await gate.count()) {
    await gate.locator('.gov-item').filter({ has: page.locator('.gov-item__name', { hasText: 'بغداد' }) }).first().click();
  }

  // نفتح صفحة الطلب ونتحقق من ظهور زر «فتح نزاع»
  await page.goto(`${CUSTOMER}/#/orders/${orderId}`);
  await expect(page.getByRole('button', { name: /فتح نزاع/i }).first()).toBeVisible({ timeout: 20_000 });

  // فتح النزاع بدون سبب → رسالة تنبيه
  await page.getByRole('button', { name: /فتح نزاع/i }).first().click();
  await page.locator('textarea').first().waitFor({ state: 'visible', timeout: 10_000 });
  await page.getByRole('button', { name: /إرسال النزاع/i }).click();
  await expect(page.getByText(/يرجى كتابة سبب النزاع/i)).toBeVisible({ timeout: 10_000 });

  // نكتب السبب ونرسل
  await page.locator('textarea').first().fill('المنتج وصل تالفاً');
  await page.getByRole('button', { name: /إرسال النزاع/i }).click();
  await expect(page.getByText(/تم فتح النزاع بنجاح/i)).toBeVisible({ timeout: 10_000 });

  // عرض الفاتورة
  await page.getByRole('button', { name: /^فاتورة$/i }).first().click();
  await expect(page.getByText(/INV-/i).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/الإجمالي/i).first()).toBeVisible();

  // 5) صفحة النزاعات تظهر النزاع
  await page.goto(`${CUSTOMER}/#/disputes`);
  await expect(page.locator('.card').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/المنتج وصل تالفاً/i).first()).toBeVisible({ timeout: 10_000 });

  // 6) المسؤول يحسم النزاع من لوحة الإدارة (سياق متصفح مستقل — كعكة الزبون لا تنطبق على الإدارة)
  const adminCtx2 = await browser.newContext({ baseURL: ADMIN });
  await adminCtx2.request.post('/api/auth/login', {
    data: { email: 'admin@rafidain.iq', password: 'Admin@123', role: 'admin' },
  });
  const adminPage = await adminCtx2.newPage();
  await adminPage.goto(`${ADMIN}/disputes`, { waitUntil: 'domcontentloaded' });
  await expect(adminPage.getByRole('heading', { name: /النزاعات/i }).first()).toBeVisible({ timeout: 20_000 });
  await expect(adminPage.getByText(/المنتج وصل تالفاً/i).first()).toBeVisible({ timeout: 20_000 });

  // نختار أول نزاع مفتوح ونرفضه (أبسط — لا يخصم رصيد)
  const row = adminPage.locator('tbody tr', { hasText: /المنتج وصل تالفاً/i }).first();
  await row.getByRole('button', { name: /رفض/i }).click();
  await expect(adminPage.locator('.modal').getByRole('heading', { name: /رفض النزاع/i })).toBeVisible({ timeout: 10_000 });
  await adminPage.locator('.modal textarea').first().fill('لم يثبت الضرر');
  await adminPage.locator('.modal').getByRole('button', { name: /نعم، رفض/i }).click();
  await expect(adminPage.locator('.modal')).not.toBeVisible({ timeout: 10_000 });
  await adminCtx2.close();

  // 7) التأكيد الخلفي: النزاع أصبح مرفوضاً (قراءة عبر سياق المتصفح)
  const disputes = await apiReq(page, 'GET', '/api/disputes?limit=50', { token: customerToken }).then((x) => x.json());
  const mine = (disputes.data || []).find((d) => d.order_id === orderId);
  expect(mine && mine.status).toBe('rejected');
  expect(mine && mine.resolution).toContain('لم يثبت الضرر');
});