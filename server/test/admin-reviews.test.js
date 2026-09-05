const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

process.env.NODE_ENV = 'test';
process.env.DB_PATH = path.join(os.tmpdir(), `rafidain-reviews-${process.pid}-${crypto.randomUUID()}.db`);
process.env.JWT_SECRET = 'reviews-test-secret';
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

test('المسؤول يسرد تقييمات المنتجات والمزودين', async () => {
  const item = await api('GET', '/api/reviews?scope=item', { token: tokens.admin });
  assert.equal(item.status, 200);
  assert.ok(Array.isArray(item.json.data.rows));

  const prov = await api('GET', '/api/reviews?scope=provider', { token: tokens.admin });
  assert.equal(prov.status, 200);
  assert.ok(Array.isArray(prov.json.data.rows));
});

test('المسؤول يحذف تقييم منتج ويعيد حساب المجمّع', async () => {
  const store = get('SELECT * FROM providers WHERE name_ar = ?', ['متجر الرافدين للتجارة']);
  const cust = get("SELECT * FROM users WHERE role = 'customer' LIMIT 1");
  const rid = run(
    'INSERT INTO item_ratings (item_type, item_id, provider_id, customer_id, order_id, rating, comment) VALUES (?,?,?,?,?,?,?)',
    ['products', 1, store.id, cust.id, null, 5, 'تقييم اختبار']
  ).lastId;
  const sumBefore = get('SELECT * FROM item_rating_sums WHERE item_type=? AND item_id=?', ['products', 1]);

  const del = await api('DELETE', `/api/reviews/item/${rid}`, { token: tokens.admin });
  assert.equal(del.status, 200, JSON.stringify(del.json));

  const after = get('SELECT * FROM item_ratings WHERE id = ?', [rid]);
  assert.equal(after, undefined, 'حُذف التقييم');
  const sumAfter = get('SELECT * FROM item_rating_sums WHERE item_type=? AND item_id=?', ['products', 1]);
  assert.ok(sumAfter, 'بقي المجمّع');
  if (sumBefore) assert.equal(Number(sumAfter.count), Number(sumBefore.count) - 1, 'انخفض العدد');
});

test('المسؤول يحذف تقييم مزود', async () => {
  const store = get('SELECT * FROM providers WHERE name_ar = ?', ['متجر الرافدين للتجارة']);
  const cust = get("SELECT * FROM users WHERE role = 'customer' LIMIT 1");
  const rid = run(
    'INSERT INTO provider_ratings (provider_id, customer_id, order_id, rating, comment) VALUES (?,?,?,?,?)',
    [store.id, cust.id, null, 4, 'تقييم مزود اختبار']
  ).lastId;
  const del = await api('DELETE', `/api/reviews/provider/${rid}`, { token: tokens.admin });
  assert.equal(del.status, 200);
  assert.equal(get('SELECT * FROM provider_ratings WHERE id = ?', [rid]), undefined);
});

test('المشاهد لا يحذف التقييمات', async () => {
  const r = await api('DELETE', '/api/reviews/item/999999', { token: tokens.viewer });
  assert.equal(r.status, 403);
});

test('الزبون لا يصل لإدارة التقييمات', async () => {
  const r = await api('GET', '/api/reviews?scope=item', { token: tokens.customer });
  assert.equal(r.status, 403);
});


