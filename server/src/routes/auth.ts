const express = require('express');
const crypto = require('crypto');
const { get, run, transaction } = require('../db');
const { ApiError, assertLength } = require('../utils/helpers');
const { issueToken, issue2FAChallenge, revokeSession, revokeAllSessions, revokeAllExceptSession, jwtTtlMs } = require('../utils/session');
const { hashPassword, verifyPassword, DUMMY_HASH } = require('../utils/password');
const { generateSecret, verifyCode, otpauthURI } = require('../utils/totp');
const { encryptTotp, decryptTotp } = require('../utils/crypto');
const { recordFailure, clearFailures, lockRemaining } = require('../utils/lockout');
const { ok, created } = require('../utils/response');
const { authenticate } = require('../middleware/auth');
const { requireAgentLease, requireRole } = require('../middleware/rbac');
const { rateLimit } = require('../utils/rateLimit');
const { logActivity } = require('../utils/log');
const { setCsrf, clearCookies, csrfProtect } = require('../utils/csrf');
const config = require('../config');
const { PRIVILEGED_ROLES } = require('../utils/roles');

const { enrichUser, attachAdminRoles } = require('../services/auth');

const router = express.Router();
const VERIFY_TTL_MS = 24 * 3600000;
const RESET_TTL_MS = 30 * 60000;

// أدوار تُلزم بالمصادقة الثنائية إن فُعِّلت (حسابات الامتياز: مسؤول/وكيل/مزود)

// تفعيل الجلسة على المستعرض: كوكي HttpOnly للتوكن + كوكي CSRF + إعادة التوكن في الجسم
// لبقاء دعم تطبيقات الجوال (Bearer) حتى اكتمال الترحيل للكوكي.
function establishSession(res, user, token) {
  res.setHeader('Set-Cookie', `${config.cookie.name}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(jwtTtlMs() / 1000)}${config.cookie.secure ? '; Secure' : ''}`);
  const csrfToken = setCsrf(res, user, jwtTtlMs());
  return csrfToken;
}

