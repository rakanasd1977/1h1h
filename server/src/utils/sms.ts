const { get } = require('../db');

function readSms() {
  const s = (k) => { const r = get('SELECT value FROM settings WHERE key = ?', [k]); return r ? String(r.value) : ''; };
  const enabled = s('sms_enabled') === '1' || s('sms_enabled') === 'true';
  return {
    enabled,
    baseUrl: s('sms_base_url'),
    apiKey: s('sms_api_key'),
    apiSecret: s('sms_api_secret'),
    sender: s('sms_sender'),
  };
}

// يُرسل رسالة نصية عبر بوابة HTTP عامة. الرابط baseUrl نموذج يحوي العناصر النائبة:
// {to} {message} {api_key} {api_secret} {sender} — تُستبدل تلقائياً قبل الطلب.
// ندعم حالياً طلب GET؛ معظم بوابات الرسائل العراقية والعربية تعمل بهذه الطريقة.
async function sendSms({ to, message }) {
  const cfg = readSms();
  if (!cfg.enabled || !cfg.baseUrl) return { ok: false, reason: 'not_configured' };
  const url = cfg.baseUrl
    .replace(/{to}/g, encodeURIComponent(to))
    .replace(/{message}/g, encodeURIComponent(message))
    .replace(/{api_key}/g, encodeURIComponent(cfg.apiKey))
    .replace(/{api_secret}/g, encodeURIComponent(cfg.apiSecret))
    .replace(/{sender}/g, encodeURIComponent(cfg.sender));
  try {
    const res = await fetch(url, { method: 'GET' });
    return { ok: res.ok, status: res.status };
  } catch (e: any) {
    return { ok: false, reason: String((e && e.message) || e) };
  }
}

module.exports = { sendSms };
