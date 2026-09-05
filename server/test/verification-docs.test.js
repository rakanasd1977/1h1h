// اختبارات مستودع مستندات التوثيق المركزي (data/docs/<providerId>/).
// التحقق من: الضغط إلى WebP في مجلد المزوّد، /docs لا يُقدَّم عاماً إطلاقاً،
// تقديم المستندات عبر مسارات مصادقة فقط، إلزام التوثيق عند تفعيل الإعداد، وتمرير 404/400 في الحالات الناقصة.
const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

process.env.NODE_ENV = 'test';
process.env.DB_PATH = path.join(os.tmpdir(), `rafidain-docs-${process.pid}.db`);
process.env.JWT_SECRET = 'docs-test-secret';
process.env.RATE_LIMIT_MAX = '100000';
delete process.env.TRUST_PROXY;

const { generateVAPIDKeys } = require('web-push');
const _testVapid = generateVAPIDKeys();
process.env.VAPID_PUBLIC_KEY = _testVapid.publicKey;
process.env.VAPID_PRIVATE_KEY = _testVapid.privateKey;

require('../src/db/seed');

const app = require('../src/app');
const { get, run, close } = require('../src/db');
const { DOCS_DIR } = require('../src/utils/docStorage');

const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

async function api(method, url, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(base + url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  let json = null;
  try { json = await res.json(); } catch (e) { /* غير JSON */ }
  return { status: res.status, json, headers: res.headers };
}

async function login(email, password) {
  const r = await api('POST', '/api/auth/login', { body: { email, password } });
  assert.equal(r.status, 200, `تسجيل دخول ${email}`);
  return r.json.data.token;
}

// 1x1 PNG سليمة قابلة للضغط عبر sharp (نفسها المستخدمة في الاختبارات الداخلية)
const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

let tokens = {};
let store;

test.before(async () => {
  tokens.admin = await login('admin@rafidain.iq', 'Admin@123');
  tokens.agent = await login('agent.baghdad@rafidain.iq', 'Agent@123');
  tokens.provider = await login('provider.demo@rafidain.iq', 'Provider@123');
  tokens.customer = await login('customer.demo@rafidain.iq', 'Customer@123');
  store = get('SELECT * FROM providers WHERE name_ar = ?', ['متجر الرافدين للتجارة']);
});

test('مستودع التوثيق المركزي: الضغط، /docs غير عام، والتقديم عبر مسارات مصادقة', async () => {
  const provToken = tokens.provider;

  // قبل الرفع: لا مستند مركزي للمزوّد
  const empty = await api('GET', '/api/provider/documents/national_id', { token: provToken });
  assert.equal(empty.status, 404, 'لا مستند قبل الرفع');

  // المدخلات المرفوضة
  const badType = await api('PUT', '/api/provider/verification', { token: provToken, body: { national_id_image: 'data:text/plain;base64,abc' } });
  assert.equal(badType.status, 400, 'غير صورة يُرفض');
  const huge = await api('PUT', '/api/provider/verification', { token: provToken, body: { national_id_image: TINY_PNG, residency_doc_image: 'data:image/png;base64,' + 'A'.repeat(3 * 1024 * 1024) } });
  assert.equal(huge.status, 400, 'المحتوى غير مطابق للنوع يُرفض');
  const tooBig = await api('PUT', '/api/provider/verification', { token: provToken, body: { national_id_image: 'data:image/png;base64,' + 'iVBORw0KGgo='.repeat(Math.ceil(Math.ceil(8 * 1024 * 1024 / 0.75) / 12) + 1) } });
  assert.ok(tooBig.status === 400 || tooBig.status === 413, 'أكبر من الحد تُرفض (400/413): ' + tooBig.status);

  // رفع سليم → يُخزَّن مركزياً مضغوطاً ويُحفظ نسخة WebP في مجلد المزوّد
  const up = await api('PUT', '/api/provider/verification', { token: provToken, body: { national_id_image: TINY_PNG, residency_doc_image: TINY_PNG } });
  assert.equal(up.status, 200, JSON.stringify(up.json));
  assert.equal(up.json.data.verification_status, 'pending');

  const row = get('SELECT national_id_image, residency_doc_image FROM providers WHERE id = ?', [store.id]);
  assert.match(row.national_id_image, new RegExp(`^/docs/${store.id}/`), 'مرجع مركزي في مجلد المزوّد');
  assert.match(row.residency_doc_image, new RegExp(`^/docs/${store.id}/`), 'التأييد أيضاً في مجلد المزوّد');

  const natAbs = path.join(DOCS_DIR, String(store.id), row.national_id_image.split('/').pop());
  assert.ok(fs.existsSync(natAbs), 'الملف المضغوط محفوظ فعلياً');
  const head = fs.readFileSync(natAbs);
  // توقيع WebP: RIFF....WEBP
  assert.equal(head.toString('ascii', 0, 4), 'RIFF', 'النتيجة بعد الضغط بصيغة WebP');
  assert.equal(head.toString('ascii', 8, 12), 'WEBP', 'النتيجة بعد الضغط بصيغة WebP');
  assert.ok(head.length < 2048, `الصورة الصغيرة تُضغط إلى حجم أصغر (كانت ` + (Buffer.byteLength(TINY_PNG)) + ` بايت base64، أصبحت ${head.length})`);

  // /docs لا يُقدَّم عاماً إطلاقاً — لا مسار عام له والعنوان المباشر 404
  const pubDocs = await api('GET', `/docs/${store.id}/${row.national_id_image.split('/').pop()}`, {});
  assert.equal(pubDocs.status, 404, '/docs لا يوجد كمسار عام');

  // المستندات تُقدَّم للمزوّد نفسه عبر مسار مصادق
  const ownNat = await api('GET', '/api/provider/documents/national_id', { token: provToken });
  assert.equal(ownNat.status, 200, JSON.stringify(ownNat.json));
  assert.equal(ownNat.headers.get('content-type'), 'image/webp', 'يُقدَّم WebP صحيح');
  assert.notEqual(ownNat.headers.get('content-disposition'), null, 'تعريف مضمّن آمن');

  const ownRes = await api('GET', '/api/provider/documents/residency', { token: provToken });
  assert.equal(ownRes.status, 200, 'تأييد السكن يُقدَّم للمزوّد');
  const ownBad = await api('GET', '/api/provider/documents/unknown', { token: provToken });
  assert.equal(ownBad.status, 400, 'حقل غير معروف يُرفض');

  // المسؤول/الوكيل يطلعان على مستندي المزوّد عبر مسار الإدارة (blob لا مسار ملف عام)
  for (const token of [tokens.admin, tokens.agent]) {
    const doc = await api('GET', `/api/providers/${store.id}/documents/national_id`, { token });
    assert.equal(doc.status, 200, 'المستند يُقدَّم للمصادق المرخّص');
    assert.equal(doc.headers.get('content-type'), 'image/webp');
  }

  // الزبون لا يستطيع الاطلاع على مستندات غيره
  const asCustomer = await api('GET', `/api/providers/${store.id}/documents/national_id`, { token: tokens.customer });
  assert.equal(asCustomer.status, 403, 'الزبون ممنوع من قراءة مستندات المزوّد');

  // بلا مصادقة → 401 على كلا المسارين
  const anon1 = await api('GET', `/api/providers/${store.id}/documents/national_id`, {});
  assert.equal(anon1.status, 401, 'بلا مصادقة يُرفض مسار الإدارة');
  const anon2 = await api('GET', '/api/provider/documents/national_id', {});
  assert.equal(anon2.status, 401, 'بلا مصادقة يُرفض مسار المزوّد');

  // تنظيف مستندات الاختبار
  fs.rmSync(path.join(DOCS_DIR, String(store.id)), { recursive: true, force: true });
});

test('الإلزام بالتوثيق: معطّل افتراضياً يمنع غير الموثق فقط عند تفعيله', async () => {
  const provToken = tokens.provider;
  const prodBody = { name_ar: 'منتج إلزام التوثيق', price: 1000, stock: 5 };

  // الافتراضي: لا إلزام → النشر متاح حتى لو غير موثق
  const base = get('SELECT verification_status FROM providers WHERE id = ?', [store.id]).verification_status;
  run("UPDATE providers SET verification_status = 'pending' WHERE id = ?", [store.id]);
  const create0 = await api('POST', '/api/provider/products', { token: provToken, body: prodBody });
  assert.equal(create0.status, 201, `الإصدار التجريبي بدون إلزام يسمح بالنشر (كان ${base})`);
  const pid = create0.json.data.id;
  await api('DELETE', `/api/provider/products/${pid}`, { token: provToken });

  // تفعيل الإلزام: غير الموثق لا ينشر ولا يفعّل
  const setOn = await api('PUT', '/api/settings', { token: tokens.admin, body: { require_provider_verification: { value: '1' } } });
  assert.equal(setOn.status, 200, JSON.stringify(setOn.json));
  const blocked = await api('POST', '/api/provider/products', { token: provToken, body: prodBody });
  assert.equal(blocked.status, 403, 'غير الموثق ممنوع من النشر عند التفعيل');
  // عنصر معطّل حالياً في كتالوج المزوّد لا يُفعَّل
  const offItem = get("SELECT id FROM products WHERE provider_id = ? AND is_active = 0 ORDER BY id LIMIT 1", [store.id]);
  if (offItem) {
    const tog = await api('POST', `/api/provider/products/${offItem.id}/toggle`, { token: provToken });
    assert.equal(tog.status, 403, 'غير الموثق لا يفعّل عنصراً موقوفاً');
  }

  // بعد التوثيق (موافقة الوكيل) يعود النشر متاحاً
  const approve = await api('POST', `/api/providers/${store.id}/verify`, { token: tokens.admin, body: { status: 'approved', note: 'موثق' } });
  assert.equal(approve.status, 200, JSON.stringify(approve.json));
  const ok = await api('POST', '/api/provider/products', { token: provToken, body: prodBody });
  assert.equal(ok.status, 201, 'الموثّق ينشر حتى مع تفعيل الإلزام');
  await api('DELETE', `/api/provider/products/${ok.json.data.id}`, { token: provToken });

  // الإخراج: إيقاف الإلزام واسترجاع حالة المزوّد الأصلية
  await api('PUT', '/api/settings', { token: tokens.admin, body: { require_provider_verification: { value: '0' } } });
  run("UPDATE providers SET verification_status = ? WHERE id = ?", [base, store.id]);
});

test('هجرة /uploads القديمة إلى /docs عند إعادة التقديم', async () => {
  const provToken = tokens.provider;
  const upFile = await api('POST', '/api/upload', { token: provToken, body: { data: TINY_PNG } });
  assert.equal(upFile.status, 200, JSON.stringify(upFile.json));
  const legacyUrl = upFile.json.data.url;
  const legacyAbs = path.join(__dirname, '../data/uploads', legacyUrl.replace('/uploads/', ''));

  const sub = await api('PUT', '/api/provider/verification', { token: provToken, body: { national_id_image: legacyUrl } });
  assert.equal(sub.status, 200, JSON.stringify(sub.json));
  const row = get('SELECT national_id_image FROM providers WHERE id = ?', [store.id]);
  assert.match(row.national_id_image, new RegExp(`^/docs/${store.id}/`), 'رُحّل إلى المستودع المركزي');
  assert.ok(!fs.existsSync(legacyAbs), 'الأصلي في /uploads حُذف بعد الهجرة');

  fs.rmSync(path.join(DOCS_DIR, String(store.id)), { recursive: true, force: true });
});

test.after(async () => {
  // قاعدة الاختبار مؤقتة — نُغلق الخادم وننظف مجلد المستندات
  await new Promise((resolve) => server.close(resolve));
  close();
  fs.rmSync(DOCS_DIR, { recursive: true, force: true });
});