// POST /api/auth/login
router.post('/login', rateLimit, async (req, res, next) => {
  try {
    const { email, password, role } = req.body || {};
    if (!email || !password) throw new ApiError(400, 'يرجى إدخال البريد وكلمة المرور');
    if (String(password).length > 72) throw new ApiError(400, 'كلمة المرور طويلة جداً');

    const identifier = String(email).trim().toLowerCase();
    const ip = require('../utils/rateLimit').clientIp(req);

    // قفل الحساب: محاولات فاشلة متكررة تمنع الدخول مؤقتاً
    const remaining = lockRemaining(identifier, ip);
    if (remaining !== null) {
      throw new ApiError(429, `محاولات فاشلة كثيرة، يرجى المحاولة بعد ${Math.ceil(remaining / 60)} دقيقة`);
    }

    const user = get('SELECT * FROM users WHERE email = ?', [identifier]);
    // مقارنة bcrypt تُنفَّذ دائماً (بتجزئة وهمية عند غياب الحساب) حتى لا يكشف زمن الاستجابة وجود البريد
    const passwordOk = await verifyPassword(password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !passwordOk) {
      recordFailure(identifier, ip);
      throw new ApiError(401, 'البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }
    if (role && user.role !== role) {
      recordFailure(identifier, ip);
      throw new ApiError(401, 'البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }
    if (!user.is_active) {
      throw new ApiError(403, 'هذا الحساب موقوف، يرجى التواصل مع الإدارة');
    }
    if (user.role === 'customer' && !user.is_verified) {
      throw new ApiError(403, 'حسابك لم يُفعَّل بعد، يرجى تفعيل البريد عبر رابط التأكيد');
    }

    clearFailures(identifier, ip);

    // المصادقة الثنائية: عند التفعيل يُعطى توكن مؤقت (5 دقائق) بدل الجلسة الكاملة
    if (user.totp_enabled) {
      const twofaToken = issue2FAChallenge(user, req);
      logActivity(user, 'login_2fa_pending', 'user', user.id, { role: user.role });
      return ok(res, { requires_2fa: true, twofa_token: twofaToken, user: { id: user.id, role: user.role, totp_enabled: true } });
    }

    const token = issueToken(user, req);
    const csrfToken = establishSession(res, user, token);
    logActivity(user, 'login', 'user', user.id, { role: user.role });
    const out = enrichUser(user);
    if (user.role === 'admin') attachAdminRoles(out, user.id);
    return ok(res, { token, csrf_token: csrfToken, user: out });
  } catch (e: any) {
    next(e);
  }
});

// POST /api/auth/2fa/verify — إكمال الدخول بعد إدخال رمز المصادقة الثنائية
router.post('/2fa/verify', rateLimit, async (req, res, next) => {
  try {
    const { twofa_token, code } = req.body || {};
    if (!twofa_token || !code) throw new ApiError(400, 'رمز التحقق مطلوب');

    let payload;
    try {
      payload = require('../utils/jwt').verifyToken(String(twofa_token));
    } catch (e: any) {
      throw new ApiError(400, 'انتهت صلاحية خطوة التحقق، يرجى إعادة تسجيل الدخول');
    }
    if (!payload.twofa_pending || !PRIVILEGED_ROLES.includes(payload.role)) {
      throw new ApiError(400, 'رمز تحقق غير صالح');
    }

    const user = get('SELECT * FROM users WHERE id = ?', [payload.id]);
    if (!user || !user.totp_enabled || !user.totp_secret) throw new ApiError(400, 'المصادقة الثنائية غير مفعّلة لهذا الحساب');
    if (!user.is_active) throw new ApiError(403, 'هذا الحساب موقوف');

    if (!verifyCode(decryptTotp(user.totp_secret), code)) {
      throw new ApiError(401, 'رمز التحقق غير صحيح');
    }

    const token = issueToken(user, req);
    const csrfToken = establishSession(res, user, token);
    logActivity(user, 'login', 'user', user.id, { role: user.role, twofa: true });
    const out = enrichUser(user);
    if (user.role === 'admin') attachAdminRoles(out, user.id);
    return ok(res, { token, csrf_token: csrfToken, user: out });
  } catch (e: any) {
    next(e);
  }
});

// POST /api/auth/2fa/setup — تحضير المصادقة الثنائية (توليد سر + رابط otpauth)
router.post('/2fa/setup', authenticate, (req, res, next) => {
  try {
    if (!PRIVILEGED_ROLES.includes(req.user.role)) {
      throw new ApiError(403, 'المصادقة الثنائية متاحة لحسابات الامتياز فقط');
    }
    const user = get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const secret = generateSecret();
    const uri = otpauthURI(secret, user.email || user.name_ar);
    // يُحفظ السر فوراً (حالة pending) ولا يُفعَّل until يثبت المستخدم امتلاكه للرمز — مشفّر عند الراحة
    run('UPDATE users SET totp_secret = ?, updated_at = datetime(\'now\') WHERE id = ?', [encryptTotp(secret), user.id]);
    return ok(res, {
      secret,
      otpauth_uri: uri,
      qr_url: `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(uri)}`,
      message: 'امسح الرمز QR بتطبيق المصادقة ثم فعّل الحساب بالرمز التالي',
    });
  } catch (e: any) {
    next(e);
  }
});

// POST /api/auth/2fa/enable — تفعيل المصادقة الثنائية بعد التحقق من رمز حي
router.post('/2fa/enable', authenticate, (req, res, next) => {
  try {
    const { code } = req.body || {};
    if (!code) throw new ApiError(400, 'رمز التحقق مطلوب');
    const user = get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!user.totp_secret) throw new ApiError(400, 'ابدأ خطوة الإعداد أولاً (setup)');
    if (!verifyCode(decryptTotp(user.totp_secret), code)) throw new ApiError(401, 'رمز التحقق غير صحيح');

    run('UPDATE users SET totp_enabled = 1, updated_at = datetime(\'now\') WHERE id = ?', [user.id]);
    logActivity(req.user, 'enable_2fa', 'user', user.id);
    return ok(res, { message: 'تم تفعيل المصادقة الثنائية' });
  } catch (e: any) {
    next(e);
  }
});

// POST /api/auth/2fa/disable — إيقاف المصادقة الثنائية (يتطلب رمزاً صحيحاً)
router.post('/2fa/disable', authenticate, (req, res, next) => {
  try {
    const { code } = req.body || {};
    const user = get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!user.totp_enabled) throw new ApiError(400, 'المصادقة الثنائية غير مفعّلة');
    if (!verifyCode(decryptTotp(user.totp_secret), code || '')) throw new ApiError(401, 'رمز التحقق غير صحيح');

    run('UPDATE users SET totp_enabled = 0, totp_secret = NULL, updated_at = datetime(\'now\') WHERE id = ?', [user.id]);
    logActivity(req.user, 'disable_2fa', 'user', user.id);
    return ok(res, { message: 'تم إيقاف المصادقة الثنائية' });
  } catch (e: any) {
    next(e);
  }
});

// POST /api/auth/2fa/reset — المسؤول فقط: إلغاء تفعيل 2FA لحساب آخر (استرداد وصول)
router.post('/2fa/reset', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') throw new ApiError(403, 'متاح للمسؤول فقط');
    const user_id = Number(req.body && req.body.user_id);
    if (!Number.isInteger(user_id) || user_id <= 0) throw new ApiError(400, 'معرف الحساب غير صحيح');

    const target = get('SELECT id, role FROM users WHERE id = ?', [user_id]);
    if (!target) throw new ApiError(404, 'الحساب غير موجود');
    if (target.role === 'admin' && target.id !== req.user.id) {
      throw new ApiError(403, 'لا يمكن إلغاء المصادقة الثنائية لحساب مسؤول آخر');
    }

    run('UPDATE users SET totp_enabled = 0, totp_secret = NULL, updated_at = datetime(\'now\') WHERE id = ?', [user_id]);
    revokeAllSessions(user_id);
    logActivity(req.user, 'reset_2fa', 'user', user_id);
    return ok(res, { message: 'تم إلغاء المصادقة الثنائية وإبطال جلسات الحساب' });
  } catch (e: any) {
    next(e);
  }
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res, next) => {
  try {
    const user = get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!user) throw new ApiError(404, 'الحساب غير موجود');
    const out = enrichUser(user);
    if (user.role === 'admin') attachAdminRoles(out, user.id);
    return ok(res, out);
  } catch (e: any) {
    next(e);
  }
});

