const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

process.env.NODE_ENV = 'test';
process.env.DB_PATH = path.join(os.tmpdir(), `rafidain-notify-${process.pid}-${crypto.randomUUID()}.db`);
process.env.JWT_SECRET = 'notify-test-secret';
process.env.RATE_LIMIT_MAX = '100000';
delete process.env.TRUST_PROXY;

require('../src/db/seed');

const app = require('../src/app');
const { get, close } = require('../src/db');

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
  tokens.customer = await login('customer.demo@rafidain.iq', 'Customer@123');
});
test.after(() => {
  server.close();
  close();
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(process.env.DB_PATH + suffix); } catch (e) { /* تجاهل */ }
  }
});

test('المسؤول يرسل إشعاراً لجميع الزبائن', async () => {
  const before = get('SELECT COUNT(*) AS c FROM notifications');
  const r = await api('POST', '/api/admin/notifications/send', { token: tokens.admin, body: { title: 'إشعار تجريبي', body: 'هذا نص تجريبي', target: 'role', role: 'customer' } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.ok(r.json.data.recipients >= 1, 'أُرسل لزبون واحد على الأقل');

  const after = get('SELECT COUNT(*) AS c FROM notifications');
  assert.ok(after.c > before.c, 'زادت الإشعارات');
  const sample = get("SELECT * FROM notifications WHERE title = ? ORDER BY id DESC LIMIT 1", ['إشعار تجريبي']);
  assert.ok(sample, 'وُجدت الإشعارات');
});

test('إشعار بلا عنوان/نص يُرفض', async () => {
  const r = await api('POST', '/api/admin/notifications/send', { token: tokens.admin, body: { title: '', body: '' } });
  assert.equal(r.status, 400);
});

test('الزبون لا يرسل إشعارات', async () => {
  const r = await api('POST', '/api/admin/notifications/send', { token: tokens.customer, body: { title: 'x', body: 'y' } });
  assert.equal(r.status, 403);
});
