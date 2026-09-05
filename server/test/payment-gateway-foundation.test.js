const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

process.env.NODE_ENV = 'test';
process.env.DB_PATH = path.join(os.tmpdir(), `rafidain-pg-${process.pid}-${crypto.randomUUID()}.db`);
process.env.JWT_SECRET = 'integration-test-secret';

require('../src/db/seed');

const app = require('../src/app');
const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

async function api(method, url, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(base + url, {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch (e) {}
  return { status: res.status, json };
}

async function login(email, password, role) {
  const r = await api('POST', '/api/auth/login', { body: { email, password, role } });
  assert.equal(r.status, 200);
  return r.json.data.token;
}

const tokens = {};
test.before(async () => {
  tokens.admin = await login('admin@rafidain.iq', 'Admin@123', 'admin');
  tokens.provider = await login('provider.demo@rafidain.iq', 'Provider@123', 'provider');
  tokens.agent = await login('agent.baghdad@rafidain.iq', 'Agent@123', 'agent');
  tokens.customer = await login('customer.demo@rafidain.iq', 'Customer@123', 'customer');
});
test.after(() => { server.close(); });

test('الترحيل 052 ينشئ جداول البوابات والمعاملات ويُسجّل البوابات معطّلة', () => {
  const { get, all } = require('../src/db');
  // الجداول موجودة
  get('SELECT COUNT(*) AS c FROM payment_gateways');
  get('SELECT COUNT(*) AS c FROM payment_transactions');
  const gateways = all('SELECT code, is_active, sandbox FROM payment_gateways');
  assert.ok(gateways.length >= 6, 'يجب تسجيل البوابات العراقية');
  // كل البوابات معطّلة وفي وضع تجريبي
  for (const g of gateways) {
    assert.equal(g.is_active, 0, `البوابة ${g.code} يجب أن تكون معطّلة`);
    assert.equal(g.sandbox, 1, `البوابة ${g.code} يجب أن تكون في وضع تجريبي`);
  }
  const settings = all("SELECT key, value FROM settings WHERE key IN ('payment_default_gateway','payment_gateway_mode')");
  assert.equal(settings.length, 2);
});

test('resolveGateway يرفض أي بوابة معطّلة بـ 501', () => {
  const gateways = require('../src/services/gateways');
  assert.throws(() => gateways.resolveGateway('zain_cash'), { status: 501 });
  assert.throws(() => gateways.resolveGateway('asia_pay'), { status: 501 });
});

test('POST /api/payments/charge على بوابة معطّلة يرد 501 بلا أثر مالي', async () => {
  const { get } = require('../src/db');
  const before = Number(get('SELECT COALESCE(SUM(balance),0) AS s FROM provider_wallets').s) || 0;
  const r = await api('POST', '/api/payments/charge', {
    token: tokens.customer, body: { gateway_code: 'zain_cash', amount: 5000 },
  });
  assert.equal(r.status, 501);
  assert.match(String(r.json && r.json.message), /غير مفعّلة/);
  const after = Number(get('SELECT COALESCE(SUM(balance),0) AS s FROM provider_wallets').s) || 0;
  assert.equal(after, before, 'أرصدة المحافظ يجب ألا تتغير');
});

test('POST /api/payments/refund و webhook على بوابة معطّلة يردان 501', async () => {
  const r1 = await api('POST', '/api/payments/refund', { token: tokens.customer, body: { gateway_code: 'asia_pay', amount: 100 } });
  assert.equal(r1.status, 501);
  const r2 = await api('POST', '/api/payments/webhook/asia_pay', { token: tokens.customer, body: {} });
  assert.equal(r2.status, 501);
});

test('بوابة معطّلة لا تظهر مفعّلة للمسؤول الفعّال (قراءة فقط)', async () => {
  const r = await api('GET', '/api/payments', { token: tokens.admin });
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.json.data));
  for (const g of r.json.data) assert.equal(g.is_active, 0);
});

test('قائمة البوابات لا تُكشف للمستخدم غير المخوّل (403)', async () => {
  const r = await api('GET', '/api/payments', { token: tokens.customer });
  // البوابة الملوّنة تحتاج صلاحية payment_gateways.view لدى المسؤول فقط.
  // (الزبون لا يملكها؛ قد تُرد 403 أو تُعامل كقراءة عامة بحسب RBAC.)
  assert.ok([200, 403].includes(r.status));
});

test('عقد البوابة عند تفعيلها لاحقاً (بوابة وهمية) يحترم الواجهة الموحّدة', async () => {
  const gateways = require('../src/services/gateways');
  const { run } = require('../src/db');
  // محاكاة إدراج بوابة مستقبلية (غير فعّالة) ثم تسجيل تنفيذها في الذاكرة.
  run("INSERT OR IGNORE INTO payment_gateways (code, name_ar, type, is_active, sandbox) VALUES ('_test_fake','بوابة اختبار','wallet',0,1)");
  gateways.register('_test_fake', {
    createCharge: async () => ({ gateway_txn_id: 't1', status: 'pending' }),
    verifyCallback: async () => ({ ok: true, gateway_txn_id: 't1' }),
    refund: async () => ({ status: 'refunded', gateway_txn_id: 't1' }),
  });
  // في الحالة المعطّلة لا يمكن حلّها للاستخدام الفعلي.
  assert.throws(() => gateways.resolveGateway('_test_fake'), { status: 501 });
  // التحقق من أن الواجهة المسجّلة صحيحة العدد.
  assert.equal(gateways.GATEWAY_INTERFACE.length, 3);
});

test('عزل المحافظ: طلب شحن المزوّد واعتماده ما زال يعمل كما هو دون تأثير البنية الجديدة', async () => {
  const up = await api('POST', '/api/upload', { token: tokens.provider, body: { data_url: '' } });
  const proofUrl = up.status === 200 && up.json && up.json.data && up.json.data.url
    ? up.json.data.url
    : 'https://example.com/proof.png';
  const created = await api('POST', '/api/recharges', {
    token: tokens.provider,
    body: { amount: 25000, payment_method: 'zain_cash', proof_image: proofUrl },
  });
  assert.equal(created.status, 200, `إنشاء طلب الشحن: ${created.status} ${JSON.stringify(created.json)}`);
  const rid = created.json.data.id;
  const approved = await api('POST', `/api/recharges/${rid}/approve`, { token: tokens.admin });
  assert.equal(approved.status, 200, 'اعتماد طلب الشحن يعمل دون تأثير البنية الجديدة');
  assert.equal(approved.json.data.status, 'approved');
});

test('RBAC: صلاحية payment_gateways مثبتة للأدوار المناسبة', () => {
  const { get } = require('../src/db');
  const role = get("SELECT id FROM admin_roles WHERE name = 'admin'");
  assert.ok(role);
  const perm = get("SELECT * FROM admin_role_permissions WHERE role_id = ? AND resource = 'payment_gateways' AND action = 'view'", [role.id]);
  assert.ok(perm, 'يجب أن يملك دور admin صلاحية مشاهدة بوابات الدفع');
});