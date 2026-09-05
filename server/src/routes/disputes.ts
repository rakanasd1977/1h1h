const express = require('express');
const { ok } = require('../utils/response');
const { authenticate } = require('../middleware/auth');
const { requireRole, requirePermissionForAdmin } = require('../middleware/rbac');
const { listDisputes, getDisputeFor, resolveDispute } = require('../services/disputes');

const router = express.Router();
router.use(authenticate);

// قائمة نزاعات حسب الدور (زبون/مزوّد بعائد ملائم، مسؤول/وكيل بالكل أو محافظته)
router.get('/', (req, res, next) => {
  try {
    const { data, meta } = listDisputes(req.user, req.query);
    return ok(res, data, meta);
  } catch (e: any) { next(e); }
});

// تفاصيل نزاع (بنطاق الصلاحية)
router.get('/:id', (req, res, next) => {
  try { return ok(res, getDisputeFor(req.user, req.params.id)); } catch (e: any) { next(e); }
});

// حسم/رفض نزاع — للمسؤول فقط
router.post('/:id/resolve', requireRole('admin'), requirePermissionForAdmin('disputes', 'edit'), (req, res, next) => {
  try { return ok(res, resolveDispute(req.user, req.params.id, req.body)); } catch (e: any) { next(e); }
});

module.exports = router;