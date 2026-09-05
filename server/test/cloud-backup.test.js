const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

process.env.NODE_ENV = 'test';
process.env.DB_PATH = path.join(os.tmpdir(), `rafidain-cb-${process.pid}-${crypto.randomUUID()}.db`);
process.env.JWT_SECRET = 'integration-test-secret';
delete process.env.S3_ENDPOINT;
delete process.env.S3_BUCKET;
delete process.env.S3_ACCESS_KEY;
delete process.env.S3_SECRET_KEY;
delete process.env.GCS_BUCKET;
delete process.env.GCS_CREDENTIALS_JSON;

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

let adminToken;
test.before(async () => {
  adminToken = await login('admin@rafidain.iq', 'Admin@123', 'admin');
});
test.after(() => { server.close(); });

test('s3Config يعيد null عند غياب إعداد المزوّد', () => {
  const { s3Config } = require('../src/services/cloud-backup');
  assert.equal(s3Config(), null);
});

test('s3Config يقرأ إعدادات R2/B2 عند ضبطها', () => {
  process.env.S3_ENDPOINT = 'https://acct.r2.cloudflarestorage.com';
  process.env.S3_BUCKET = 'rafidain';
  process.env.S3_ACCESS_KEY = 'key';
  process.env.S3_SECRET_KEY = 'secret';
  process.env.S3_REGION = 'auto';
  process.env.S3_PREFIX = 'backups';
  const { s3Config } = require('../src/services/cloud-backup');
  const cfg = s3Config();
  assert.ok(cfg);
  assert.equal(cfg.bucket, 'rafidain');
  assert.equal(cfg.region, 'auto');
  assert.equal(cfg.prefix, 'backups');
  delete process.env.S3_ENDPOINT;
  delete process.env.S3_BUCKET;
  delete process.env.S3_ACCESS_KEY;
  delete process.env.S3_SECRET_KEY;
  delete process.env.S3_REGION;
  delete process.env.S3_PREFIX;
});

test('runBackupToCloud يعود غير مضبوط دون مزوّد', async () => {
  const { runBackupToCloud } = require('../src/services/cloud-backup');
  const r = await runBackupToCloud();
  assert.equal(r.configured, false);
});

test('buildAuthHeader يولّد توقيع AWS4-صحيح الشكل', () => {
  const { buildAuthHeader } = require('../src/utils/s3');
  const now = new Date('2026-01-01T00:00:00.000Z');
  const url = 'https://acct.r2.cloudflarestorage.com/rafidain/backups/x.db';
  const auth = buildAuthHeader({
    method: 'PUT', url,
    headers: { 'x-amz-content-sha256': 'abc', 'Content-Type': 'application/octet-stream' },
    bodyHash: 'abc', key: 'key', secret: 'secret', region: 'auto', service: 's3', now,
  });
  assert.match(auth, /^AWS4-HMAC-SHA256 Credential=key\/20260101\//);
  assert.match(auth, /SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date/);
  assert.match(auth, /Signature=[a-f0-9]{64}$/);
});

test('الرفع للسحابة يعود غير مضبوط عند غياب أي مزوّد (من خلال الـ API)', async () => {
  const created = await api('POST', '/api/backups', { token: adminToken });
  const name = created.json.data.name;
  const r = await api('POST', `/api/backups/${encodeURIComponent(name)}/upload`, { token: adminToken });
  assert.equal(r.status, 200);
  assert.equal(r.json.data.configured, false);
});