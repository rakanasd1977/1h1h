const express = require('express');
const { get } = require('../db');
const { ApiError, toId } = require('../utils/helpers');
const { ok, created } = require('../utils/response');
const { authenticate } = require('../middleware/auth');
const { requireAdminOrAgent, requirePermissionForAdmin, requireAgentLease } = require('../middleware/rbac');
const { serveDocRef } = require('../utils/docStorage');
const {
  ensureCanManage,
  listProviders,
  getProvider,
  getProviderOverview,
  createProvider,
  updateProvider,
  toggleProviderActive,
  verifyProvider,
  resetProviderPassword,
  deleteProvider,
} = require('../services/providers');

const router = express.Router();
router.use(authenticate, requireAdminOrAgent());

// GET /api/providers
router.get('/', requirePermissionForAdmin('providers', 'view'), async (req, res, next) => {
  try {
    const { rows, meta } = listProviders(req.user, req.query);
    return ok(res, rows, meta ?? undefined);
  } catch (e: any) { next(e); }
});

// GET /api/providers/:id
router.get('/:id', requirePermissionForAdmin('providers', 'view'), (req, res, next) => {
  try {
    return ok(res, getProvider(req.user, Number(req.params.id)));
  } catch (e: any) { next(e); }
});

// GET /api/providers/:id/overview
router.get('/:id/overview', requirePermissionForAdmin('providers', 'view'), (req, res, next) => {
  try {
    return ok(res, getProviderOverview(req.user, Number(req.params.id)));
  } catch (e: any) { next(e); }
});

// POST /api/providers
router.post('/', requireAgentLease(), requirePermissionForAdmin('providers', 'create'), async (req, res, next) => {
  try {
    return created(res, await createProvider(req.user, req.body));
  } catch (e: any) { next(e); }
});

// PUT /api/providers/:id
router.put('/:id', requirePermissionForAdmin('providers', 'edit'), (req, res, next) => {
  try {
    return ok(res, updateProvider(req.user, Number(req.params.id), req.body));
  } catch (e: any) { next(e); }
});

// POST /api/providers/:id/toggle
router.post('/:id/toggle', requirePermissionForAdmin('providers', 'edit'), (req, res, next) => {
  try {
    return ok(res, toggleProviderActive(req.user, Number(req.params.id)));
  } catch (e: any) { next(e); }
});

// GET /api/providers/:id/documents/:field — مستندات التوثيق (البطاقة الوطنية / تأييد السكن)
// تُخزَّن مركزياً في data/docs/<providerId>/ ولا تُقدَّم من مسار عام؛ تُقدَّم هنا للمسؤول/الوكيل المصرَّح فقط.
const DOC_FIELDS = { national_id: 'national_id_image', residency: 'residency_doc_image' };

router.get('/:id/documents/:field', requirePermissionForAdmin('providers', 'view'), (req, res, next) => {
  try {
    const id = toId(req.params.id);
    const col = DOC_FIELDS[req.params.field];
    if (!col) throw new ApiError(400, 'حقل مستند غير معروف');
    const provider = get(`SELECT id, governorate_id, ${col} AS doc FROM providers WHERE id = ?`, [id]);
    if (!provider) throw new ApiError(404, 'مزود الخدمة غير موجود');
    ensureCanManage(req.user, provider);
    if (!provider.doc) throw new ApiError(404, 'لا يوجد مستند مرفوع لهذا المزود');
    if (!serveDocRef(res, provider.doc)) throw new ApiError(404, 'الملف غير موجود');
  } catch (e: any) { next(e); }
});

// POST /api/providers/:id/verify — موافقة/رفض التوثيق (مع إبقاء التبديل القديم متوافقاً)
router.post('/:id/verify', requirePermissionForAdmin('providers', 'edit'), (req, res, next) => {
  try {
    return ok(res, verifyProvider(req.user, Number(req.params.id), req.body));
  } catch (e: any) { next(e); }
});

// POST /api/providers/:id/reset-password
router.post('/:id/reset-password', requirePermissionForAdmin('providers', 'edit'), async (req, res, next) => {
  try {
    return ok(res, await resetProviderPassword(req.user, Number(req.params.id)));
  } catch (e: any) { next(e); }
});

// DELETE /api/providers/:id
router.delete('/:id', requirePermissionForAdmin('providers', 'delete'), (req, res, next) => {
  try {
    return ok(res, deleteProvider(req.user, Number(req.params.id)));
  } catch (e: any) { next(e); }
});

module.exports = router;
