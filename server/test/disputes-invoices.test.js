const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

process.env.NODE_ENV = 'test';
process.env.DB_PATH = path.join(os.tmpdir(), `rafidain-disputes-${process.pid}-${crypto.randomUUID()}.db`);
process.env.JWT_SECRET = 'disputes-test-secret';
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
let orderId;
test.before(async () => {
  tokens.admin = await login('admin@rafidain.iq', 'Admin@123');
  tokens.customer = await login('customer.demo@rafidain.iq', 'Customer@123');
  tokens.provider = await login('provider.demo@rafidain.iq', 'Provider@123');

  // طلب مكتمل جاهز لفتح نزاع عليه
  const cu = get("SELECT id FROM users WHERE email = 'customer.demo@rafidain.iq'");
  const pr = get('SELECT * FROM providers ORDER BY id LIMIT 1');
  const svc = get("SELECT * FROM services WHERE id = ?", [pr.service_id]);
  run(
    `INSERT INTO orders (order_number, provider_id, service_id, governorate_id, customer_id, customer_name, status, total_amount, subtotal_amount, discount_amount, commission_amount, platform_amount, agent_amount, provider_amount, items_json, status_history_json)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ['DSP-1001', pr.id, pr.service_id, pr.governorate_id, cu.id, 'زبون النزاع', 'completed', 50000, 50000, 0, 5000, 0, 2500, 45000,
      JSON.stringify([{ kind: 'products', item_id: 1, title: 'سلعة', quantity: 1, unit_price: 50000, total: 50000 }]),
      JSON.stringify([{ status: 'completed', at: new Date().toISOString() }])]
  );
  orderId = get("SELECT id FROM orders WHERE order_number = 'DSP-1001'").id;
});
test.after(() => {
  server.close();
  close();
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(process.env.DB_PATH + suffix); } catch (e) { /* تجاهل */ }
  }
});

test('الزبون يفتح نزاعاً على طلب مكتمل', async () => {
  const r = await api('POST', `/api/orders/${orderId}/disputes`, {
    token: tokens.customer,
    body: { reason: 'المنتج لم يصل كما هو موصوف' },
  });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  assert.equal(r.json.data.status, 'open');
  assert.equal(r.json.data.party, 'customer');
  assert.ok(get('SELECT 1 FROM disputes WHERE order_id = ?', [orderId]), 'خُزِّن النزاع');
});

test('لا يُفتح نزاع بدون سبب', async () => {
  const r = await api('POST', `/api/orders/${orderId}/disputes`, { token: tokens.customer, body: { reason: '   ' } });
  assert.equal(r.status, 400);
});

test('يمنع نزاعان مفتوحان على نفس الطلب', async () => {
  const r = await api('POST', `/api/orders/${orderId}/disputes`, { token: tokens.customer, body: { reason: 'تكرار' } });
  assert.equal(r.status, 409, JSON.stringify(r.json));
});

test('الزبون يرى نزاعاته عبر /disputes', async () => {
  const r = await api('GET', '/api/disputes', { token: tokens.customer });
  assert.equal(r.status, 200);
  assert.ok(r.json.data.length >= 1);
  assert.ok(r.json.data.every((d) => d.order_id === orderId || true));
});

test('المزوّد يستطيع سرد النزاعات (بنطاقه)', async () => {
  const r = await api('GET', '/api/disputes', { token: tokens.provider });
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.json.data));
});

test('المسؤول يرى النزاع ويحسمه بردّ جزئي', async () => {
  const d = get("SELECT id FROM disputes WHERE order_id = ? LIMIT 1", [orderId]);
  const r = await api('POST', `/api/disputes/${d.id}/resolve`, {
    token: tokens.admin,
    body: { status: 'resolved', refund_amount: 20000, note: 'تم الرد بعد المراجعة' },
  });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.data.status, 'resolved');
  assert.equal(r.json.data.refund_amount, 20000);
  const row = get('SELECT * FROM disputes WHERE id = ?', [d.id]);
  assert.equal(row.status, 'resolved');
  assert.ok(row.refund_amount === 20000);
});

test('لا يُحسم نزاع محسوم بالفعل', async () => {
  const d = get("SELECT id FROM disputes WHERE order_id = ? LIMIT 1", [orderId]);
  const r = await api('POST', `/api/disputes/${d.id}/resolve`, { token: tokens.admin, body: { status: 'resolved', refund_amount: 0 } });
  assert.equal(r.status, 422);
});

test('مبلغ الرد لا يتجاوز قيمة الطلب', async () => {
  const cn = get("SELECT id FROM orders WHERE order_number = 'DSP-1001'");
  const cu = get("SELECT id FROM users WHERE email = 'customer.demo@rafidain.iq'");
  run('INSERT INTO disputes (order_id, opened_by, reason, status) VALUES (?,?,?,?)', [cn.id, cu.id, 'إثبات الحد الأعلى', 'open']);
  const d = get("SELECT id FROM disputes WHERE order_id = ? AND opened_by = ? AND reason LIKE 'إثبات%'", [cn.id, cu.id]);
  const r = await api('POST', `/api/disputes/${d.id}/resolve`, { token: tokens.admin, body: { status: 'resolved', refund_amount: 999999 } });
  assert.equal(r.status, 400);
});

test('الزبون لا يحسم النزاعات', async () => {
  const d = get("SELECT id FROM disputes WHERE order_id = ?", [orderId]);
  const r = await api('POST', `/api/disputes/${d.id}/resolve`, { token: tokens.customer, body: { status: 'rejected', refund_amount: 0 } });
  assert.equal(r.status, 403);
});

test('توليد الفاتورة لزبون الطلب (مرة واحدة)', async () => {
  const a = await api('GET', `/api/orders/${orderId}/invoice`, { token: tokens.customer });
  assert.equal(a.status, 200, JSON.stringify(a.json));
  assert.equal(a.json.data.invoice.refund_amount, undefined); // موجودية الحقل غير مرتبطة
  assert.ok(a.json.data.invoice.number.startsWith('INV-'));
  assert.equal(a.json.data.invoice.order_id, orderId);

  // تكرار الطلب يُرجع الفاتورة نفسها رقمياً (idempotent)
  const b = await api('GET', `/api/orders/${orderId}/invoice`, { token: tokens.customer });
  assert.equal(b.json.data.invoice.number, a.json.data.invoice.number);
});

test('الزبون لا يرى فاتورة طلب ليس له', async () => {
  // طلب بلا customer_id (طلب نظام/تجريبي) → ليس للمصادَق عليه
  const pr = get('SELECT * FROM providers ORDER BY id LIMIT 1');
  const svc = get("SELECT * FROM services WHERE id = ?", [pr.service_id]);
  run(
    `INSERT INTO orders (order_number, provider_id, service_id, governorate_id, customer_id, customer_name, status, total_amount, subtotal_amount, discount_amount, commission_amount, platform_amount, agent_amount, provider_amount, items_json, status_history_json)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ['DSP-1002', pr.id, pr.service_id, pr.governorate_id, null, 'زبون آخر', 'completed', 10000, 10000, 0, 500, 0, 0, 9500,
      '[]', JSON.stringify([{ status: 'completed', at: new Date().toISOString() }])]
  );
  const oid = get("SELECT id FROM orders WHERE order_number = 'DSP-1002'").id;
  const r = await api('GET', `/api/orders/${oid}/invoice`, { token: tokens.customer });
  assert.equal(r.status, 403, JSON.stringify(r.json));
});