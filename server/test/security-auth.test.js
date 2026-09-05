// اختبارات التحصين الجديد: قفل الحساب، المصادقة الثنائية (TOTP)، جلسات HttpOnly
// مع CSRF، وبصمة الجهاز للجلسات. تستخدم قاعدة بيانات مؤقتة مستقلة لكل تشغيل.
const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

process.env.NODE_ENV = 'test';
process.env.DB_PATH = path.join(os.tmpdir(), `rafidain-authsec-${process.pid}-${crypto.randomUUID()}.db`);
process.env.JWT_SECRET = 'authsec-test-secret';
delete process.env.TRUST_PROXY;
process.env.RATE_LIMIT_MAX = '1000000';
process.env.LOCKOUT_MAX_FAILURES = '3'; // عتبة صغيرة لاختبار القفل سريعاً
process.env.LOCKOUT_DURATION_MIN = '1';

const { generateVAPIDKeys } = require('web-push');
const _vapid = generateVAPIDKeys();
process.env.VAPID_PUBLIC_KEY = _vapid.publicKey;
process.env.VAPID_PRIVATE_KEY = _vapid.privateKey;

require('../src/db/seed');
const app = require('../src/app');
const { close } = require('../src/db');
const { currentCode, verifyCode, generateSecret } = require('../src/utils/totp');
const { fingerprintsMatch } = require('../src/utils/fingerprint');

const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

function cookiesFrom(res) {
  const set = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  const map = {};
  for (const c of set) {
    const [pair] = c.split(';');
    const eq = pair.indexOf('=');
    map[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
  }
  return map;
}

test.after(() => {
  server.close();
  close();
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(process.env.DB_PATH + suffix); } catch (e) { /* تجاهل */ }
  }
});

async function login(email, password, role) {
  return fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, role }),
  });
}

test('قفل الحساب عند فشل الدخول المتكرر', async () => {
  // عدة محاولات خاطئة → يُقفل الحساب حتى مع كلمة مرور صحيحة
  for (let i = 0; i < 3; i++) {
    const res = await login('admin@rafidain.iq', `wrong-${i}`, 'admin');
    assert.equal(res.status, 401);
  }
  const blocked = await login('admin@rafidain.iq', 'Admin@123', 'admin');
  assert.equal(blocked.status, 429);
  const body = await blocked.json();
  assert.match(body.message, /محاولات فاشلة/);
});

test('القفل يرتبط بالاقتران (هوية+IP): فشل من عنوان لا يقفل المستخدم من عنوان آخر', () => {
  const { recordFailure, clearFailures, lockRemaining } = require('../src/utils/lockout');
  const identifier = 'pair.test@rafidain.iq';
  clearFailures(identifier, '10.0.0.9');
  // 3 محاولات فاشلة من عنوان واحد (عتبة الاختبار LOCKOUT_MAX_FAILURES=3)
  recordFailure(identifier, '10.0.0.1');
  recordFailure(identifier, '10.0.0.1');
  recordFailure(identifier, '10.0.0.1');
  // نفس الاقتران مقفول
  assert.notEqual(lockRemaining(identifier, '10.0.0.1'), null, 'الاقتران نفسه يجب أن يُقفل');
  // هوية أخرى/عنوان آخر لم تُنتهك: لا قفل
  assert.equal(lockRemaining(identifier, '10.0.0.2'), null, 'الزبون من عنوان آخر لا يتأثر بمحاولات عنوان غريب');
  assert.equal(lockRemaining('other.user@rafidain.iq', '10.0.0.1'), null, 'الحساب الآخر لا يُسجن مع الاقتران');
});

test('تفجير موزّع من عناوين عديدة لنفس الهوية يُقفلها حتى من عنوان لا فشل فيه', () => {
  const { recordFailure, clearFailures, lockRemaining } = require('../src/utils/lockout');
  const identifier = 'dist.test@rafidain.iq';
  clearFailures(identifier, '10.1.0.9');
  // عتبة العناوين المميّزة = max(3,5) = 5 في بيئة الاختبار
  for (let i = 1; i <= 5; i++) recordFailure(identifier, `10.1.0.${i}`);
  assert.notEqual(lockRemaining(identifier, '10.9.9.9'), null, 'عبر عتبة العناوين: الهوية تُقفل من أي عنوان');
});

