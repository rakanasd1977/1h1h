// اختبارات استرجاع كلمة السر للزبون: طلب رمز (POST /api/auth/forgot-password)
// وإنشاء كلمة مرور جديدة (POST /api/auth/forgot-password/confirm).
const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

process.env.NODE_ENV = 'test';
process.env.DB_PATH = path.join(os.tmpdir(), `rafidain-forgot-${process.pid}-${crypto.randomUUID()}.db`);
process.env.JWT_SECRET = 'forgot-test-secret';
delete process.env.TRUST_PROXY;
process.env.RATE_LIMIT_MAX = '1000000';

const { generateVAPIDKeys } = require('web-push');
const _vapid = generateVAPIDKeys();
process.env.VAPID_PUBLIC_KEY = _vapid.publicKey;
process.env.VAPID_PRIVATE_KEY = _vapid.privateKey;

require('../src/db/seed');
const app = require('../src/app');
const { close } = require('../src/db');

const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

test.after(() => {
  server.close();
  close();
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(process.env.DB_PATH + suffix); } catch (e) { /* تجاهل */ }
  }
});

async function post(url, body) {
  return fetch(base + url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
}

async function login(email, password, role = 'customer') {
  return post('/api/auth/login', { email, password, role });
}

test('طلب رمز استرجاع لحساب زبون موجود يردّ الرمز', async () => {
  const res = await post('/api/auth/forgot-password', { email: 'customer.demo@rafidain.iq' });
  assert.equal(res.status, 200);
  const data = (await res.json()).data;
  assert.ok(data.verification_token, 'يجب إرجاع رمز الاسترجاع (مسار التطوير بلا بريد)');
  assert.match(data.message, /رمز الاسترجاع/);
});

test('طلب رمز لبريد غير موجود يردّ رسالة موحّدة بلا رمز (عدّم كشف الوجود)', async () => {
  const res = await post('/api/auth/forgot-password', { email: 'no.such.user@rafidain.iq' });
  assert.equal(res.status, 200);
  const data = (await res.json()).data;
  assert.equal(data.verification_token, undefined);
  assert.match(data.message, /إن وُجد حساب/);
});

test('طلب رمز لحساب امتياز (admin) لا يُصدر رمزاً', async () => {
  const res = await post('/api/auth/forgot-password', { email: 'admin@rafidain.iq' });
  assert.equal(res.status, 200);
  const data = (await res.json()).data;
  assert.equal(data.verification_token, undefined);
});

test('طلب بلا بريد يرفض 400', async () => {
  const res = await post('/api/auth/forgot-password', {});
  assert.equal(res.status, 400);
});

test('إنشاء كلمة مرور جديدة برمز صحيح ثم الدخول بها', async () => {
  const req = await post('/api/auth/forgot-password', { email: 'customer.demo@rafidain.iq' });
  const { verification_token } = (await req.json()).data;

  const confirm = await post('/api/auth/forgot-password/confirm', { token: verification_token, new_password: 'NewPass@12345' });
  assert.equal(confirm.status, 200);

  // كلمة المرور القديمة لم تعد صالحة
  const oldLogin = await login('customer.demo@rafidain.iq', 'Customer@123');
  assert.equal(oldLogin.status, 401);

  // كلمة المرور الجديدة تعمل
  const newLogin = await login('customer.demo@rafidain.iq', 'NewPass@12345');
  assert.equal(newLogin.status, 200);
});

test('إعادة استخدام نفس الرمز بعد النجاح تُرفض (رمز لمرة واحدة)', async () => {
  const req = await post('/api/auth/forgot-password', { email: 'customer.demo@rafidain.iq' });
  const { verification_token } = (await req.json()).data;
  assert.equal((await post('/api/auth/forgot-password/confirm', { token: verification_token, new_password: 'NewPass@54321' })).status, 200);
  const again = await post('/api/auth/forgot-password/confirm', { token: verification_token, new_password: 'Other@99999' });
  assert.equal(again.status, 400);
});

test('رمز خاطئ أو كلمة مرور قصيرة يُرفضان', async () => {
  const badToken = await post('/api/auth/forgot-password/confirm', { token: 'wrong-token', new_password: 'ValidPass@1' });
  assert.equal(badToken.status, 400);

  const req = await post('/api/auth/forgot-password', { email: 'customer.demo@rafidain.iq' });
  const { verification_token } = (await req.json()).data;
  const short = await post('/api/auth/forgot-password/confirm', { token: verification_token, new_password: '123' });
  assert.equal(short.status, 400);
});

test('تأكيد بلا رمز أو بلا كلمة مرور يرفض 400', async () => {
  assert.equal((await post('/api/auth/forgot-password/confirm', { new_password: 'ValidPass@1' })).status, 400);
  assert.equal((await post('/api/auth/forgot-password/confirm', { token: 'x' })).status, 400);
});

test('عزل الغرضين: رمز الاسترجاع لا يفعّل البريد، ورمز التفعيل لا يسترجع كلمة المرور', async () => {
  // رمز الاسترجاع (reset) يُرفض في verify-email
  const req = await post('/api/auth/forgot-password', { email: 'customer.demo@rafidain.iq' });
  const { verification_token } = (await req.json()).data;
  const verifyEmail = await post('/api/auth/verify-email', { token: verification_token });
  assert.equal(verifyEmail.status, 400, 'رمز الاسترجاع لا يصلح كرمز تفعيل للبريد');

  // رمز التفعيل (verify) يُرفض في forgot-password/confirm
  const reg = await post('/api/auth/register-customer', {
    name_ar: 'اختبار عزل الغرضين',
    email: 'token.purpose@rafidain.iq',
    phone: '07709998877',
    password: 'Purpose@123',
  });
  assert.equal(reg.status, 201);
  const verifyToken = (await reg.json()).data.verification_token;
  const confirm = await post('/api/auth/forgot-password/confirm', { token: verifyToken, new_password: 'Hacked@123' });
  assert.equal(confirm.status, 400, 'رمز التفعيل لا يصلح كرمز استرجاع');
});