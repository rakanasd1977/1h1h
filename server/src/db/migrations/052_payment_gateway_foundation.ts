const { db, run, get } = require('../index');

// أساس بنية بوابات الدفع (خالٍ من الكود الفعلي).
// جميع البوابات تُسجَّل معطّلة افتراضياً (is_active=0) حتى تتوفر أوراق تأسيس الشركة
// واعتمادات التاجر الفعلية. النطاق معزول تماماً عن نظام المحافظ الحالي
// (provider_wallets / recharge_requests) ولا يمسّه.
const GATEWAY_SCHEMAS = [
  { code: 'zain_cash', name_ar: 'زين كاش', name_en: 'Zain Cash', type: 'wallet' },
  { code: 'asia_pay', name_ar: 'آسيا باي', name_en: 'Asia Pay', type: 'wallet' },
  { code: 'qi_card', name_ar: 'كيو كارد', name_en: 'Qi Card', type: 'bank_transfer' },
  { code: 'first_iraqi_bank', name_ar: 'مصرف العراق الأول', name_en: 'First Iraqi Bank', type: 'bank_transfer' },
  { code: 'al_ahli_bank', name_ar: 'المصرف الأهلي', name_en: 'Al-Ahli Bank', type: 'bank_transfer' },
  { code: 'fawateer', name_ar: 'الفواتير', name_en: 'Fawateer', type: 'fintech' },
  { code: 'zinpay', name_ar: 'زين باي', name_en: 'ZinPay', type: 'fintech' },
];

module.exports = {
  name: '052_payment_gateway_foundation',
  up: () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS payment_gateways (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        name_ar TEXT NOT NULL,
        name_en TEXT,
        type TEXT NOT NULL DEFAULT 'wallet',
        is_active INTEGER NOT NULL DEFAULT 0,
        config TEXT,
        sandbox INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS payment_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reference TEXT NOT NULL UNIQUE,
        gateway_code TEXT NOT NULL,
        gateway_txn_id TEXT,
        provider_id INTEGER,
        amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'IQD',
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','failed','refunded')),
        meta TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT,
        FOREIGN KEY (gateway_code) REFERENCES payment_gateways(code)
      );

      CREATE INDEX IF NOT EXISTS idx_payment_transactions_gateway_status ON payment_transactions(gateway_code, status);
    `);

    // تسجيل البوابات العراقية كسجلات مرجعية معطّلة (لا أي تشغيل فعلي).
    GATEWAY_SCHEMAS.forEach((g, i) => {
      run(
        `INSERT OR IGNORE INTO payment_gateways (code, name_ar, name_en, type, is_active, sandbox, sort_order)
         VALUES (?,?,?,?,0,1,?)`,
        [g.code, g.name_ar, g.name_en, g.type, i]
      );
    });

    // إعدادات عامة للبوابات (منفصلة عن إعادة الشحن الحالية).
    run(`INSERT OR IGNORE INTO settings (key, value, label) VALUES
      ('payment_default_gateway', '', 'بوابة الدفع الافتراضية (تُفعَّل لاحقاً)'),
      ('payment_gateway_mode', 'sandbox', 'وضع بوابات الدفع (sandbox/live)')`);
  },
  down: () => {
    db.exec(`
      DROP TABLE IF EXISTS payment_transactions;
      DROP TABLE IF EXISTS payment_gateways;
    `);
    run("DELETE FROM settings WHERE key IN ('payment_default_gateway','payment_gateway_mode')");
  },
};