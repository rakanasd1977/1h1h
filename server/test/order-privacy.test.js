// اختبارات خصوصية بيانات الطلب:
// 1) المزود لا يرى بيانات الزبون (الاسم/الهاتف/العنوان) قبل قبول الطلب، ويراها بعد القبول.
// 2) رقم هاتف المزود لا يُكشف للجمهور في الصفحة العامة، بل للزبون في تفاصيل طلبه بعد القبول.
// 3) الزبون يستطيع إلغاء طلبه في الحالتين pending و confirmed فقط.
const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

process.env.NODE_ENV = 'test';
process.env.DB_PATH = path.join(os.tmpdir(), `rafidain-orderpriv-${process.pid}-${crypto.randomUUID()}.db`);
process.env.JWT_SECRET = 'order-privacy-test-secret';
process.env.RATE_LIMIT_MAX = '100000';
delete process.env.TRUST_PROXY;

const { generateVAPIDKeys } = require('web-push');
const _vapid = generateVAPIDKeys();
process.env.VAPID_PUBLIC_KEY = _vapid.publicKey;
process.env.VAPID_PRIVATE_KEY = _vapid.privateKey;

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
  try { json = await res.json(); } catch (e) { /* تجاهل */ }
  return { status: res.status, json };
}

async function login(email, password) {
  const r = await api('POST', '/api/auth/login', { body: { email, password } });
  assert.equal(r.status, 200, `دخول ${email}`);
  return r.json.data.token;
}

let tokens = {}, store, product, providerUser;

test.before(async () => {
  tokens.customer = await login('customer.demo@rafidain.iq', 'Customer@123');
  tokens.provider = await login('provider.demo@rafidain.iq', 'Provider@123');
  tokens.admin = await login('admin@rafidain.iq', 'Admin@123');

  store = get('SELECT * FROM providers WHERE name_ar = ?', ['متجر الرافدين للتجارة']);
  product = get('SELECT * FROM products WHERE provider_id = ? ORDER BY id ASC LIMIT 1', [store.id]);
  providerUser = get('SELECT * FROM users WHERE email = ?', ['provider.demo@rafidain.iq']);
  // منح المزود رقم هاتف لاختبار إخفائه/إظهاره
  run("UPDATE providers SET phone = ? WHERE id = ?", ['07710000001', store.id]);
  store = get('SELECT * FROM providers WHERE id = ?', [store.id]);
  // شحن محفظة المزود كي تمرّ عملية القبول (خصم العمولة)
  if (get('SELECT provider_id FROM provider_wallets WHERE provider_id = ?', [store.id])) {
    run('UPDATE provider_wallets SET balance = 100000000 WHERE provider_id = ?', [store.id]);
  } else {
    run('INSERT INTO provider_wallets (provider_id, balance) VALUES (?,100000000)', [store.id]);
  }
});

test.after(() => {
  server.close();
  close();
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(process.env.DB_PATH + suffix); } catch (e) { /* تجاهل */ }
  }
});

// 1) المزود لا يرى بيانات الزبون قبل القبول
test('المزود لا يرى بيانات الزبون (الاسم/الهاتف/العنوان) قبل قبول الطلب', async () => {
  const created = await api('POST', '/api/orders', {
    token: tokens.customer,
    body: {
      provider_id: store.id,
      items: [{ kind: 'products', item_id: product.id, quantity: 1 }],
      customer_name: 'زبون الخصوصية',
      customer_phone: '07701234567',
      customer_address: 'بغداد - شارع خاص جداً - بيت 9',
    },
  });
  assert.equal(created.status, 201, JSON.stringify(created.json));
  const id = created.json.data.id;

  // قائمة المزود والتفاصيل قبل القبول → بيانات الزبون مخفية
  const list = await api('GET', '/api/orders', { token: tokens.provider });
  const row = list.json.data.find((o) => o.id === id);
  assert.equal(row.customer_name, null);
  assert.equal(row.customer_name_ref, null);
  assert.equal(row.customer_phone, null);
  assert.equal(row.customer_address, null);

  const detail = await api('GET', `/api/orders/${id}`, { token: tokens.provider });
  assert.equal(detail.json.data.customer_name, null);
  assert.equal(detail.json.data.customer_phone, null);
  assert.equal(detail.json.data.customer_address, null);

  // تنظيف: المزود يرفض الطلب
  await api('PUT', `/api/orders/${id}/status`, { token: tokens.provider, body: { status: 'cancelled', reason: 'اختبار' } });
});

// 2) المزود يرى بيانات الزبون كاملة بعد قبول الطلب
test('المزود يرى بيانات الزبون كاملة بعد قبول الطلب', async () => {
  const created = await api('POST', '/api/orders', {
    token: tokens.customer,
    body: {
      provider_id: store.id,
      items: [{ kind: 'products', item_id: product.id, quantity: 1 }],
      customer_name: 'زبون القبول',
      customer_phone: '07701234567',
      customer_address: 'النجف - حي السلام - عمارة 12',
    },
  });
  assert.equal(created.status, 201);
  const id = created.json.data.id;

  await api('PUT', `/api/orders/${id}/status`, { token: tokens.provider, body: { status: 'confirmed' } });

  const detail = await api('GET', `/api/orders/${id}`, { token: tokens.provider });
  const d = detail.json.data;
  assert.equal(d.customer_name, 'زبون القبول', 'اسم الزبون ظاهر بعد القبول');
  assert.equal(d.customer_phone, '07701234567', 'هاتف الزبون ظاهر بعد القبول');
  assert.equal(d.customer_address, 'النجف - حي السلام - عمارة 12', 'عنوان الزبون الكامل ظاهر بعد القبول');

  // تنظيف
  await api('PUT', `/api/orders/${id}/status`, { token: tokens.admin, body: { status: 'cancelled' } });
});

