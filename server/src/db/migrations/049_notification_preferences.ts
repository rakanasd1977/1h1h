const { db, run, get } = require('../index');

module.exports = {
  name: "049_notification_preferences",
  // تفضيلات الإشعارات لكل مستخدم: تشغيل/إيقاف القنوات (داخل التطبيق وWeb Push)
  // والفئات. الافتراضي كل شيء مفعّل حتى لا يتغيّر سلوك أي مستخدم ما لم يختار غير ذلك.
  up: () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS notification_preferences (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        in_app INTEGER NOT NULL DEFAULT 1,
        push INTEGER NOT NULL DEFAULT 1,
        categories TEXT NOT NULL DEFAULT '{"order":true,"wallet":true,"promotions":true,"announcement":true,"providers":true}',
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  },
};