// POST /api/auth/change-password
router.post('/change-password', authenticate, csrfProtect, async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body || {};
    if (!current_password || !new_password) throw new ApiError(400, 'يرجى إدخال كلمة المرور الحالية والجديدة');
    assertLength(new_password, 72, 'كلمة المرور الجديدة', 6);

    const user = get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!(await verifyPassword(current_password, user.password_hash))) {
      throw new ApiError(400, 'كلمة المرور الحالية غير صحيحة');
    }
    run('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?', [await hashPassword(new_password), user.id]);
    // إبطال كل الجلسات الأخرى فوراً (يبقى هذا الجهاز مسجلاً) — أمان بعد تغيير كلمة المرور
    revokeAllExceptSession(user.id, req.tokenPayload && req.tokenPayload.jti);
    logActivity(req.user, 'change_password', 'user', user.id);
    return ok(res, { message: 'تم تغيير كلمة المرور بنجاح' });
  } catch (e: any) {
    next(e);
  }
});

// POST /api/auth/change-email — تغيير بريد الزبون (يتطلب كلمة المرور، ويستلزم تفعيل البريد الجديد)
router.post('/change-email', authenticate, csrfProtect, async (req, res, next) => {
  try {
    const { email, current_password } = req.body || {};
    if (!email || !current_password) throw new ApiError(400, 'يرجى إدخال البريد الجديد وكلمة المرور الحالية');
    const cleanEmail = assertLength(String(email).trim().toLowerCase(), 120, 'البريد الإلكتروني');

    const user = get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!(await verifyPassword(current_password, user.password_hash))) {
      throw new ApiError(400, 'كلمة المرور الحالية غير صحيحة');
    }
    if (cleanEmail === user.email) throw new ApiError(400, 'البريد الجديد هو نفسه البريد الحالي');
    const dup = get('SELECT id FROM users WHERE email = ? AND id != ?', [cleanEmail, user.id]);
    if (dup) throw new ApiError(409, 'البريد مستخدم مسبقاً');

    // تحديث البريد + إسقاط رمز التفعيل القديم وتوليد رمز جديد لتأكيد البريد الجديد
    let verifyToken;
    transaction(() => {
      run("UPDATE users SET email = ?, is_verified = 0, updated_at = datetime('now') WHERE id = ?", [cleanEmail, user.id]);
      run('DELETE FROM user_verifications WHERE user_id = ?', [user.id]);
      verifyToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + VERIFY_TTL_MS).toISOString().replace('T', ' ').slice(0, 19);
      run('INSERT INTO user_verifications (user_id, token, expires_at, purpose) VALUES (?,?,?,?)', [user.id, verifyToken, expiresAt, 'verify']);
    });

    // توصيل رمز التأكيد عبر البريد/SMS (أفضل جهد — لا يوقف تغيير البريد عند الفشل)
    const appBaseRow = get('SELECT value FROM settings WHERE key = ?', ['app_base_url']);
    const appBase = appBaseRow ? String(appBaseRow.value).trim() : '';
    const verifyLink = appBase ? `${appBase.replace(/\/+$/, '')}/verify?token=${verifyToken}` : '';
    try {
      const { sendEmail } = require('../utils/email');
      sendEmail({
        to: cleanEmail,
        subject: 'تأكيد البريد الجديد في سوق الرافدين',
        text: `رمز التأكيد: ${verifyToken}\n${verifyLink ? 'رابط التأكيد: ' + verifyLink : ''}`,
        html: `<p>رمز التأكيد: <b>${verifyToken}</b></p>${verifyLink ? `<p><a href="${verifyLink}">اضغط هنا لتأكيد بريدك الجديد</a></p>` : ''}`,
      }).catch((e: any) => console.error('[change-email] فشل إرسال البريد:', e && e.message));
    } catch (e: any) { console.error('[change-email] تعذّر إرسال البريد:', e && e.message); }
    try {
      const { sendSms } = require('../utils/sms');
      sendSms({ to: user.phone, message: `سوق الرافدين: رمز تأكيد البريد الجديد ${verifyToken}${verifyLink ? '\n' + verifyLink : ''}` }).catch((e: any) => console.error('[change-email] فشل إرسال الرسالة:', e && e.message));
    } catch (e: any) { console.error('[change-email] تعذّر إرسال الرسالة:', e && e.message); }

    logActivity(user, 'change_email', 'user', user.id, { email: cleanEmail });
    // يُلمّح العميل بأن البريد الجديد غير مفعّل بعد — شاشة التفعيل تعرض الرمز أعلاه فوراً
    return ok(res, { verification_token: verifyToken, message: 'تم تغيير البريد — يرجى تأكيد البريد الجديد بالرمز الظاهر في شاشة التفعيل' });
  } catch (e: any) {
    next(e);
  }
});

