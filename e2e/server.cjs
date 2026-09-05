// مُقلّد خادم API للاختبارات E2E: قاعدة مؤقتة + بيانات بذور + تشغيل فعلي على 4001.
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

process.env.NODE_ENV = 'test';
process.env.PORT = '4001';
process.env.DB_PATH = path.join(os.tmpdir(), `rafidain-e2e-${process.pid}-${crypto.randomUUID()}.db`);
process.env.JWT_SECRET = 'e2e-secret-' + crypto.randomBytes(16).toString('hex');
process.env.RATE_LIMIT_MAX = '1000000';
delete process.env.TRUST_PROXY;
process.env.VAPID_KEYS_PATH = path.join(os.tmpdir(), `rafidain-e2e-vapid-${process.pid}.json`);

const { migrate } = require('../server/src/db/migrate.ts');
migrate();
require('../server/src/db/seed.ts');

// index.ts يُشغّل منطق cluster فقط عندما يكون هو المدخل (require.main === module)،
// ومدخلنا هنا هو server.cjs — لذلك نعطي الشغّل مباشرةً (عملية واحدة) بدل الحسبان على الإقلاع الجماعي.
const app = require('../server/src/app.ts');
const config = require('../server/src/config.ts');
app.listen(config.port, () => {
  console.log(`[e2e] ${config.appName} API listening on http://localhost:${config.port} (pid ${process.pid})`);
});
