const express = require('express');
const router = express.Router();
const { ok } = require('../utils/response');
const { authenticate } = require('../middleware/auth');
const { requirePermissionForAdmin } = require('../middleware/rbac');
const { assertAmount } = require('../utils/helpers');
const gateways = require('../services/gateways');

// ============================================================================
// مسارات أساس بوابات الدفع (مرجعية ومعطّلة).
//
// نظراً لأن كل بوابة مُسجَّلة بِـ is_active=0 فإن أي من هذه المسارات يعيد فوراً
// 501 ("بوابة غير مفعّلة") ولا يشغّل أي حركة مالية على الإطلاق. النطاق معزول
// تماماً عن مسارات إعادة الشحن/المحافظ (POST /recharges, /wallets/:id/recharge).
// ============================================================================

router.use(authenticate);

const listGatewaysHandler = (req, res, next) => {
  try {
    ok(res, gateways.listGateways());
  } catch (e: any) { next(e); }
};

const chargeHandler = (req, res, next) => {
  try {
    const gateway_code = String((req.body && req.body.gateway_code) || '');
    const amount = assertAmount(Number((req.body && req.body.amount)), 'المبلغ');
    // الاستدعاء يمر عبر resolveGateway: أي بوابة بوضعها الحالي (is_active=0) ترفض بـ 501.
    const probe = gateways.charge({ gateway_code, provider_id: req.user && req.user.provider_id, amount, payload: req.body });
    ok(res, { ...probe, message: 'بوابة الدفع جاهزة للاستخدام بعد التفعيل الرسمي' });
  } catch (e: any) { next(e); }
};

// نقطة وصل موحّدة للبوابات — تُربط بالتوقيع الفعلي عند تفعيل بوابة. حالياً ترفض.
const webhookHandler = (req, res, next) => {
  try {
    const gateway_code = String(req.params.gateway || '');
    gateways.resolveGateway(gateway_code); // يرمي 501 ما لم تكن البوابة مفعّلة
    ok(res, { received: true });
  } catch (e: any) { next(e); }
};

const refundHandler = (req, res, next) => {
  try {
    const gateway_code = String((req.body && req.body.gateway_code) || '');
    const amount = assertAmount(Number((req.body && req.body.amount)), 'المبلغ');
    gateways.resolveGateway(gateway_code); // يرمي 501 ما لم تكن البوابة مفعّلة
    ok(res, { pending: true });
  } catch (e: any) { next(e); }
};

const summaryHandler = (req, res, next) => {
  try {
    ok(res, gateways.summary(String(req.params.code || '')));
  } catch (e: any) { next(e); }
};

// قائمة البوابات (يُطلِقها الأدمن): تُظهر الحالة والوضع فقط، دون مفاتيح/إعدادات حساسة.
router.get('/', requirePermissionForAdmin('payment_gateways', 'view'), listGatewaysHandler);
router.post('/charge', chargeHandler);
router.post('/webhook/:gateway', webhookHandler);
router.post('/refund', refundHandler);
router.get('/:code', requirePermissionForAdmin('payment_gateways', 'view'), summaryHandler);

module.exports = router;