// POST /api/auth/register-customer (تطبيق الزبون)
router.post('/register-customer', rateLimit, async (req, res, next) => {
  try {
    const { name_ar, email, phone, password, governorate_id, address, referral_code } = req.body || {};
    if (!name_ar || !email || !phone || !password) throw new ApiError(400, 'يرجى ملء الحقول المطلوبة');
    assertLength(name_ar, 100, 'الاسم');
    assertLength(phone, 20, 'رقم الهاتف');
    const cleanEmail = assertLength(String(email).trim().toLowerCase(), 120, 'البريد الإلكتروني');
    assertLength(password, 72, 'كلمة المرور', 6);

    const exists = get('SELECT id FROM users WHERE email = ? OR phone = ?', [cleanEmail, phone]);
    if (exists) throw new ApiError(409, 'البريد أو رقم الهاتف مستخدم مسبقاً');

    const govId = governorate_id ? Number(governorate_id) : null;
    if (govId && !get('SELECT id FROM governorates WHERE id = ?', [govId])) throw new ApiError(400, 'المحافظة غير موجودة');

    // كود إحالة صديق: ربط المدعو بالداعي عند التسجيل (اختياري).
    let referredBy = null;
    const refCode = String(referral_code || '').trim().toUpperCase();
    if (refCode) {
      const referrer = get('SELECT id FROM users WHERE role = ? AND referral_code = ?', ['customer', refCode]);
      if (!referrer) throw new ApiError(400, 'كود الإحالة غير صالح');
      referredBy = referrer.id;
    }

    const passwordHash = await hashPassword(password);
    let userId, verifyToken;
    transaction(() => {
      userId = run(
        'INSERT INTO users (role, name_ar, email, phone, password_hash, governorate_id, is_active, is_verified, referred_by) VALUES (?,?,?,?,?,?,1,0,?)',
        ['customer', name_ar, cleanEmail, phone, passwordHash, govId, referredBy]
      ).lastId;
      // كود إحالة فريد يُولَّد بعد معرفة id (RAF + ترميز المعرف).
      run('UPDATE users SET referral_code = ? WHERE id = ?', ['RAF' + (100000 + userId).toString(36).toUpperCase(), userId]);
      run('INSERT INTO customers (user_id, governorate_id, address) VALUES (?,?,?)', [userId, govId, address || null]);

      // رمز تفعيل يُرسل عبر البريد (في تطبيق الإنتاج)؛ هنا يُسجَّل في السجل لتسهيل التطوير/الاختبار
      verifyToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + VERIFY_TTL_MS).toISOString().replace('T', ' ').slice(0, 19);
      run('INSERT INTO user_verifications (user_id, token, expires_at, purpose) VALUES (?,?,?,?)', [userId, verifyToken, expiresAt, 'verify']);
    });

    const user = get('SELECT * FROM users WHERE id = ?', [userId]);
    logActivity(null, 'register_customer', 'user', userId, { verified: false });

    // توصيل رمز التفعيل عبر البريد/SMS إن كانت معدةّ (أفضل جهد، لا يوقف التسجيل عند الفشل).
    const appBaseRow = get('SELECT value FROM settings WHERE key = ?', ['app_base_url']);
    const appBase = appBaseRow ? String(appBaseRow.value).trim() : '';
    const verifyLink = appBase ? `${appBase.replace(/\/+$/, '')}/verify?token=${verifyToken}` : '';
    try {
      const { sendEmail } = require('../utils/email');
      sendEmail({
        to: cleanEmail,
        subject: 'تفعيل حسابك في سوق الرافدين',
        text: `مرحباً ${name_ar}،\nرمز التفعيل: ${verifyToken}\n${verifyLink ? 'رابط التفعيل: ' + verifyLink : ''}`,
        html: `<p>مرحباً ${name_ar}،</p><p>رمز التفعيل: <b>${verifyToken}</b></p>${verifyLink ? `<p><a href="${verifyLink}">اضغط هنا لتفعيل حسابك</a></p>` : ''}`,
      }).catch((e: any) => console.error('[register] فشل إرسال البريد:', e && e.message));
    } catch (e: any) { console.error('[register] تعذّر إرسال البريد:', e && e.message); }
    try {
      const { sendSms } = require('../utils/sms');
      const smsText = `سوق الرافدين: رمز التفعيل ${verifyToken}${verifyLink ? '\n' + verifyLink : ''}`;
      sendSms({ to: phone, message: smsText }).catch((e: any) => console.error('[register] فشل إرسال الرسالة:', e && e.message));
    } catch (e: any) { console.error('[register] تعذّر إرسال الرسالة:', e && e.message); }

    // رمز التفعيل يُعاد للعميل دائماً ليظهر في شاشة التفعيل داخل التطبيق
    // (لا يوجد مزوّد بريد/رسائل مهيّأ، فهذا هو مسار التسليم المعتمد في الواجهة).
    const payload: any = {
      user: enrichUser(user),
      message: 'تم إنشاء الحساب، يرجى تفعيل البريد عبر رمز التأكيد الظاهر أدناه',
      verification_token: verifyToken,
    };
    return created(res, payload);
  } catch (e: any) {
    next(e);
  }
});

