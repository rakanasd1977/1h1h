const { db, run, all, get } = require('../index');

module.exports = {
  name: "048_provider_verification_enforcement",
  // إعداد إلزام المزوّدين بالتوثيق قبل النشر (👈 تجريبي الآن افتراضياً معطّل؛
  // عند تفعيله يمنع غير الموثقين من إضافة/تفعيل الكتالوج والترويج).
  up: ()=>{const exists=get("SELECT key FROM settings WHERE key = ?",["require_provider_verification"]);if(!exists){run("INSERT INTO settings (key, value, label) VALUES (?,?,?)",["require_provider_verification","0","\u0625\u0644\u0632\u0627\u0645 \u0627\u0644\u0645\u0632\u0648\u0651\u062F\u064A\u0646 \u0628\u0627\u0644\u062A\u0648\u062B\u064A\u0642 \u0642\u0628\u0644 \u0627\u0644\u0646\u0634\u0631"])}},
};