test('المصادقة الثنائية: إعداد + تفعيل + إلزام + تحقق + إيقاف', async () => {
  // دخول المسؤول (بعد تجاوز قفل الاختبار السابق ببيئة منفصلة — القفل مُصرّف لكل هيئة)
  const loginRes = await login('agent.baghdad@rafidain.iq', 'Agent@123', 'agent');
  assert.equal(loginRes.status, 200);
  const { token } = (await loginRes.json()).data;

  // الإعداد: سر + otpauth
  const setupRes = await fetch(base + '/api/auth/2fa/setup', { method: 'POST', headers: auth(token) });
  assert.equal(setupRes.status, 200);
  const secret = (await setupRes.json()).data.secret;
  assert.ok(secret.length >= 16);
  assert.ok(verifyCode(secret, currentCode(secret)));

  // التفعيل برمز حي
  const enableRes = await fetch(base + '/api/auth/2fa/enable', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ code: currentCode(secret) }),
  });
  assert.equal(enableRes.status, 200);

  // الدخول التالي يُلزم بالخطوة الثانية
  const second = await login('agent.baghdad@rafidain.iq', 'Agent@123', 'agent');
  assert.equal(second.status, 200);
  const two = await second.json();
  assert.equal(two.data.requires_2fa, true);
  assert.ok(two.data.twofa_token);

  // رمز خاطئ يُرفض
  const badCode = await fetch(base + '/api/auth/2fa/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ twofa_token: two.data.twofa_token, code: '000000' }),
  });
  assert.equal(badCode.status, 401);

  // رمز صحيح يُعطي جلسة كاملة
  const okCode = await fetch(base + '/api/auth/2fa/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ twofa_token: two.data.twofa_token, code: currentCode(secret) }),
  });
  assert.equal(okCode.status, 200);
  const sessionToken = (await okCode.json()).data.token;
  const me = await fetch(base + '/api/auth/me', { headers: auth(sessionToken) });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).data.totp_enabled, 1);

  // الإيقاف يتطلب رمزاً صحيحاً
  const disable = await fetch(base + '/api/auth/2fa/disable', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({ code: currentCode(secret) }),
  });
  assert.equal(disable.status, 200);

  // الدخول التالي يعود مباشراً بلا خطوة ثانية
  const back = await login('agent.baghdad@rafidain.iq', 'Agent@123', 'agent');
  assert.equal(back.status, 200);
  assert.equal((await back.json()).data.requires_2fa, undefined);
});

test('جلسات HttpOnly: كوكي + CSRF (رفض التغييرات بلا رأس)', async () => {
  const loginA = await login('customer.demo@rafidain.iq', 'Customer@123');
  assert.equal(loginA.status, 200);
  const cookiesA = cookiesFrom(loginA);
  assert.ok(cookiesA.rafidain_session);
  assert.ok(cookiesA.rafidain_csrf);
  // الكوكي يجب أن يكون HttpOnly وغير قابل للقراءة من JS (يظهر في Set-Cookie)
  const raw = loginA.headers.getSetCookie().join('; ');
  assert.match(raw, /HttpOnly/);
  assert.match(raw, /SameSite=Lax/);

  const cookieA = `rafidain_session=${cookiesA.rafidain_session}; rafidain_csrf=${cookiesA.rafidain_csrf}`;

  // قراءة عبر الكوكي تعمل
  const me = await fetch(base + '/api/auth/me', { headers: { Cookie: cookieA } });
  assert.equal(me.status, 200);

  // جلسة ثانية (جهاز آخر) لتجربة إبطالها عند تغيير كلمة المرور
  const loginB = await login('customer.demo@rafidain.iq', 'Customer@123');
  const cookiesB = cookiesFrom(loginB);
  const cookieB = `rafidain_session=${cookiesB.rafidain_session}; rafidain_csrf=${cookiesB.rafidain_csrf}`;

  // طلب تعديل بالكوكي بلا رأس CSRF يُرفض
  const noCsrf = await fetch(base + '/api/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieA },
    body: JSON.stringify({ current_password: 'Customer@123', new_password: 'NewPass@123' }),
  });
  assert.equal(noCsrf.status, 403);

  // نفس الطلب مع رأس CSRF المطابق يُقبل
  const withCsrf = await fetch(base + '/api/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieA, 'X-CSRF-Token': cookiesA.rafidain_csrf },
    body: JSON.stringify({ current_password: 'Customer@123', new_password: 'NewPass@123' }),
  });
  assert.equal(withCsrf.status, 200);

  // تغيير كلمة المرور يُبطل جلسات الأجهزة الأخرى ويُبقي الجهاز الحالي
  const otherDevice = await fetch(base + '/api/auth/me', { headers: { Cookie: cookieB } });
  assert.equal(otherDevice.status, 401);
  const currentDevice = await fetch(base + '/api/auth/me', { headers: { Cookie: cookieA } });
  assert.equal(currentDevice.status, 200);

  // الدخول الجديد يتطلب كلمة المرور الجديدة
  const oldPw = await login('customer.demo@rafidain.iq', 'Customer@123');
  assert.equal(oldPw.status, 401);
});

