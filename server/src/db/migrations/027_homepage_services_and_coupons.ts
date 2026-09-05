const { db, run, all, get } = require('../index');

module.exports = {
  name: "027_homepage_services_and_coupons",
  up: () => {
    const ALL_SERVICES = [
      { slug: "stores", ar: "المتاجر", en: "Stores", icon: "🛒", desc: "متاجر متعددة لبيع المنتجات والبضائع", sort: 1 },
      { slug: "restaurants", ar: "المطاعم", en: "Restaurants", icon: "🍽️", desc: "مطاعم لطلب الوجبات والطعام", sort: 2 },
      { slug: "hotels", ar: "الفنادق", en: "Hotels", icon: "🏨", desc: "فنادق لحجز الغرف والإقامة", sort: 3 },
      { slug: "flights", ar: "حجز الطيران", en: "Flights", icon: "✈️", desc: "حجز تذاكر الطيران المحلي والدولي", sort: 4 },
      { slug: "travel_offices", ar: "مكاتب السفر", en: "Travel Offices", icon: "🧳", desc: "مكاتب سفر للرحلات والباقات السياحية", sort: 5 },
      { slug: "pharmacies", ar: "مواد انشائية", en: "Construction Materials", icon: "🧱", desc: "مواد بناء وإنشاءات", sort: 6 },
      { slug: "electronics", ar: "الإلكترونيات", en: "Electronics", icon: "📱", desc: "هواتف وأجهزة إلكترونية وإكسسوارات", sort: 7 },
      { slug: "fashion", ar: "الأزياء", en: "Fashion", icon: "👗", desc: "ملابس وأزياء وعطور", sort: 8 },
      { slug: "grocery", ar: "البقالة", en: "Grocery", icon: "🥬", desc: "مواد غذائية واستهلاكية", sort: 9 },
      { slug: "home_services", ar: "مواد منزلية", en: "Home Materials", icon: "🧺", desc: "مواد وأدوات منزلية", sort: 10 },
    ];
    const ins = (s) => run(
      "INSERT OR IGNORE INTO services (slug, name_ar, name_en, icon, description, sort_order) VALUES (?,?,?,?,?,?)",
      [s.slug, s.ar, s.en, s.icon, s.desc, s.sort]
    );
    ALL_SERVICES.forEach(ins);

    const fmt = (d) => d.toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
    const now = fmt(new Date());
    const ends = fmt(new Date(Date.now() + 90 * 864e5));
    const COUPONS = [
      { code: "RAFIDAIN10", title: "خصم 10% على أول طلب", type: "percent", value: 10, min: 1e4 },
      { code: "SAVE20", title: "خصم 20% على الطلبات الكبيرة", type: "percent", value: 20, min: 5e4 },
      { code: "BIG50", title: "خصم 50% لفترة محدودة", type: "percent", value: 50, min: 1e5 },
      { code: "FIX5K", title: "خصم 5000 د.ع على أي طلب", type: "fixed", value: 5e3, min: 3e4 },
    ];
    COUPONS.forEach((c) => run(
      "INSERT OR IGNORE INTO coupons (code, title, discount_type, discount_value, min_amount, starts_at, ends_at, max_uses, per_customer_limit, is_active) VALUES (?,?,?,?,?,?,?,0,1,1)",
      [c.code, c.title, c.type, c.value, c.min, null, ends]
    ));
  },
};