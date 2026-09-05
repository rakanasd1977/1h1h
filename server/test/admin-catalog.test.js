const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

process.env.NODE_ENV = 'test';
process.env.DB_PATH = path.join(os.tmpdir(), `rafidain-admincat-${process.pid}-${crypto.randomUUID()}.db`);
process.env.JWT_SECRET = 'admincat-test-secret';
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
  const res = await fetch(base + url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
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

test('المسؤول يرى أنواع الكتالوج', async () => {
  const r = await api('GET', '/api/catalog/kinds', { token: tokens.admin });
  assert.equal(r.status, 200);
  assert.equal(r.json.data.length, 5);
  assert.ok(r.json.data.some((k) => k.key === 'products'));
});

test('المسؤول يسرد عناصر الكتالوج عبر المزودين', async () => {
  const r = await api('GET', '/api/catalog?kind=products&limit=5', { token: tokens.admin });
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.json.data.rows));
  assert.ok(r.json.data.total >= 1);
  const first = r.json.data.rows[0];
  assert.ok(first.provider_name, 'يظهر اسم المزود');
});

test('فلترة الكتالوج بالمزود والبحث والحالة', async () => {
  const store = get('SELECT * FROM providers WHERE name_ar = ?', ['متجر الرافدين للتجارة']);
  const byProv = await api('GET', `/api/catalog?kind=products&provider_id=${store.id}`, { token: tokens.admin });
  assert.equal(byProv.status, 200);
  assert.ok(byProv.json.data.rows.every((x) => x.provider_id === store.id));

  const q = await api('GET', `/api/catalog?kind=products&q=` + encodeURIComponent('هاتف'), { token: tokens.admin });
  assert.equal(q.status, 200);
  assert.ok(q.json.data.rows.length >= 1, 'البحث يرجع نتائج');

  const off = await api('GET', '/api/catalog?kind=products&active=0', { token: tokens.admin });
  assert.equal(off.status, 200);
  assert.ok(off.json.data.rows.every((x) => Number(x.is_active) === 0), 'الحالة المطفأة فقط');
});

test('المسؤول يجلب ويعدّل ويتبدّل ويحذف عنصر كتالوج', async () => {
  const store = get('SELECT * FROM providers WHERE name_ar = ?', ['متجر الرافدين للتجارة']);
  const id = run(
    "INSERT INTO products (provider_id, name_ar, price, is_active, is_featured) VALUES (?,?,?,1,0)",
    [store.id, 'منتج اختبار كتالوج', 12345]
  ).lastId;

  const got = await api('GET', `/api/catalog/products/${id}`, { token: tokens.admin });
  assert.equal(got.status, 200);
  assert.equal(got.json.data.id, id);

  const priceBefore = Number(get('SELECT price FROM products WHERE id = ?', [id]).price);
  const upd = await api('PUT', `/api/catalog/products/${id}`, { token: tokens.admin, body: { price: 99999, name_ar: 'منتج محدّث' } });
  assert.equal(upd.status, 200, JSON.stringify(upd.json));
  assert.equal(Number(get('SELECT price FROM products WHERE id = ?', [id]).price), 99999);
  assert.equal(get('SELECT name_ar FROM products WHERE id = ?', [id]).name_ar, 'منتج محدّث');

  const activeBefore = Number(get('SELECT is_active FROM products WHERE id = ?', [id]).is_active);
  const tgl = await api('POST', `/api/catalog/products/${id}/toggle`, { token: tokens.admin });
  assert.equal(tgl.status, 200);
  assert.notEqual(Number(get('SELECT is_active FROM products WHERE id = ?', [id]).is_active), activeBefore);

  const del = await api('DELETE', `/api/catalog/products/${id}`, { token: tokens.admin });
  assert.equal(del.status, 200);
  const after = await api('GET', `/api/catalog/products/${id}`, { token: tokens.admin });
  assert.equal(after.status, 404);
});

test('المشاهد (view فقط) لا يملك تعديل الكتالوج', async () => {
  const p = get('SELECT id FROM products ORDER BY id DESC LIMIT 1');
  const r = await api('PUT', `/api/catalog/products/${p.id}`, { token: tokens.viewer, body: { price: 1 } });
  assert.equal(r.status, 403);
  const t = await api('DELETE', `/api/catalog/products/${p.id}`, { token: tokens.viewer });
  assert.equal(t.status, 403);
});

test('الزبون لا يصل إلى كتالوج المسؤول', async () => {
  const r = await api('GET', '/api/catalog?kind=products', { token: tokens.customer });
  assert.equal(r.status, 403);
});

test('نوع كتالوج غير معروف يُرفض', async () => {
  const r = await api('GET', '/api/catalog?kind=nope', { token: tokens.admin });
  assert.equal(r.status, 400);
});
