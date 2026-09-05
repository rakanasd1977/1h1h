const express = require('express');
const { ok, created } = require('../utils/response');
const { authenticate } = require('../middleware/auth');
const { requireRole, requirePermission } = require('../middleware/rbac');
const rbac = require('../services/rbac');
const { ApiError, toId } = require('../utils/helpers');
const { get } = require('../db');
const { isSuperAdmin } = require('../utils/rbac');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

// إدارة المستخدمين والصلاحيات الحساسة مقصورة على المسؤول الأعلى لمنع تصعيد الصلاحيات.
const requireSuperAdmin = (req, res, next) => {
  if (!isSuperAdmin(req.user.id)) return next(new ApiError(403, 'هذه العملية متاحة للمسؤول الأعلى فقط'));
  next();
};
const isSuperAdminTarget = (userId) =>
  !!get(
    "SELECT 1 FROM admin_user_roles aur JOIN admin_roles ar ON ar.id = aur.role_id WHERE aur.user_id = ? AND ar.name = 'super_admin'",
    [toId(userId)]
  );

const listRolesHandler = (req, res, next) => {
  try { ok(res, rbac.listRoles()); } catch (e: any) { next(e); }
};
const getRoleHandler = (req, res, next) => {
  try { ok(res, rbac.getRole(req.params.id)); } catch (e: any) { next(e); }
};
const createRoleHandler = (req, res, next) => {
  try { created(res, rbac.createRole(req.body)); } catch (e: any) { next(e); }
};
const updateRoleHandler = (req, res, next) => {
  try { ok(res, rbac.updateRole(req.params.id, req.body)); } catch (e: any) { next(e); }
};
const deleteRoleHandler = (req, res, next) => {
  try { ok(res, rbac.deleteRole(req.params.id)); } catch (e: any) { next(e); }
};
const setPermsHandler = (req, res, next) => {
  try { ok(res, rbac.setRolePermissions(req.params.id, req.body)); } catch (e: any) { next(e); }
};
const listUsersHandler = (req, res, next) => {
  try { ok(res, rbac.listUsers()); } catch (e: any) { next(e); }
};
const createUserHandler = async (req, res, next) => {
  try { created(res, await rbac.createUser(req.body)); } catch (e: any) { next(e); }
};
const patchUserHandler = (req, res, next) => {
  try {
    if (isSuperAdminTarget(req.params.id) && !isSuperAdmin(req.user.id)) throw new ApiError(403, 'لا يمكن تعديل المسؤول الأعلى');
    ok(res, rbac.patchUser(req.params.id, req.body));
  } catch (e: any) { next(e); }
};
const deleteUserHandler = (req, res, next) => {
  try {
    if (isSuperAdminTarget(req.params.id) && !isSuperAdmin(req.user.id)) throw new ApiError(403, 'لا يمكن حذف المسؤول الأعلى');
    ok(res, rbac.deleteUser(req.user, req.params.id));
  } catch (e: any) { next(e); }
};
const addUserRoleHandler = (req, res, next) => {
  try { created(res, rbac.addUserRole(req.params.userId, req.body.role_id, req.user)); } catch (e: any) { next(e); }
};
const removeUserRoleHandler = (req, res, next) => {
  try { ok(res, rbac.removeUserRole(req.params.userId, req.params.roleId, req.user)); } catch (e: any) { next(e); }
};
const listResourcesHandler = (req, res, next) => {
  try { ok(res, rbac.listResources()); } catch (e: any) { next(e); }
};

router.get('/roles', requirePermission('roles', 'view'), listRolesHandler);
router.get('/roles/:id', requirePermission('roles', 'view'), getRoleHandler);
router.post('/roles', requirePermission('roles', 'create'), createRoleHandler);
router.put('/roles/:id', requirePermission('roles', 'edit'), updateRoleHandler);
router.delete('/roles/:id', requirePermission('roles', 'delete'), deleteRoleHandler);
router.put('/roles/:id/permissions', requirePermission('roles', 'edit'), requireSuperAdmin, setPermsHandler);
router.get('/users', requirePermission('users', 'view'), listUsersHandler);
router.post('/users', requirePermission('users', 'create'), requireSuperAdmin, createUserHandler);
router.patch('/users/:id', requirePermission('users', 'edit'), patchUserHandler);
router.delete('/users/:id', requirePermission('users', 'delete'), deleteUserHandler);
router.post('/users/:userId/roles', requirePermission('users', 'edit'), addUserRoleHandler);
router.delete('/users/:userId/roles/:roleId', requirePermission('users', 'edit'), removeUserRoleHandler);
router.get('/resources', requirePermission('roles', 'view'), listResourcesHandler);

module.exports = router;