test('بصمة الجهاز: تطابق/اختلاف المفاتيح الخام', () => {
  const a = Buffer.alloc(32, 7).toString('hex');
  const b = Buffer.alloc(32, 7).toString('hex');
  const c = Buffer.alloc(32, 9).toString('hex');
  assert.equal(fingerprintsMatch(a, b), true);
  assert.equal(fingerprintsMatch(a, c), false);
  assert.equal(fingerprintsMatch(null, a), false);
  assert.equal(fingerprintsMatch(a, a.slice(0, 20)), false);
});

test('توليد رمز TOTP صالح داخل النافذة وخارجها', () => {
  const secret = generateSecret();
  const now = Date.now();
  const code = currentCode(secret, now);
  assert.equal(verifyCode(secret, code, now), true);
  // درجة واحدة للأمام (نافذة السماح ±30 ثانية) تُقبل
  assert.equal(verifyCode(secret, code, now + 30000), true);
  // قيم بلا أرقام/طول خاطئ تُرفض
  assert.equal(verifyCode(secret, '12ab', now), false);
  assert.equal(verifyCode(secret, '12345', now), false);
});

test('تغيير البريد: يتطلب كلمة المرور ويرفض التكرار ويعيد تفعيل البريد الجديد', async () => {
  const loginRes = await login('customer.demo@rafidain.iq', 'NewPass@123');
  assert.equal(loginRes.status, 200);
  const { token } = (await loginRes.json()).data;

  const change = (body) => fetch(base + '/api/auth/change-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  // كلمة مرور خاطئة تُرفض
  const wrongPw = await change({ email: 'customer.updated@rafidain.iq', current_password: 'Wrong@123' });
  assert.equal(wrongPw.status, 400);

  // بريد مستخدم مسبقاً يُرفض (تعارض)
  const dup = await change({ email: 'admin@rafidain.iq', current_password: 'NewPass@123' });
  assert.equal(dup.status, 409);

  // تغيير ناجح → يُعطى رمز تفعيل، ويصبح الحساب غير مفعّل حتى تأكيد البريد الجديد
  const ok = await change({ email: 'customer.updated@rafidain.iq', current_password: 'NewPass@123' });
  assert.equal(ok.status, 200);
  const okBody = await ok.json();
  assert.ok(okBody.data.verification_token);

  const me = await fetch(base + '/api/auth/me', { headers: auth(token) });
  assert.equal(me.status, 200);
  const meBody = await me.json();
  assert.equal(meBody.data.email, 'customer.updated@rafidain.iq');
  assert.equal(meBody.data.is_verified, 0);

  // الدخول بالبريد الجديد قبل التفعيل مرفوض
  const blocked = await login('customer.updated@rafidain.iq', 'NewPass@123');
  assert.equal(blocked.status, 403);

  // التفعيل برمز التأكيد يفتح الحساب — ثم الدخول بالبريد الجديد ينجح
  const verifyRes = await fetch(base + '/api/auth/verify-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: okBody.data.verification_token }),
  });
  assert.equal(verifyRes.status, 200);
  const after = await login('customer.updated@rafidain.iq', 'NewPass@123');
  assert.equal(after.status, 200);
});

test('دخول بدور غير مطابق للحساب يُرفض برد 401 موحّد دون كشف وجود الحساب', async () => {
  const mismatch = await login('agent.baghdad@rafidain.iq', 'Agent@123', 'customer');
  assert.equal(mismatch.status, 401);
  assert.match((await mismatch.json()).message, /البريد الإلكتروني أو كلمة المرور غير صحيحة/);

  const ghost = await login('no-such@rafidain.iq', 'whatever', 'customer');
  assert.equal(ghost.status, 401);
  assert.match((await ghost.json()).message, /البريد الإلكتروني أو كلمة المرور غير صحيحة/);
});

test('تغيير البريد عبر /customer/profile مرفوض — التحويل عبر /auth/change-email فقط', async () => {
  const loginRes = await login('customer.updated@rafidain.iq', 'NewPass@123');
  assert.equal(loginRes.status, 200);
  const { token } = (await loginRes.json()).data;
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const diff = await fetch(base + '/api/customer/profile', {
    method: 'PUT', headers: h,
    body: JSON.stringify({ email: 'customer.hacked@rafidain.iq' }),
  });
  assert.equal(diff.status, 400, 'تغيير البريد عبر الملف مرفوض');
  assert.match((await diff.json()).message, /مسار تغيير البريد/);

  const same = await fetch(base + '/api/customer/profile', {
    method: 'PUT', headers: h,
    body: JSON.stringify({ email: 'customer.updated@rafidain.iq' }),
  });
  assert.equal(same.status, 200, 'إعادة إرسال نفس البريد مقبولة');
});
