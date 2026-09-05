const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

process.env.NODE_ENV = 'test';
process.env.DB_PATH = path.join(os.tmpdir(), `rafidain-homelayout-${process.pid}-${crypto.randomUUID()}.db`);
process.env.JWT_SECRET = 'homelayout-test-secret';
process.env.RATE_LIMIT_MAX = '100000';
delete process.env.TRUST_PROXY;

require('../src/db/seed');

const app = require('../src/app');
const { run, close } = require('../src/db');

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
  return r.json.data.token;
}

let tokens = {};
test.before(async () => { tokens.admin = await login('admin@rafidain.iq', 'Admin@123'); });
test.after(() => {
  server.close();
  close();
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(process.env.DB_PATH + suffix); } catch (e) { /* تجاهل */ }
  }
});

test('نقطة عامة تُرجع تخطيط الصفحة الرئيسية افتراضياً', async () => {
  const r = await api('GET', '/api/public/home-layout');
  assert.equal(r.status, 200);
  assert.equal(r.json.data.length, 8, '8 أقسام افتراضية');
  assert.ok(r.json.data.every((s) => typeof s.enabled === 'boolean'), 'كل قسم له حالة مفعّل');
  const orders = r.json.data.map((s) => s.order);
  assert.deepEqual(orders, [...orders].sort((a, b) => a - b), 'مرتبة حسب الترتيب');
});

test('تخطيط مخزّن يُطبَّق عند جلب النقطة العامة', async () => {
  const stored = [
    { key: 'hero_ads', label: 'إعلانات أعلى الصفحة', enabled: true, order: 3 },
    { key: 'service_grid', label: 'شبكة الخدمات', enabled: false, order: 1 },
    { key: 'most_ordered', label: 'الأكثر طلباً', enabled: true, order: 2 },
  ];
  await api('PUT', '/api/settings/home_sections', { token: tokens.admin, body: { value: JSON.stringify(stored) } });
  const r = await api('GET', '/api/public/home-layout');
  assert.equal(r.status, 200);
  const svc = r.json.data.find((s) => s.key === 'service_grid');
  assert.equal(svc.enabled, false, 'القسم المطفأ يبقى مطفأً');
  const byKey = Object.fromEntries(r.json.data.map((s) => [s.key, s.order]));
  assert.equal(byKey.service_grid, 1, 'service_grid في الترتيب 1');
  assert.equal(byKey.most_ordered, 2, 'most_ordered في الترتيب 2');
  assert.equal(byKey.hero_ads, 3, 'hero_ads في الترتيب 3');
});