// POST /api/auth/verify-email — تفعيل حساب الزبون برمز التأكيد
router.post('/verify-email', rateLimit, (req, res, next) => {
  try {
    const { token } = req.body || {};
    if (!token) throw new ApiError(400, 'رمز التأكيد مطلوب');

    const row = get('SELECT * FROM user_verifications WHERE token = ? AND purpose = ?', [String(token), 'verify']);
    if (!row) throw new ApiError(400, 'رمز التأكيد غير صالح أو مستخدم مسبقاً');
    if (new Date(row.expires_at) < new Date()) throw new ApiError(400, 'انتهت صلاحية رمز التأكيد');

    run('UPDATE users SET is_verified = 1, updated_at = datetime(\'now\') WHERE id = ?', [row.user_id]);
    run('DELETE FROM user_verifications WHERE user_id = ?', [row.user_id]);

    const user = get('SELECT * FROM users WHERE id = ?', [row.user_id]);
    if (!user || !user.is_active) throw new ApiError(403, 'هذا الحساب موقوف');
    const jwt = issueToken(user, req);
    establishSession(res, user, jwt);
    logActivity(user, 'verify_email', 'user', user.id);
    return ok(res, { token: jwt, user: enrichUser(user), message: 'تم تفعيل الحساب بنجاح' });
  } catch (e: any) {
    next(e);
  }
});

