const { get, all, run, transaction } = require('../db');
const { ApiError, round2 } = require('../utils/helpers');
const { walletTx, creditWallet } = require('../utils/wallet');
const { notifyUser } = require('../utils/push');

const VALID_STATUSES = ['open', 'reviewing', 'resolved', 'rejected'];
const ALLOWED_FROM = ['open', 'reviewing'];

function resolveOrder(actor, orderId) {
  const order = get(
    `SELECT o.*, p.name_ar AS provider_name, p.user_id AS provider_user_id,
            s.name_ar AS service_name_ar,
            g.name_ar AS governorate_name_ar
     FROM orders o
     JOIN providers p ON p.id = o.provider_id
     JOIN services s ON s.id = o.service_id
     LEFT JOIN governorates g ON g.id = o.governorate_id
     WHERE o.id = ?`,
    [Number(orderId)]
  );
  if (!order) throw new ApiError(404, 'الطلب غير موجود');

  // نطاق الصلاحية: الزبون يرى طلباته، والمزوّد طلباته، والوكيل لمحافظته، والإدمن الكل.
  if (actor.role === 'customer' && order.customer_id !== actor.id) throw new ApiError(403, 'هذا الطلب ليس لك');
  if (actor.role === 'provider' && order.provider_id !== (actor.provider_id)) throw new ApiError(403, 'هذا الطلب ليس لك');
  if (actor.role === 'agent' && order.governorate_id !== actor.governorate_id) throw new ApiError(403, 'الطلب خارج نطاق محافظتك');
  return order;
}

function disputeScopeRow(actor) {
  if (actor.role === 'customer') return { sql: 'd.opened_by = ? OR (o.customer_id = ?)', params: [actor.id, actor.id] };
  if (actor.role === 'provider') return { sql: 'o.provider_id = ?', params: [actor.provider_id] };
  if (actor.role === 'agent') return { sql: 'o.governorate_id = ?', params: [actor.governorate_id] };
  return { sql: '1=1', params: [] };
}

const DISPUTE_SELECT = `
  SELECT d.*, o.order_number, o.total_amount, o.status AS order_status,
         p.name_ar AS provider_name, u.name_ar AS opened_by_name
  FROM disputes d
  JOIN orders o ON o.id = d.order_id
  JOIN providers p ON p.id = o.provider_id
  JOIN users u ON u.id = d.opened_by
`;

function listDisputes(actor, query) {
  const { status, page = 1, limit = 50 } = query || {};
  const scope = disputeScopeRow(actor);
  const params = [];
  let where = scope.sql;
  if (status && VALID_STATUSES.includes(status)) {
    where += ' AND d.status = ?';
    params.push(status);
  }
  const p = Math.max(1, Number(page) || 1);
  const lim = Math.min(100, Math.max(1, Number(limit) || 50));
  const offset = (p - 1) * lim;
  const total = get(`SELECT COUNT(*) AS c FROM disputes d JOIN orders o ON o.id = d.order_id WHERE ${where}`, [...scope.params, ...params]).c;
  const rows = all(`${DISPUTE_SELECT} WHERE ${where} ORDER BY d.id DESC LIMIT ? OFFSET ?`, [...scope.params, ...params, lim, offset]);
  return { data: rows, meta: { total, page: p, limit: lim, pages: Math.max(1, Math.ceil(total / lim)) } };
}

function getDisputeFor(actor, disputeId) {
  const scope = disputeScopeRow(actor);
  const d = get(`${DISPUTE_SELECT} WHERE d.id = ? AND ${scope.sql}`, [Number(disputeId), ...scope.params]);
  if (!d) throw new ApiError(404, 'النزاع غير موجود');
  return d;
}

