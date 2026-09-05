const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

process.env.NODE_ENV = 'test';
process.env.DB_PATH = path.join(os.tmpdir(), `rafidain-notifprefs-${process.pid}-${crypto.randomUUID()}.db`);
process.env.JWT_SECRET = 'notifprefs-test-secret';
process.env.RATE_LIMIT_MAX = '100000';
delete process.env.TRUST_PROXY;

require('../src/db/seed');

const app = require('../src/app');
const { get, close } = require('../src/db');
const { notifyUser } = require('../src/utils/push');
const { getPreferences, setPreferences, categoryForType } = require('../src/services/notification-preferences');

const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

async function api(method, url, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(base + url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  let json = null;
  try { json = await res.json(); } catch (e) { /* غير JSON */ }
  return { status: res.status, json };
}
async function login(email, password) {
  const r = await api('POST', '/api/auth/login', { body: { email, password } });
  assert.equal(r.status, 200, `تسجيل دخول ${email}`);
  return r.json.data.token;
}

let tokens = {};
let customerId;
test.before(async () => {
  tokens.admin = await login('admin@rafidain.iq', 'Admin@123');
  tokens.customer = await login('customer.demo@rafidain.iq', 'Customer@123');
  customerId = get("SELECT id FROM users WHERE email = 'customer.demo@rafidain.iq'").id;
});
test.after(() => {
  server.close();
  close();
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(process.env.DB_PATH + suffix); } catch (e) { /* تجاهل */ }
  }
});

test('الافتراضي: كل شيء مفعّل عند غياب سطر التفضيلات', async () => {
  assert.equal(get("SELECT COUNT(*) AS c FROM notification_preferences WHERE user_id = ?", [customerId]).c, 0);
  const p = getPreferences(customerId);
  assert.equal(p.in_app, true);
  assert.equal(p.push, true);
  assert.equal(p.categories.order, true);
  assert.equal(p.categories.wallet, true);
});

test('GET /notifications/preferences يُرجع التفضيلات الافتراضية', async () => {
  const r = await api('GET', '/api/notifications/preferences', { token: tokens.customer });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.data.in_app, true);
  assert.equal(r.json.data.push, true);
  assert.ok(r.json.data.categories.announcement === true);
});

test('PUT /notifications/preferences يحفظ القنوات والفئات', async () => {
  const r = await api('PUT', '/api/notifications/preferences', {
    token: tokens.customer,
    body: { in_app: true, push: false, categories: { order: true, wallet: false, promotions: true, announcement: true, providers: true } },
  });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.data.push, false);
  assert.equal(r.json.data.categories.wallet, false);
  const row = get('SELECT * FROM notification_preferences WHERE user_id = ?', [customerId]);
  assert.ok(row, 'خُزِّن سطر التفضيلات');
});

test('إيقاف قناة داخل التطبيق يُمنع حفظ إشعار داخلي', async () => {
  setPreferences(customerId, { in_app: false, push: true });
  const before = get('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ?', [customerId]).c;
  await notifyUser(customerId, { type: 'order', title: 'سلوك محجوب', body: 'x' });
  const after = get('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ?', [customerId]).c;
  assert.equal(after, before, 'لا يُضاف إشعار داخلي عند تعطيل in_app');
});

test('إيقاف فئة يمنع حفظ إشعار داخلي لتلك الفئة فقط', async () => {
  setPreferences(customerId, { in_app: true, push: true, categories: { order: false, wallet: true, promotions: true, announcement: true, providers: true } });
  const before = get('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ?', [customerId]).c;
  await notifyUser(customerId, { type: 'order', title: 'طلب محجوب', body: 'x' });
  const during = get('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ?', [customerId]).c;
  assert.equal(during, before, 'لا يُضاف إشعار الفئة المعطّلة');
  await notifyUser(customerId, { type: 'recharge', title: 'شحنة مسموح', body: 'y' });
  const after = get('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ?', [customerId]).c;
  assert.ok(after > during, 'فئة أخرى مسموحة تُضاف');
});

test('تعيين فئة غير معروفة يُرفض', async () => {
  const r = await api('PUT', '/api/notifications/preferences', {
    token: tokens.customer,
    body: { categories: { order: true, bogus: true } },
  });
  assert.equal(r.status, 400, JSON.stringify(r.json));
});

test('تصنيف الأنواع إلى فئات', () => {
  assert.equal(categoryForType('order'), 'order');
  assert.equal(categoryForType('recharge'), 'wallet');
  assert.equal(categoryForType('withdrawal_pending'), 'wallet');
  assert.equal(categoryForType('promotion_expiring'), 'promotions');
  assert.equal(categoryForType('coupon_created'), 'promotions');
  assert.equal(categoryForType('announcement'), 'announcement');
  assert.equal(categoryForType('provider_created'), 'providers');
  assert.equal(categoryForType(null), 'order');
});