// POST /api/auth/resend-verification — إعادة إرسال رمز التفعيل عبر البريد/SMS
router.post('/resend-verification', rateLimit, (req, res, next) => {
  try {
    const { email, phone, token } = req.body || {};
    let user = null;
    if (token) {
      const vrow = get('SELECT * FROM user_verifications WHERE token = ? AND purpose = ?', [String(token), 'verify']);
      if (vrow) user = get('SELECT * FROM users WHERE id = ? AND is_verified = 0 AND is_active = 1', [vrow.user_id]);
    }
    if (!user && email) {
      user = get('SELECT * FROM users WHERE email = ? AND is_verified = 0 AND is_active = 1', [String(email).trim().toLowerCase()]);
    }
    if (!user && phone) {
      user = get('SELECT * FROM users WHERE phone = ? AND is_verified = 0 AND is_active = 1', [String(phone).trim()]);
    }
    if (!user) throw new ApiError(404, 'لا يوجد حساب غير مُفعّل بهذه المعطيات');

    // إعادة استخدام رمز قائم غير منتهٍ، وإلا توليد رمز جديد.
    const existing = get('SELECT * FROM user_verifications WHERE user_id = ? AND purpose = ?', [user.id, 'verify']);
    let verifyToken;
    if (existing && new Date(existing.expires_at) >= new Date()) {
      verifyToken = existing.token;
    } else {
      verifyToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + VERIFY_TTL_MS).toISOString().replace('T', ' ').slice(0, 19);
      if (existing) run('UPDATE user_verifications SET token = ?, expires_at = ? WHERE user_id = ? AND purpose = ?', [verifyToken, expiresAt, user.id, 'verify']);
      else run('INSERT INTO user_verifications (user_id, token, expires_at, purpose) VALUES (?,?,?,?)', [user.id, verifyToken, expiresAt, 'verify']);
    }

    // توصيل الرمز عبر البريد/SMS إن كانت معدةّ (أفضل جهد)، مع إعادته للتطبيق كاحتياطي.
    const appBaseRow = get('SELECT value FROM settings WHERE key = ?', ['app_base_url']);
    const appBase = appBaseRow ? String(appBaseRow.value).trim() : '';
    const verifyLink = appBase ? `${appBase.replace(/\/+$/, '')}/verify?token=${verifyToken}` : '';
    try {
      const { sendEmail } = require('../utils/email');
      sendEmail({
        to: user.email,
        subject: 'إعادة إرسال رمز تفعيل سوق الرافدين',
        text: `رمز التفعيل: ${verifyToken}\n${verifyLink ? 'رابط التفعيل: ' + verifyLink : ''}`,
        html: `<p>رمز التفعيل: <b>${verifyToken}</b></p>${verifyLink ? `<p><a href="${verifyLink}">اضغط هنا لتفعيل حسابك</a></p>` : ''}`,
      }).catch((e: any) => console.error('[resend] فشل إرسال البريد:', e && e.message));
    } catch (e: any) { console.error('[resend] تعذّر إرسال البريد:', e && e.message); }
    try {
      const { sendSms } = require('../utils/sms');
      sendSms({ to: user.phone, message: `سوق الرافدين: رمز التفعيل ${verifyToken}${verifyLink ? '\n' + verifyLink : ''}` }).catch((e: any) => console.error('[resend] فشل إرسال الرسالة:', e && e.message));
    } catch (e: any) { console.error('[resend] تعذّر إرسال الرسالة:', e && e.message); }

    return ok(res, { message: 'تم إعادة إرسال رمز التفعيل' });
  } catch (e: any) {
    next(e);
  }
});