// 3) رقم هاتف المزود لا يظهر في الصفحة العامة للمزود
test('رقم هاتف المزود لا يُكشف في الصفحة العامة', async () => {
  const pub = await api('GET', `/api/public/providers/${store.id}`);
  assert.equal(pub.status, 200);
  assert.equal(pub.json.data.phone, undefined, 'publicProvider لا يجب أن يصدر phone');
  assert.ok(store.phone, 'المزود له هاتفٌ حقيقي في قاعدة البيانات');
});

// 4) الزبون يرى رقم هاتف المزود في تفاصيل طلبه بعد قبول الطلب فقط
test('الزبون يرى رقم هاتف المزود في تفاصيل الطلب بعد القبول', async () => {
  const created = await api('POST', '/api/orders', {
    token: tokens.customer,
    body: { provider_id: store.id, items: [{ kind: 'products', item_id: product.id, quantity: 1 }] },
  });
  const id = created.json.data.id;

  // قبل القبول: الهاتف مخفي عن الزبون
  const before = await api('GET', `/api/orders/${id}`, { token: tokens.customer });
  assert.equal(before.json.data.provider_phone, null, 'قبل القبول لا يُكشف رقم المزود');

  await api('PUT', `/api/orders/${id}/status`, { token: tokens.provider, body: { status: 'confirmed' } });

  const after = await api('GET', `/api/orders/${id}`, { token: tokens.customer });
  assert.equal(after.json.data.provider_phone, store.phone, 'بعد القبول يظهر رقم المزود للزبون');

  await api('PUT', `/api/orders/${id}/status`, { token: tokens.admin, body: { status: 'cancelled' } });
});

// 5) الزبون يلغي طلبه في حالة pending
test('الزبون يلغي طلبه في حالة pending', async () => {
  const created = await api('POST', '/api/orders', {
    token: tokens.customer,
    body: { provider_id: store.id, items: [{ kind: 'products', item_id: product.id, quantity: 1 }] },
  });
  const id = created.json.data.id;
  const r = await api('PUT', `/api/orders/${id}/status`, { token: tokens.customer, body: { status: 'cancelled', reason: 'غيرت رأيي' } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.data.status, 'cancelled');
});

// 6) الزبون لا يستطيع إلغاء طلب مكتمل
test('الزبون لا يستطيع إلغاء طلب بعد بدء تنفيذه', async () => {
  const created = await api('POST', '/api/orders', {
    token: tokens.customer,
    body: { provider_id: store.id, items: [{ kind: 'products', item_id: product.id, quantity: 1 }] },
  });
  const id = created.json.data.id;
  await api('PUT', `/api/orders/${id}/status`, { token: tokens.provider, body: { status: 'confirmed' } });
  await api('PUT', `/api/orders/${id}/status`, { token: tokens.provider, body: { status: 'in_progress' } });
  const r = await api('PUT', `/api/orders/${id}/status`, { token: tokens.customer, body: { status: 'cancelled' } });
  assert.equal(r.status, 400, JSON.stringify(r.json));
  await api('PUT', `/api/orders/${id}/status`, { token: tokens.admin, body: { status: 'cancelled' } });
});

// 7) الزبون لا يستطيع إنشاء/تغيير حالة سوى الإلغاء
test('الزبون لا يستطيع تغيير حالة الطلب سوى الإلغاء', async () => {
  const created = await api('POST', '/api/orders', {
    token: tokens.customer,
    body: { provider_id: store.id, items: [{ kind: 'products', item_id: product.id, quantity: 1 }] },
  });
  const id = created.json.data.id;
  const r = await api('PUT', `/api/orders/${id}/status`, { token: tokens.customer, body: { status: 'confirmed' } });
  assert.equal(r.status, 403, JSON.stringify(r.json));
  await api('PUT', `/api/orders/${id}/status`, { token: tokens.admin, body: { status: 'cancelled' } });
});

// 8) صفحة حجوزات المزود (provider/bookings) تخفي بيانات الزبون للطلبات المعلّقة
test('صفحة حجوزات المزود تخفي بيانات الزبون للطّلب المعلّق ثم تُظهرها بعد القبول', async () => {
  const created = await api('POST', '/api/orders', {
    token: tokens.customer,
    body: {
      provider_id: store.id,
      items: [{ kind: 'products', item_id: product.id, quantity: 1 }],
      customer_name: 'زبون الحجز',
      customer_phone: '07819998887',
      customer_address: 'البصرة - شارع الجزائر',
    },
  });
  assert.equal(created.status, 201);
  const id = created.json.data.id;

  const list = await api('GET', '/api/provider/bookings', { token: tokens.provider });
  assert.equal(list.status, 200);
  const row = list.json.data.find((o) => o.id === id);
  assert.ok(row, 'الطلب يظهر في قائمة حجوزات المزود');
  assert.equal(row.customer_name, null, 'اسم الزبون مخفي في القائمة قبل القبول');
  assert.equal(row.customer_phone, null, 'هاتف الزبون مخفي في القائمة قبل القبول');

  await api('PUT', `/api/orders/${id}/status`, { token: tokens.provider, body: { status: 'confirmed' } });

  const list2 = await api('GET', '/api/provider/bookings', { token: tokens.provider });
  const row2 = list2.json.data.find((o) => o.id === id);
  assert.equal(row2.customer_name, 'زبون الحجز', 'اسم الزبون ظاهر بعد القبول في القائمة');
  assert.equal(row2.customer_phone, '07819998887', 'هاتف الزبون ظاهر بعد القبول في القائمة');

  await api('PUT', `/api/orders/${id}/status`, { token: tokens.admin, body: { status: 'cancelled' } });
});