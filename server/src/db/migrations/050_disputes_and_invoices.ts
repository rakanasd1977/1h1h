const { db, run } = require('../index');

module.exports = {
  name: "050_disputes_and_invoices",
  // النزاعات (Disputes): فتح نزاع على طلب مكتمل/ملغي خلال نافذة زمنية، ومراجعتها/حسمها
  // من المسؤول مع إمكانية ردّ مبلغ جزئي/كامل من رصيد المزوّد (من provider_amount وليس العمولة).
  // الفواتير (Invoices): فاتورة إلكترونية لكل طلب (ضرائب من الإعدادات، عملة الاختيار IQD افتراضياً).
  up: () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS disputes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        opened_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        party TEXT NOT NULL DEFAULT 'customer',
        reason TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        resolution TEXT,
        refund_amount REAL NOT NULL DEFAULT 0,
        resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        resolved_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_disputes_order ON disputes(order_id);
      CREATE INDEX IF NOT EXISTS idx_disputes_opened_by ON disputes(opened_by);
      CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);

      CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        number TEXT NOT NULL UNIQUE,
        subtotal REAL NOT NULL,
        discount_amount REAL NOT NULL DEFAULT 0,
        tax_rate REAL NOT NULL DEFAULT 0,
        tax_amount REAL NOT NULL DEFAULT 0,
        total REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'IQD',
        issued_at TEXT NOT NULL DEFAULT (datetime('now')),
        html_url TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_invoices_order ON invoices(order_id);
    `);
  },
};