// POST /api/auth/forgot-password — طلب رمز استرجاع كلمة السر لحساب زبون
router.post('/forgot-password', rateLimit, (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!email) throw new ApiError(400, 'يرجى إدخال البريد الإلكتروني');
    const cleanEmail = assertLength(String(email).trim().toLowerCase(), 120, 'البريد الإلكتروني');

    // استرجاع موجه لحسابات الزبائن فقط — لا يُساء استخدامها لطهو حسابات الامتياز.
    const user = get('SELECT * FROM users WHERE email = ? AND role = ? AND is_active = 1', [cleanEmail, 'customer']);
    // لا نكشف وجود الحساب: رسالة موحّدة بلا رمز إن لم يوجد.
    if (!user) {
      return ok(res, { message: 'إن وُجد حساب بهذا البريد، ستصلك رسالة فيها رمز الاسترجاع' });
    }

    // إعادة استخدام رمز استرجاع قائم غير منتهٍ (غرض reset فقط)، وإلا توليد رمز جديد (صلاحية 30 دقيقة).
    // لا يُعاد استخدام رمز التفعيل (verify) أبداً لاسترجاع كلمة المرور — عزل الغرضين.
    const existing = get('SELECT * FROM user_verifications WHERE user_id = ? AND purpose = ?', [user.id, 'reset']);
    let resetToken;
    if (existing && new Date(existing.expires_at) >= new Date()) {
      resetToken = existing.token;
    } else {
      resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + RESET_TTL_MS).toISOString().replace('T', ' ').slice(0, 19);
      if (existing) run('UPDATE user_verifications SET token = ?, expires_at = ? WHERE user_id = ? AND purpose = ?', [resetToken, expiresAt, user.id, 'reset']);
      else run('INSERT INTO user_verifications (user_id, token, expires_at, purpose) VALUES (?,?,?,?)', [user.id, resetToken, expiresAt, 'reset']);
    }

    // إرسال الرمز عبر البريد/SMS إن كانت معدّة (أفضل جهد، لا يوقف الطلب عند الفشل).
    const appBaseRow = get('SELECT value FROM settings WHERE key = ?', ['app_base_url']);
    const appBase = appBaseRow ? String(appBaseRow.value).trim() : '';
    const resetLink = appBase ? `${appBase.replace(/\/+$/, '')}/forgot-password?token=${resetToken}` : '';
    try {
      const { sendEmail } = require('../utils/email');
      sendEmail({
        to: user.email,
        subject: 'استرجاع كلمة المرور — سوق الرافدين',
        text: `رمز استرجاع كلمة المرور: ${resetToken}\n${resetLink ? 'رابط الاسترجاع: ' + resetLink : ''}`,
        html: `<p>رمز استرجاع كلمة المرور: <b>${resetToken}</b></p>${resetLink ? `<p><a href="${resetLink}">اضغط هنا لإنشاء كلمة مرور جديدة</a></p>` : ''}`,
      }).catch((e: any) => console.error('[forgot] فشل إرسال البريد:', e && e.message));
    } catch (e: any) { console.error('[forgot] تعذّر إرسال البريد:', e && e.message); }
    try {
      const { sendSms } = require('../utils/sms');
      sendSms({ to: user.phone, message: `سوق الرافدين: رمز استرجاع كلمة المرور ${resetToken}` }).catch((e: any) => console.error('[forgot] فشل إرسال الرسالة:', e && e.message));
    } catch (e: any) { console.error('[forgot] تعذّر إرسال الرسالة:', e && e.message); }

    logActivity(user, 'forgot_password', 'user', user.id);
    // الرمز يُعاد للتطبيق كاحتياطي (لا مزوّد بريد مهيّأ) — كما في مسار تفعيل الحساب.
    return ok(res, { verification_token: resetToken, message: 'تم إرسال رمز الاسترجاع — أدخله مع كلمة المرور الجديدة' });
  } catch (e: any) {
    next(e);
  }
});

// POST /api/auth/forgot-password/confirm — إنشاء كلمة مرور جديدة برمز الاسترجاع
router.post('/forgot-password/confirm', rateLimit, async (req, res, next) => {
  try {
    const { token, new_password } = req.body || {};
    if (!token || !new_password) throw new ApiError(400, 'يرجى إدخال رمز الاسترجاع وكلمة المرور الجديدة');
    assertLength(new_password, 72, 'كلمة المرور', 6);

    const row = get('SELECT * FROM user_verifications WHERE token = ? AND purpose = ?', [String(token), 'reset']);
    if (!row) throw new ApiError(400, 'رمز الاسترجاع غير صالح أو مستخدم مسبقاً');
    if (new Date(row.expires_at) < new Date()) throw new ApiError(400, 'انتهت صلاحية رمز الاسترجاع');

    const user = get('SELECT * FROM users WHERE id = ? AND role = ?', [row.user_id, 'customer']);
    if (!user || !user.is_active) throw new ApiError(403, 'الحساب غير موجود أو موقوف');

    const passwordHash = await hashPassword(new_password);
    transaction(() => {
      run('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?', [passwordHash, user.id]);
      // رمز لمرة واحدة: يُستهلك فوراً.
      run('DELETE FROM user_verifications WHERE user_id = ?', [user.id]);
    });
    // إنشاء كلمة مرور جديدة يُبطل جلسات الحساب الحالية على كل الأجهزة.
    revokeAllSessions(user.id);
    logActivity(user, 'reset_password_self', 'user', user.id);
    return ok(res, { message: 'تم إنشاء كلمة المرور الجديدة بنجاح — سجّل الدخول الآن' });
  } catch (e: any) {
    next(e);
  }
});

