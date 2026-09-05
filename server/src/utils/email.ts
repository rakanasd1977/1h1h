const { get } = require('../db');

// تخزين مؤقت لإعدادات SMTP لمدة 30 ثانية لتقليل استعلامات قاعدة البيانات.
let cache = { at: 0, cfg: null };

function readSmtp() {
  const now = Date.now();
  if (cache.cfg && now - cache.at < 30000) return cache.cfg;
  const s = (k) => { const r = get('SELECT value FROM settings WHERE key = ?', [k]); return r ? String(r.value) : ''; };
  const enabled = s('smtp_enabled') === '1' || s('smtp_enabled') === 'true';
  const cfg = {
    enabled,
    host: s('smtp_host'),
    port: Number(s('smtp_port') || 587),
    secure: s('smtp_secure') === '1' || s('smtp_secure') === 'true',
    user: s('smtp_user'),
    pass: s('smtp_pass'),
    from: s('smtp_from') || s('smtp_user'),
  };
  cache = { at: now, cfg };
  return cfg;
}

// يُرسل بريداً عبر SMTP. يرجع {ok:false} عند عدم التهيئة أو غياب الحزمة دون رمي خطأ.
async function sendEmail({ to, subject, text, html }) {
  const cfg = readSmtp();
  if (!cfg.enabled || !cfg.host || !cfg.user) return { ok: false, reason: 'not_configured' };
  let nodemailer;
  try { nodemailer = require('nodemailer'); } catch (e) { return { ok: false, reason: 'nodemailer_missing' }; }
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.pass ? { user: cfg.user, pass: cfg.pass } : undefined,
  });
  await transporter.sendMail({ from: cfg.from, to, subject, text, html });
  return { ok: true };
}

module.exports = { sendEmail, _resetCache: () => { cache = { at: 0, cfg: null }; } };
