const { get, all, run } = require('../db');
const { ApiError, toId, round2 } = require('../utils/helpers');

// ============================================================================
// أساس بوابات الدفع (خالٍ من التشغيل الفعلي).
//
// هدف هذه الطبقة: تثبيت "عقد" بوابة الدفع الموحّد (registry + resolve + log)
// بحيث تُضاف لاحقاً أي بوابة فعلية بملف واحد يطبّق الدوال الثلاث أدناه، دون
// لمس نظام المحافظ الحالي (provider_wallets / recharge_requests) إطلاقاً.
//
// الضمانة الجوهرية: كل بوابة مُسجَّلة بِـ is_active=0، فلن يعبر أي طلب عبر
// resolveGateway إلا إذا كانت مفعّلة فعلياً. النطاق الحالي يوضع معطّلاً.
// ============================================================================

// عقد البوابة المتوافق: أي بوابة فعلية مستقبلية يجب أن توفر هذه الدوال الثلاث.
//   createCharge(charge)   -> { gateway_txn_id, redirect_url?, amount, status }
//   verifyCallback(payload)-> { ok, gateway_txn_id }
//   refund(txnId, amount)  -> { status, gateway_txn_id }
const GATEWAY_INTERFACE = ['createCharge', 'verifyCallback', 'refund'];

const registry = new Map(); // code -> { defineAt, implement }

function listGateways() {
  const rows = all(
    'SELECT code, name_ar, name_en, type, is_active, sandbox, sort_order FROM payment_gateways ORDER BY sort_order ASC, id ASC'
  );
  return rows;
}

function getGateway(code) {
  const g = get('SELECT * FROM payment_gateways WHERE code = ?', [String(code)]);
  return g || null;
}

// إرجاع تعريف البوابة (سجلّ جدول payment_gateways) إن وُجد وإلا خطأ.
function requireGateway(code) {
  const g = getGateway(code);
  if (!g) throw new ApiError(404, 'بوابة الدفع غير موجودة');
  return g;
}

// المفتاح الأمني: كل طلب دفع يمر هنا أولاً. إن لم تكن البوابة مفعّلة -> 501.
// بذلك يكون أي استدعاء charge/webhook/refund على بوابة معطّلة فاشلاً فوراً
// دون أي حركة مالية أو أثر على المحافظ.
function resolveGateway(code) {
  const g = requireGateway(code);
  if (!g.is_active) throw new ApiError(501, 'بوابة الدفع غير مفعّلة بعد');
  const impl = registry.get(String(code));
  if (!impl) throw new ApiError(501, `${g.name_ar} غير مدعومة في النظام ضمنياً`);
  return { def: g, impl };
}

// تسجيل بوابة فعلية (تُستدعى لاحقاً من ملف بوابة يطبّق العقد). لا شيء مسجَّل اليوم.
function register(code, implement) {
  if (!implement || typeof implement !== 'object') throw new ApiError(500, 'تنفيذ البوابة غير صالح');
  const missing = GATEWAY_INTERFACE.filter((m) => typeof implement[m] !== 'function');
  if (missing.length) throw new ApiError(500, `بوابة ${code} ناقصة الدوال: ${missing.join(', ')}`);
  registry.set(String(code), implement);
  return true;
}

function generateReference() {
  const y = new Date().getFullYear();
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `PG-${y}-${rand}`;
}

// تسجيل معاملة دفع موحّدة (سجلّ تدقيقي) — بلا تأثير على أرصدة المحافظ.
function logTransaction({ gateway_code, provider_id, amount, status, gateway_txn_id = null, meta = null }) {
  const reference = generateReference();
  run(
    'INSERT INTO payment_transactions (reference, gateway_code, gateway_txn_id, provider_id, amount, currency, status, meta) VALUES (?,?,?,?,?,?,?,?)',
    [reference, String(gateway_code), gateway_txn_id, provider_id != null ? toId(provider_id) : null, round2(amount), 'IQD', status, meta ? JSON.stringify(meta) : null]
  );
  return reference;
}

// نظير موحّد لبدء عملية دفع عبر بوابة نشطة. يقوم فقط بالفتح والتقصي ويسجّل سجلّاً؛
// لا يحوّل أي رصيد ولا يلمس المحافظ. تستدعي البوابة الفعلية logTransaction داخل createCharge.
function charge({ gateway_code, provider_id, amount, payload }) {
  const { def } = resolveGateway(gateway_code);
  if (def.sandbox && (process.env.PAYMENT_GATEWAY_ACTIVE !== 'test')) {
    throw new ApiError(501, `بوابة ${def.name_ar} في وضع تجريبي وغير مفعّلة للاستخدام الفعلي`);
  }
  return { allowed: true, gateway_code: def.code };
}

// فحص جاهزية بوابة (تتبع للأدمن): يعيد فقط حالة الوجود ونشاطها بلا مفاتيح.
function summary(code) {
  const g = requireGateway(code);
  return { code: g.code, name_ar: g.name_ar, type: g.type, is_active: g.is_active };
}

function setActive(code, active) {
  // تُستخدم لاحقاً عندما تُفعَّل بوابة فعلية (بعد أوراق التأسيس). تبقى الحالة معطّلة الآن.
  const g = requireGateway(code);
  run('UPDATE payment_gateways SET is_active = ?, updated_at = datetime(\'now\') WHERE code = ?', [active ? 1 : 0, code]);
  return getGateway(code);
}

module.exports = {
  GATEWAY_INTERFACE, listGateways, getGateway, requireGateway, resolveGateway,
  register, logTransaction, charge, summary, setActive,
};