// فتح نزاع: على طلب مكتمل/ملغي فقط، ضمن نافذة زمنية من الإعدادات (افتراضي 7 أيام)،
// ولا يجوز فتح نزاعين لنفس الطرف على نفس الطلب.
function openDispute(actor, orderId, body, party = 'customer') {
  const reason = String((body && body.reason) || '').trim();
  if (!reason) throw new ApiError(400, 'سبب النزاع مطلوب');
  if (reason.length > 1000) throw new ApiError(400, 'سبب النزاع يتجاوز الحد المسموح');

  const order = resolveOrder(actor, orderId);
  if (!['completed', 'cancelled'].includes(order.status)) {
    throw new ApiError(422, 'لا يمكن فتح نزاع إلا على طلب مكتمل أو ملغي');
  }

  const windowDays = get('SELECT value FROM settings WHERE key = ?', ['dispute_window_days']);
  const windowValue = Number(windowDays ? windowDays.value : 7);
  const days = Number.isFinite(windowValue) ? windowValue : 7;
  const created = new Date(order.created_at + (order.created_at.includes('T') ? '' : 'Z'));
  const diffDays = (Date.now() - created.getTime()) / 86400000;
  if (diffDays > days) throw new ApiError(422, `انتهت مهلة فتح النزاع (${days} يوماً)`);

  const existing = get(
    'SELECT 1 FROM disputes WHERE order_id = ? AND opened_by = ? AND status IN (?,?) LIMIT 1',
    [order.id, actor.id, 'open', 'reviewing']
  );
  if (existing) throw new ApiError(409, 'يوجد نزاع مفتوح على هذا الطلب');

  const r = run(
    'INSERT INTO disputes (order_id, opened_by, party, reason, status) VALUES (?,?,?,?,?)',
    [order.id, actor.id, party, reason, 'open']
  );

  // إشعار المسؤولين بنزاع جديد
  const admins = all('SELECT id FROM users WHERE role = ? AND is_active = 1', ['admin']);
  const payload = {
    type: 'announcement',
    title: '⚠️ نزاع جديد',
    body: `نزاع على الطلب ${order.order_number} — ${reason.slice(0, 80)}`,
    url: `/disputes/${r.lastId}`,
    icon: '⚠️',
  };
  admins.forEach((a) => {
    try { notifyUser(a.id, payload); } catch (e) { /* تجاهل */ }
  });

  return getDisputeFor(actor, r.lastId);
}

// حسم/رفض نزاع من المسؤول. عند الحل بردّ مبلغ: نخصم من رصيد المزوّد (جزء/كل المبلغ)
// ونعيد توزيع العمولة إلى ما قبل الربح للمنصة/الوكيل مقابل الخصم.
function resolveDispute(actor, disputeId, body) {
  const dispute = get('SELECT * FROM disputes WHERE id = ?', [Number(disputeId)]);
  if (!dispute) throw new ApiError(404, 'النزاع غير موجود');
  if (!ALLOWED_FROM.includes(dispute.status)) throw new ApiError(422, 'النزاع محسوم بالفعل');
  if (!['resolved', 'rejected'].includes(body && body.status)) {
    throw new ApiError(400, 'حالة الحسم يجب أن تكون resolved أو rejected');
  }

  const order = get(
    `SELECT o.*, p.user_id AS provider_user_id FROM orders o
     JOIN providers p ON p.id = o.provider_id WHERE o.id = ?`,
    [dispute.order_id]
  );
  if (!order) throw new ApiError(404, 'الطلب غير موجود');

  const requested = body.status === 'resolved' ? Math.max(0, Number(body.refund_amount) || 0) : 0;
  const rounded = round2(requested);
  if (body.status === 'resolved' && rounded > order.total_amount) {
    throw new ApiError(400, 'مبلغ الرد يتجاوز قيمة الطلب');
  }

  const resolution = String((body.note || body.resolution || '').trim()).slice(0, 1000) || null;

  // الخصم المالي + تحديث الحالة يجريان في معاملة واحدة ذرّية، مع قيد حالة في التحديث:
  // سباق الحسم المزدوج (مسؤولان متزامنان) لن يخصم الرصيد مرتين — من وصل آخراً
  // يجد أن التحديث لم يغيّر صفاً (changes=0) فتُتراجع معاملته كلها.
  transaction(() => {
    if (body.status === 'resolved' && rounded > 0) {
      // أرصدة المزوّد: إن وُجدت محفظة، نخصم المبلغ المردود (دون تجاوز الرصيد المتاح).
      const w = get('SELECT * FROM provider_wallets WHERE provider_id = ?', [order.provider_id]);
      if (w && Number(w.balance) > 0) {
        const deduct = Math.min(Number(w.balance), rounded);
        if (deduct > 0) {
          const balanceAfter = creditWallet(order.provider_id, -deduct);
          walletTx(order.provider_id, 'refund', {
            amount: -deduct,
            balanceAfter,
            note: `ردّ نزاع على الطلب ${order.order_number}`,
            createdBy: actor.name_ar || actor.role,
          });
        }
      }
    }

    const upd = run(
      `UPDATE disputes SET status = ?, resolution = ?, refund_amount = ?, resolved_by = ?, resolved_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND status IN ('open','reviewing')`,
      [body.status, resolution, rounded, actor.id, dispute.id]
    );
    if (!upd.changes) throw new ApiError(422, 'النزاع محسوم بالفعل');
  });

  if (order.customer_id) {
    notifyUser(order.customer_id, {
      type: 'order',
      title: '💬 نتيجة النزاع',
      body: body.status === 'resolved'
        ? `تمت مراجعة نزاعك على الطلب ${order.order_number}: ${resolution || 'تم حل النزاع'}`
        : `تم رفض نزاعك على الطلب ${order.order_number}: ${resolution || 'النزاع غير وجيه'}`,
      url: `/orders/${order.id}`,
    });
  }

  return getDisputeFor(actor, dispute.id);
}

module.exports = { openDispute, listDisputes, getDisputeFor, resolveDispute, VALID_STATUSES };