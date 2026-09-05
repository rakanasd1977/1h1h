// قفل الحساب عند فشل الدخول المتكرر — يمنع تخمين كلمات المرور (تفجير القوة)
// ويستخدم جدول login_failures. تُسجَّل كل محاولة فاشلة مع هوية الدخول وعنوان IP.
//
// مستويات القفل الثلاثة:
//   1) اقتران (هوية + IP): العتبة الأساسية — الموظف الذي ينسى كلمته 5 مرات أمام
//      شاشته يُقفل على جهازه فقط، ولا يُوزَّع حظره على كل العناوين (يُمنع القفل
//      العرضي العابر للشبكات NAT/المكاتب).
//   2) العدد المميّز لعناوين IP لنفس الهوية: كشف التفجير الموزّع — لكن تحتاج
//      الهوية عتبةً من العناوين المختلفة لتحقق، فيتطلب المهاجم عناوين عديدة.
//   3) العنوان IP وحده: كشف القصف المتعدد الهويات من عنوان واحد.
// أي مستوى يبلغ عتبته يقفل الهوية (من كل العناوين) إن كان 1 أو 2، أو يقفل
// العنوان وحده إن كان 3 — حتى لا يتضرر مستخدمو الشبكة المشتركة.
const { get, run } = require('../db');
const config = require('../config');

const enabled = () => config.lockout.enabled;
const { maxFailures, windowMinutes, durationMinutes } = config.lockout;
const WINDOW_MS = windowMinutes * 60000;
const DURATION_MS = durationMinutes * 60000;
// عتبة العنوان أعلى من عتبة الاقتران: الحساب يُقفل أسرع من الشبكة المشتركة
const IP_THRESHOLD = Math.max(maxFailures * 2, 10);
// عتبة العناوين المميّزة لنفس الهوية: تفجير موزّع يتطلب عتبة من عناوين مختلفة
const DISTINCT_IP_THRESHOLD = Math.max(maxFailures, 5);

function iso(ms) {
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
}

// عدد المحاولات الفاشلة خلال نافذة زمنية على المستويات الثلاثة
function recentFailures(identifier, ip) {
  if (!enabled()) return { byPair: 0, byIp: 0, distinctIps: 0 };
  const since = iso(Date.now() - WINDOW_MS);
  const byPair = get(
    'SELECT COUNT(*) AS c FROM login_failures WHERE identifier = ? AND ip = ? AND created_at > ?',
    [identifier, ip, since]
  );
  const byIp = get(
    'SELECT COUNT(*) AS c FROM login_failures WHERE ip = ? AND created_at > ?',
    [ip, since]
  );
  const distinctIps = get(
    'SELECT COUNT(DISTINCT ip) AS c FROM login_failures WHERE identifier = ? AND created_at > ?',
    [identifier, since]
  );
  return {
    byPair: byPair ? byPair.c : 0,
    byIp: byIp ? byIp.c : 0,
    distinctIps: distinctIps ? distinctIps.c : 0,
  };
}

// هل الحساب/العنوان مقفول الآن؟ يُعيد المدة المتبقية بالثواني أو null
function lockRemaining(identifier, ip) {
  if (!enabled()) return null;
  const { byPair, byIp, distinctIps } = recentFailures(identifier, ip);
  if (byPair < maxFailures && byIp < IP_THRESHOLD && distinctIps < DISTINCT_IP_THRESHOLD) return null;

  // أول محاولة تجاوزت العتبة حددت بداية القفل؛ نحسب الباقي من أحدث قيد داخل النافذة
  const since = iso(Date.now() - WINDOW_MS);
  let latest;
  if (byPair >= maxFailures) {
    latest = get(
      'SELECT MAX(created_at) AS m FROM login_failures WHERE identifier = ? AND ip = ? AND created_at > ?',
      [identifier, ip, since]
    );
  } else if (distinctIps >= DISTINCT_IP_THRESHOLD) {
    latest = get(
      'SELECT MAX(created_at) AS m FROM login_failures WHERE identifier = ? AND created_at > ?',
      [identifier, since]
    );
  } else {
    latest = get(
      'SELECT MAX(created_at) AS m FROM login_failures WHERE ip = ? AND created_at > ?',
      [ip, since]
    );
  }
  const latestMs = latest && latest.m ? new Date(latest.m + 'Z').getTime() : Date.now();
  const remaining = DURATION_MS - (Date.now() - latestMs);
  return remaining > 0 ? Math.ceil(remaining / 1000) : null;
}

// تسجيل محاولة فاشلة (تُستدعى قبل رمي خطأ 401)
function recordFailure(identifier, ip) {
  if (!enabled()) return;
  run('INSERT INTO login_failures (identifier, ip) VALUES (?,?)', [identifier, ip]);
  // تقليم قديم لتحديد الحجم
  run("DELETE FROM login_failures WHERE created_at <= datetime('now', '-1 day')");
}

// عند نجاح الدخول: مسح سجل الفشل لهذه الهوية حتى لا تُعاقب جلسة ناجحة لاحقاً
function clearFailures(identifier, ip) {
  run('DELETE FROM login_failures WHERE identifier = ? OR ip = ?', [identifier, ip]);
}

module.exports = { recordFailure, clearFailures, lockRemaining, recentFailures };