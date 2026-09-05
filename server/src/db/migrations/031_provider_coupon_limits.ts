const { db, run, all, get } = require('../index');

module.exports = {
  name: "031_provider_coupon_limits",
  up: () => {
    const seed = (key, value, label) => {
      const exists = get("SELECT key FROM settings WHERE key = ?", [key]);
      if (!exists) run("INSERT INTO settings (key, value, label) VALUES (?,?,?)", [key, value, label]);
    };
    seed("provider_coupon_max_percent", "50", "الحد الأقصى لنسبة خصم كوبونات المزودين (%)");
    seed("provider_coupon_max_fixed", "100000", "الحد الأقصى لخصم الكوبون الثابت للمزودين (دينار)");
  },
};