const { db, run, all, get } = require('../index');

module.exports = {
  name: "033_loyalty_and_referral",
  up: () => {
    // أعمدة الولاء والإحالة على المستخدمين
    const ucols = all("PRAGMA table_info(users)").map((c) => c.name);
    if (!ucols.includes("points_balance")) run("ALTER TABLE users ADD COLUMN points_balance INTEGER NOT NULL DEFAULT 0");
    if (!ucols.includes("points_total")) run("ALTER TABLE users ADD COLUMN points_total INTEGER NOT NULL DEFAULT 0");
    if (!ucols.includes("referral_code")) run("ALTER TABLE users ADD COLUMN referral_code TEXT");
    if (!ucols.includes("referred_by")) run("ALTER TABLE users ADD COLUMN referred_by INTEGER REFERENCES users(id)");

    run(`CREATE TABLE IF NOT EXISTS loyalty_points (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL DEFAULT 'earn',
        points INTEGER NOT NULL,
        description TEXT,
        order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`);
    run("CREATE INDEX IF NOT EXISTS idx_loyalty_user ON loyalty_points(user_id, id)");

    // أعمدة الخصم بالنقاط على الطلبات
    const ocols = all("PRAGMA table_info(orders)").map((c) => c.name);
    if (!ocols.includes("points_discount_amount")) run("ALTER TABLE orders ADD COLUMN points_discount_amount REAL NOT NULL DEFAULT 0");
    if (!ocols.includes("redeemed_points")) run("ALTER TABLE orders ADD COLUMN redeemed_points INTEGER NOT NULL DEFAULT 0");

    // توليد رمز إحالة فريد لكل زبون لا يملك رمزاً
    const customers = all("SELECT id FROM users WHERE role = 'customer' AND referral_code IS NULL");
    for (const u of customers) {
      const code = "RAF" + (1e5 + u.id).toString(36).toUpperCase();
      run("UPDATE users SET referral_code = ? WHERE id = ?", [code, u.id]);
    }
    run("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code) WHERE referral_code IS NOT NULL");

    // إعدادات الولاء والإحالة
    const seed = (key, value, label) => {
      const exists = get("SELECT key FROM settings WHERE key = ?", [key]);
      if (!exists) run("INSERT INTO settings (key, value, label) VALUES (?,?,?)", [key, value, label]);
    };
    seed("loyalty_earn_per_1000", "10", "نقاط الولاء المكتسبة لكل 1000 دينار من قيمة الطلب");
    seed("loyalty_point_value", "1", "قيمة النقطة الواحدة عند استبدالها بالخصم (دينار)");
    seed("loyalty_min_redeem", "100", "الحد الأدنى للنقاط القابلة للاستبدال");
    seed("referral_bonus_referrer", "1000", "مكافأة مَن دعا صديقاً (نقطة ولاء)");
    seed("referral_bonus_referee", "3000", "مكافأة الصديق المدعو بعد أول طلب (نقطة ولاء)");
    seed("referral_min_order", "10000", "الحد الأدنى لقيمة أول طلب للمدعو لتفعيل مكافأة الإحالة");
  },
};