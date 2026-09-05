const { db, run, all, get } = require('../index');

function seed(key, value, label) {
  const exists = get('SELECT key FROM settings WHERE key = ?', [key]);
  if (!exists) run('INSERT INTO settings (key, value, label, updated_at) VALUES (?,?,?, datetime(\'now\'))', [key, value, label]);
}

module.exports = {
  name: '047_mail_sms_settings',
  up: () => {
    seed('app_base_url', '', 'رابط التطبيق العام (يُستخدم لبناء روابط التفعيل، مثال: https://customer.rafidain.iq)');
    seed('smtp_enabled', '0', 'تفعيل إرسال البريد الإلكتروني (SMTP)');
    seed('smtp_host', '', 'خادم SMTP (مثل smtp.gmail.com)');
    seed('smtp_port', '587', 'منفذ SMTP (587 عادة، أو 465 مع TLS)');
    seed('smtp_secure', '0', 'استخدام TLS/SSL (فعّل مع المنفذ 465)');
    seed('smtp_user', '', 'مستخدم SMTP (البريد)');
    seed('smtp_pass', '', 'كلمة مرور SMTP أو كلمة المرور الخاصة بالتطبيق');
    seed('smtp_from', '', 'البريد الظاهر (مثال: Rafidain <no-reply@domain.iq>)');
    seed('sms_enabled', '0', 'تفعيل الرسائل النصية (SMS)');
    seed('sms_provider', 'generic', 'نوع مزود الرسائل (generic = بوابة HTTP عامة)');
    seed('sms_base_url', '', 'رابط بوابة SMS — نموذج يحوي {to} {message} {api_key} {api_secret} {sender}');
    seed('sms_api_key', '', 'مفتاح API للرسائل النصية');
    seed('sms_api_secret', '', 'السر API للرسائل النصية (اختياري)');
    seed('sms_sender', '', 'اسم المرسل Sender ID');
  },
};
