const { get, run } = require('../db');
const { ApiError } = require('../utils/helpers');

// الفئات المعروضة للمستخدم، مع النصوص التوضيحية (تُترجم عبر لوحة الواجهة).
const CATEGORIES = ['order', 'wallet', 'promotions', 'announcement', 'providers'];

const DEFAULT_CATEGORIES = Object.fromEntries(CATEGORIES.map((c) => [c, true]));

// إعادة توجيه نوع الإشعار (المخزَّن في notifications.type) إلى فئة تفضيل معروفة.
function categoryForType(type) {
  const t = String(type || 'order');
  if (/^order|order_/.test(t)) return 'order';
  if (/^(recharge|wallet|withdrawal)/.test(t)) return 'wallet';
  if (/^(promotion|coupon|offer)/.test(t)) return 'promotions';
  if (/^announcement/.test(t)) return 'announcement';
  if (/^provider/.test(t)) return 'providers';
  return 'order';
}

function defaultPrefsFor(userId) {
  return {
    user_id: userId,
    in_app: true,
    push: true,
    categories: { ...DEFAULT_CATEGORIES },
  };
}

// يقرأ تفضيلات المستخدم مع بناء احتياطي صامت إن لم تُسجَّل بعد (كل شيء مفعّل).
function getPreferences(userId) {
  const row = get('SELECT in_app, push, categories FROM notification_preferences WHERE user_id = ?', [userId]);
  if (!row) return defaultPrefsFor(userId);
  let categories;
  try { categories = JSON.parse(row.categories); } catch (e) { categories = { ...DEFAULT_CATEGORIES }; }
  return {
    user_id: userId,
    in_app: !!row.in_app,
    push: !!row.push,
    categories,
  };
}

// يحفظ التفضيلات; يُقبل جزء أو كل الحقول. يتبع الخطأ للتحقق من المدخلات بشكل سليم.
function setPreferences(userId, body) {
  if (!body || typeof body !== 'object') throw new ApiError(400, 'البيانات المطلوبة غير صحيحة');

  const existing = getPreferences(userId);

  let inApp = existing.in_app;
  let push = existing.push;
  let categories = { ...existing.categories };

  if ('in_app' in body) {
    inApp = !!body.in_app;
  }
  if ('push' in body) {
    push = !!body.push;
  }
  if ('categories' in body) {
    if (!body.categories || typeof body.categories !== 'object' || Array.isArray(body.categories)) {
      throw new ApiError(400, 'الفئات يجب أن تكون كائناً من قيم صحيحة/خاطئة');
    }
    categories = { ...DEFAULT_CATEGORIES };
    for (const c of CATEGORIES) {
      if (c in body.categories) categories[c] = !!body.categories[c];
    }
    // لا تسمح بفئات غير معروفة
    for (const key of Object.keys(body.categories)) {
      if (!CATEGORIES.includes(key)) throw new ApiError(400, `فئة غير معروفة: ${key}`);
    }
  }

  run(
    `INSERT INTO notification_preferences (user_id, in_app, push, categories, updated_at)
     VALUES (?,?,?,?,datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET
       in_app = excluded.in_app,
       push = excluded.push,
       categories = excluded.categories,
       updated_at = excluded.updated_at`,
    [userId, inApp ? 1 : 0, push ? 1 : 0, JSON.stringify(categories)]
  );

  return { user_id: userId, in_app: inApp, push, categories };
}

module.exports = { getPreferences, setPreferences, categoryForType, CATEGORIES, DEFAULT_CATEGORIES };