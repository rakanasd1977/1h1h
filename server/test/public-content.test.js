const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

process.env.NODE_ENV = 'test';
process.env.DB_PATH = path.join(os.tmpdir(), `rafidain-content-${process.pid}-${crypto.randomUUID()}.db`);
process.env.JWT_SECRET = 'content-test-secret';
process.env.RATE_LIMIT_MAX = '100000';
delete process.env.TRUST_PROXY;

require('../src/db/seed');

const app = require('../src/app');
const { close } = require('../src/db');

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
  return r.json.data.token;
}

let tokens = {};
test.before(async () => { tokens.admin = await login('admin@rafidain.iq', 'Admin@123'); });
test.after(() => {
  server.close();
  close();
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(process.env.DB_PATH + suffix); } catch (e) { /* تجاهل */ }
  }
});

test('نقطة المحتوى العامة تُرجع سياسة الخصوصية والأسئلة الافتراضية', async () => {
  const r = await api('GET', '/api/public/content');
  assert.equal(r.status, 200);
  assert.ok(typeof r.json.data.privacy_policy === 'string' && r.json.data.privacy_policy.length > 0, 'سياسة الخصوصية غير فارغة');
  assert.ok(Array.isArray(r.json.data.faq) && r.json.data.faq.length > 0, 'الأسئلة الشائعة غير فارغة');
  assert.ok(r.json.data.faq.every((f) => f && typeof f.question === 'string' && typeof f.answer === 'string'), 'كل سؤال له نص وسؤال');
});

test('تحديث المحتوى عبر الإعدادات ينعكس على النقطة العامة', async () => {
  const privacy = 'سياسة تجريبية للاختبار.';
  const faq = [{ question: 'سؤال اختبار؟', answer: 'جواب اختبار.' }];
  await api('PUT', '/api/settings/privacy_policy', { token: tokens.admin, body: { value: privacy } });
  await api('PUT', '/api/settings/faq', { token: tokens.admin, body: { value: JSON.stringify(faq) } });
  const r = await api('GET', '/api/public/content');
  assert.equal(r.status, 200);
  assert.equal(r.json.data.privacy_policy, privacy, 'سياسة الخصوصية المحدّثة تظهر');
  assert.equal(r.json.data.faq.length, 1, 'سؤال واحد فقط');
  assert.equal(r.json.data.faq[0].question, 'سؤال اختبار؟');
});
