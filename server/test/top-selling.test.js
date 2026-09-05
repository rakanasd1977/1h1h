const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

process.env.NODE_ENV = 'test';
process.env.DB_PATH = path.join(os.tmpdir(), `rafidain-top-${process.pid}-${crypto.randomUUID()}.db`);
process.env.JWT_SECRET = 'top-test-secret';
process.env.RATE_LIMIT_MAX = '100000';

require('../src/db/seed');
const { get, run } = require('../src/db');
const pub = require('../src/services/public');

test('الأكثر طلباً يعيد منتجات فعلية مرتبة حسب المبيعات', () => {
  const svc = get('SELECT id FROM services LIMIT 1');
  const gov = get('SELECT id FROM governorates LIMIT 1');
  const uid = Number(run(
    "INSERT INTO users (email, password_hash, role, name_ar, is_active) VALUES (?,?,?,?,1)",
    [`prov.top.${process.pid}@test.iq`, 'x', 'provider', 'مزوّد اختبار']
  ).lastId);
  const pid = Number(run(
    'INSERT INTO providers (user_id, service_id, governorate_id, name_ar, is_active, is_verified) VALUES (?,?,?,?,1,1)',
    [uid, svc.id, gov.id, 'مزوّد اختبار']
  ).lastId);
  const iid = Number(run(
    'INSERT INTO products (provider_id, name_ar, price, is_active) VALUES (?,?,?,1)',
    [pid, 'منتج رائج', 5000]
  ).lastId);
  const items = JSON.stringify([
    { kind: 'products', item_id: iid, title: 'منتج رائج', quantity: 999, unit_price: 5000, total: 4995000 },
  ]);
  run(
    "INSERT INTO orders (order_number, provider_id, service_id, items_json, status, total_amount) VALUES (?,?,?,?,?,?)",
    ['TOP-TEST-1', pid, svc.id, items, 'completed', 4995000]
  );

  const res = pub.getTopSelling({ limit: 5 }, 'ar');
  assert.ok(Array.isArray(res), 'يُعاد مصفوفة');
  const hit = res.find((x) => x.kind === 'products' && x.item_id === iid);
  assert.ok(hit, 'المنتج الأكثر طلباً يظهر في النتائج');
  assert.equal(hit.sold, 999, 'عدد المباعات محسوب من الطلبات المكتملة');
  assert.equal(hit.title, 'منتج رائج');
});