// POST /api/auth/logout — إبطال توكن الجلسة الحالية فوراً + مسح الكوكي
router.post('/logout', authenticate, (req, res, next) => {
  try {
    revokeSession(req.tokenPayload && req.tokenPayload.jti);
    clearCookies(res);
    logActivity(req.user, 'logout', 'user', req.user.id);
    return ok(res, { message: 'تم تسجيل الخروج' });
  } catch (e: any) {
    next(e);
  }
});

// POST /api/auth/logout-all — إبطال كل جلسات المستخدم (كل الأجهزة)
router.post('/logout-all', authenticate, (req, res, next) => {
  try {
    revokeAllSessions(req.user.id);
    clearCookies(res);
    logActivity(req.user, 'logout_all', 'user', req.user.id);
    return ok(res, { message: 'تم تسجيل الخروج من جميع الأجهزة' });
  } catch (e: any) {
    next(e);
  }
});

// POST /api/auth/reset-password (للمسؤول/الوكيل: إعادة تعيين كلمة مرور حساب آخر)
router.post('/reset-password', authenticate, requireRole('admin', 'agent'), requireAgentLease(), csrfProtect, async (req, res, next) => {
  try {
    const { user_id, new_password } = req.body || {};
    if (!user_id || !new_password) throw new ApiError(400, 'يرجى تحديد الحساب وكلمة المرور الجديدة');
    assertLength(new_password, 72, 'كلمة المرور', 6);

    const target = get('SELECT * FROM users WHERE id = ?', [Number(user_id)]);
    if (!target) throw new ApiError(404, 'الحساب غير موجود');
    // الزبائن لا يملكون هذا المسار أصلاً (requireRole)؛ وحساب المسؤول الأعلى لا يُعاد تعيينه إلا من قِبَل مسؤول أعلى
    if (target.role === 'admin') {
      if (req.user.role !== 'admin') throw new ApiError(403, 'لا يمكنك تغيير كلمة مرور المسؤول');
      const targetSuper = get(
        'SELECT 1 FROM admin_user_roles aur JOIN admin_roles ar ON ar.id = aur.role_id WHERE aur.user_id = ? AND ar.name = ?',
        [target.id, 'super_admin']
      );
      if (targetSuper) {
        const actorSuper = get(
          'SELECT 1 FROM admin_user_roles aur JOIN admin_roles ar ON ar.id = aur.role_id WHERE aur.user_id = ? AND ar.name = ?',
          [req.user.id, 'super_admin']
        );
        if (!actorSuper) throw new ApiError(403, 'لا يمكنك تغيير كلمة مرور المسؤول الأعلى');
      }
    }

    if (req.user.role === 'agent') {
      if (!['provider', 'customer'].includes(target.role)) {
        throw new ApiError(403, 'لا يمكنك تغيير كلمة مرور هذا النوع من الحسابات');
      }
      let targetGovId = null;
      if (target.role === 'provider') {
        const p = get('SELECT governorate_id FROM providers WHERE user_id = ?', [target.id]);
        targetGovId = p ? p.governorate_id : null;
      } else {
        targetGovId = target.governorate_id || null;
      }
      if (targetGovId !== req.user.governorate_id) {
        throw new ApiError(403, 'لا يمكنك إعادة تعيين كلمة مرور حساب خارج محافظتك');
      }
    }

    run('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?', [await hashPassword(new_password), target.id]);
    // إعادة التعيين تُبطل جلسات الحساب الحالية على كل الأجهزة (يجب تسجيل الدخول من جديد)
    revokeAllSessions(target.id);
    logActivity(req.user, 'reset_password', 'user', target.id, { role: target.role });
    return ok(res, { message: 'تم إعادة تعيين كلمة المرور بنجاح' });
  } catch (e: any) {
    next(e);
  }
});

module.exports = router;
