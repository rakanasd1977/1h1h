const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

process.env.NODE_ENV = 'test';
process.env.DB_PATH = path.join(os.tmpdir(), `rafidain-coupons-${process.pid}-${crypto.randomUUID()}.db`);
process.env.JWT_SECRET = 'coupons-test-secret';
process.env.RATE_LIMIT_MAX = '100000';
delete process.env.TRUST_PROXY;

require('../src/db/seed');

const app = require('../src/app');
const { get, run, close } = require('../src/db');

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
test.before(async () => {
  tokens.admin = await login('admin@rafidain.iq', 'Admin@123');
  tokens.viewer = await login('viewer.demo@rafidain.iq', 'Viewer@123');
  tokens.customer = await login('customer.demo@rafidain.iq', 'Customer@123');
});
test.after(() => {
  server.close();
  close();
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(process.env.DB_PATH + suffix); } catch (e) { /* تجاهل */ }
  }
});

test('المسؤول يسرد الكوبونات', async () => {
  const r = await api('GET', '/api/coupons', { token: tokens.admin });
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.json.data.rows));
});

test('المسؤول ينشئ كوبوناً شاملاً ويجلبه ويعدّله ويتبدّله ويحذفه', async () => {
  const create = await api('POST', '/api/coupons', { token: tokens.admin, body: { code: 'TESTADMIN10', title: 'خصم تجريبي', discount_type: 'percent', discount_value: 10, min_amount: 0, provider_id: null, max_uses: 0, per_customer_limit: 1, is_active: 1 } });
  assert.equal(create.status, 201, JSON.stringify(create.json));
  const id = create.json.data.id;

  const dup = await api('POST', '/api/coupons', { token: tokens.admin, body: { code: 'TESTADMIN10', title: 'مكرر', discount_type: 'percent', discount_value: 5 } });
  assert.equal(dup.status, 409, 'الكود المكرر يُرفض');

  const got = await api('GET', `/api/coupons/${id}`, { token: tokens.admin });
  assert.equal(got.status, 200);
  assert.equal(got.json.data.code, 'TESTADMIN10');

  const upd = await api('PUT', `/api/coupons/${id}`, { token: tokens.admin, body: { discount_value: 20 } });
  assert.equal(upd.status, 200, JSON.stringify(upd.json));
  assert.equal(Number(get('SELECT discount_value FROM coupons WHERE id = ?', [id]).discount_value), 20);

  const tgl = await api('POST', `/api/coupons/${id}/toggle`, { token: tokens.admin });
  assert.equal(tgl.status, 200);
  assert.equal(Number(get('SELECT is_active FROM coupons WHERE id = ?', [id]).is_active), 0);

  const del = await api('DELETE', `/api/coupons/${id}`, { token: tokens.admin });
  assert.equal(del.status, 200);
  const after = await api('GET', `/api/coupons/${id}`, { token: tokens.admin });
  assert.equal(after.status, 404);
});

test('كوبون بنسبة > 100 أو كود فارغ يُرفض', async () => {
  const bad1 = await api('POST', '/api/coupons', { token: tokens.admin, body: { code: '', title: 'x', discount_type: 'percent', discount_value: 50 } });
  assert.equal(bad1.status, 400);
  const bad2 = await api('POST', '/api/coupons', { token: tokens.admin, body: { code: 'OVER100', title: 'x', discount_type: 'percent', discount_value: 150 } });
  assert.equal(bad2.status, 400);
  // تجاوز السقف بإغفال discount_type (يُفترض percent) — يجب رفضُه لأن السقف يُفحص على النوع النهائي
  const bypass = await api('POST', '/api/coupons', { token: tokens.admin, body: { code: 'OVER100B', title: 'x', discount_value: 150 } });
  assert.equal(bypass.status, 400);
});

test('المشاهد لا ينشئ/يعدّل الكوبونات', async () => {
  const c = await api('POST', '/api/coupons', { token: tokens.viewer, body: { code: 'VIEWERX', discount_type: 'fixed', discount_value: 1 } });
  assert.equal(c.status, 403);
  const list = await api('GET', '/api/coupons', { token: tokens.viewer });
  assert.equal(list.status, 200);
});

test('الزبون لا يصل لإدارة الكوبونات', async () => {
  const r = await api('GET', '/api/coupons', { token: tokens.customer });
  assert.equal(r.status, 403);
});
