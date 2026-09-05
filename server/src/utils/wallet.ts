const { get, run } = require('../db');
const { round2 } = require('./helpers');

function ensureWallet(providerId) {
  let w = get('SELECT * FROM provider_wallets WHERE provider_id = ?', [providerId]);
  if (!w) {
    run('INSERT OR IGNORE INTO provider_wallets (provider_id, balance) VALUES (?,0)', [providerId]);
    w = get('SELECT * FROM provider_wallets WHERE provider_id = ?', [providerId]);
  }
  return w;
}

// إضافة رصيد للمحفظة (عملية مطلقة) وإرجاع الرصيد بعد الحركة — تُستدعى داخل المعاملة الخارجية
function creditWallet(providerId, amount) {
  const w = ensureWallet(providerId);
  const balanceAfter = round2(Number(w.balance) + amount);
  run("UPDATE provider_wallets SET balance = ?, updated_at = datetime('now') WHERE provider_id = ?", [balanceAfter, providerId]);
  return balanceAfter;
}

// خصم رصيد المحفظة (عملية مطلقة) وإرجاع الرصيد بعد الحركة — على المتصل التحقق من الكفاية أولاً
function debitWallet(providerId, amount) {
  const w = ensureWallet(providerId);
  const balanceAfter = round2(Number(w.balance) - amount);
  run("UPDATE provider_wallets SET balance = ?, updated_at = datetime('now') WHERE provider_id = ?", [balanceAfter, providerId]);
  return balanceAfter;
}

// تسجيل حركة محفظة واحدة (8 أعمدة، أو 10 عند إرفاق الطلب) — بديل موحّد للكتل المكررة
function walletTx(providerId, type, opts) {
  const { amount, agentAmount = 0, platformAmount = 0, balanceAfter, note, createdBy, orderId, orderNumber } = opts || {};
  if (orderId != null) {
    run(
      'INSERT INTO wallet_transactions (provider_id, type, amount, agent_amount, platform_amount, balance_after, order_id, order_number, note, created_by) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [providerId, type, amount, agentAmount, platformAmount, balanceAfter, orderId, orderNumber, note, createdBy]
    );
  } else {
    run(
      'INSERT INTO wallet_transactions (provider_id, type, amount, agent_amount, platform_amount, balance_after, note, created_by) VALUES (?,?,?,?,?,?,?,?)',
      [providerId, type, amount, agentAmount, platformAmount, balanceAfter, note, createdBy]
    );
  }
}

module.exports = { ensureWallet, creditWallet, debitWallet, walletTx };