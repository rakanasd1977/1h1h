const { get, run } = require('../db');
const { ApiError, round2 } = require('../utils/helpers');

// توليد فاتورة لطلب، مرة واحدة (رقم ثابت لكل طلب). تستند الضريبة إلى الإعداد tax_rate
// (افتراضي 0)، والعملة إلى الإعداد invoice_currency (افتراضي IQD).
function buildInvoiceNumber(orderId) {
  return `INV-${String(orderId).padStart(6, '0')}`;
}

function generateInvoice(actor, orderId) {
  const order = get(
    `SELECT o.*, p.name_ar AS provider_name, p.user_id AS provider_user_id,
            cu.name_ar AS customer_name, g.name_ar AS governorate_name_ar
     FROM orders o
     JOIN providers p ON p.id = o.provider_id
     LEFT JOIN users cu ON cu.id = o.customer_id
     LEFT JOIN governorates g ON g.id = o.governorate_id
     WHERE o.id = ?`,
    [Number(orderId)]
  );
  if (!order) throw new ApiError(404, 'الطلب غير موجود');

  // نطاق الصلاحية: الزبون يتصفح فواتير طلباته، والمزوّد فواتير خدماته، والإدمن الكل.
  if (actor.role === 'customer' && order.customer_id !== actor.id) throw new ApiError(403, 'هذا الطلب ليس لك');
  if (actor.role === 'provider' && order.provider_id !== actor.provider_id) throw new ApiError(403, 'هذا الطلب ليس لك');
  if (actor.role === 'agent' && order.governorate_id !== actor.governorate_id) throw new ApiError(403, 'الطلب خارج نطاق محافظتك');

  const existing = get('SELECT * FROM invoices WHERE order_id = ?', [order.id]);
  if (existing) return existing;

  let subtotal = order.subtotal_amount != null ? Number(order.subtotal_amount) : Number(order.total_amount);
  const discount = Number(order.discount_amount) || 0;
  if (subtotal <= 0) subtotal = Number(order.total_amount) + discount;

  const currency = (get('SELECT value FROM settings WHERE key = ?', ['invoice_currency']) || {}).value || 'IQD';
  const taxRate = (get('SELECT value FROM settings WHERE key = ?', ['tax_rate']) || {}).value || 0;
  const taxRateNum = Math.max(0, Number(taxRate) || 0);
  const taxAmount = round2(subtotal * taxRateNum / 100);
  const total = round2(subtotal - discount + taxAmount);

  const number = buildInvoiceNumber(order.id);
  const r = run(
    'INSERT INTO invoices (order_id, number, subtotal, discount_amount, tax_rate, tax_amount, total, currency) VALUES (?,?,?,?,?,?,?,?)',
    [order.id, number, round2(subtotal), round2(discount), taxRateNum, taxAmount, total, currency]
  );
  return get('SELECT * FROM invoices WHERE id = ?', [r.lastId]);
}

// عرض الفاتورة مع تفاصيل الطلب وسطوره (للعرض أو لتحويل HTML)
function renderInvoice(actor, orderId) {
  const inv = generateInvoice(actor, orderId);
  const order = get(
    `SELECT o.*, p.name_ar AS provider_name, p.logo AS provider_logo, cu.name_ar AS customer_name
     FROM orders o
     JOIN providers p ON p.id = o.provider_id
     LEFT JOIN users cu ON cu.id = o.customer_id
     WHERE o.id = ?`,
    [orderId]
  );
  let items = [];
  try { items = JSON.parse(order.items_json || '[]'); } catch (e) { items = []; }
  return { invoice: inv, order: { id: order.id, order_number: order.order_number, status: order.status, created_at: order.created_at }, provider: { name: order.provider_name }, customer: order.customer_name, items };
}

module.exports = { generateInvoice, renderInvoice, buildInvoiceNumber };