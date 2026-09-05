# سجل تدقيق وتنظيف النظام (CLAUDE.md)

> ملف يوثّق عمليات التدقيق الأمني/الفني والتنظيف التي تُجرى على المستودع حتى لا تُفقد عند ضغط السياق.

## جلسة التدقيق الشاملة (فريق الخبراء) — تاريخ الجلسة

### الهدف
فحص عميق للنظام بالكامل (الخادم + الواجهات الأربع + المشترك) للبحث عن الأخطاء والثغرات وإصلاحها،
مراجعة المسارات بين اللوحات/التطبيق/الخادم، إزالة التكرار والكود الميت، تنظيف الكود وتقسيمه،
ثم إعادة تشغيل الخوادم وفتح الواجهات.

### ما تم إصلاحه (تغييرات آمنة مُطبَّقة وفُحصت)
1. **صلاحيات المقاطعات (RBAC)**: أُضيف مورد `districts` المفقود في `server/src/services/rbac.ts`
   (كان يسبّب رد `400` على مسارات المقاطعات).
2. **توحيد فحص نشاط الوكالة**: دالة موحّدة `isAgentLeaseActive()` في `server/src/utils/helpers.ts`
   تستخدم `lease_status` و`lease_expires_at` معاً. وُحد استخدامها في:
   `services/providers.ts` (ensureLeaseActive)، `services/agent.ts` (resolveActiveAgent)،
   `middleware/rbac.ts` (requireAgentLease)، و`services/orders.ts` (computeCommissions) —
   كان حساب العمولة يعتمد على تاريخ الانتهاء فقط (خطأ منطقي).
3. **شبع قاعدة البيانات (N+1)**:
   - `services.ts` قائمة الخدمات: استعلام واحد بـ `LEFT JOIN ... GROUP BY`.
   - `districts.ts` قائمة المقاطعات: استعلام مجمّع للمندوبين بدل استعلام لكل مقاطعة.
4. **ثغرة SSRF في اشتراك الإشعارات**: `routes/push.ts` يرفض الآن أي نقطة نهاية غير `https`
   أو تشير إلى `localhost`/عناوين IP خاصة (كان يسمح بـ `http://localhost`).
5. **فجوة كاش الملفات الحسّاسة**: نُقل كاش الملفات الحسّاسة (وثائق الهوية/إثباتات الشحن) إلى
   `utils/sensitiveRefs.ts` مع دالة `invalidateSensitiveRefs()` تُستدعى فور الرفع في
   `routes/upload.ts`، فلا تُقدَّم هذه الملفات علناً خلال نافذة الكاش.
6. **إزالة كود ميت**: سطر إعادة تعيين `subtotalAmount` غير ضروري في `orders.ts`؛ وزر هامبرغر
   مخفي (`display:none`) في `admin-panel/src/Layout.tsx`.
7. **إصلاح تجربة المستخدم**: تركيب `ToastProvider` في `customer-mobile/src/main.tsx`
   ليظهر خطأ واجهة الـAPI عبر `useToast()` بدل أن يكون صامتاً.

### ما أُجّل (موصى به — مخاطره عالية دون تغطية اختبارية كاملة)
- استخراج `PanelShell`/`NotificationBell`/`PanelLogin` المكرّرة عبر اللوحات الثلاث إلى `@rafidain/shared/ui`.
- توحيد `EmptyState`/`Toast` في تطبيق الزبون مع النسخة المشتركة.
- كلمات المرور تُعاد نصّية في `providers.ts` (211,349) — يلزم تغيير واجهة العميل أولاً.
- سباق TOCTOU في استهلاك نقاط الولاء (لا قفل على المستوى الذري).
- السماح بمفاتيح إعدادات تعسفية — يُفضّل قائمة بيضاء.
- بطء عامل قاعدة البيانات (Atomics.wait) في `db/index.ts` — إعادة بنية معمارية.

### التحقق
- اختبارات الخادم: **343/343 ناجحة** (`npm test`).
- بناء الواجهات الأربع: **نظيف** (admin / customer-mobile / agent / provider).
- الخوادم: API على 4001 يعمل؛ اللوحات على 5173–5176 تعمل وتم فتحها.
- نقطة `/api/public/home-layout` ترد بالترتيب الصحيح (hero_ads ثم service_grid).

## تجهيز النظام للتثبيت على الخادم (إنتاج)
الهدف: إغلاق فجوات النشر الحرجة قبل الرفع إلى Linux.

### ما تم إصلاحه
1. **tsx/typescript → dependencies** في `server/package.json` (كانا devDependencies فيمنع
   `npm start` عند تثبيت `--omit=dev`). مع التحقق أنهما يُحلَّان من `node_modules`.
2. **تثبيت إصدار Node**: أُضيف `engines.node >=22.5` في `server/package.json` و`package.json`
   الجذر، وأُنشئ `.nvmrc` بقيمة `22` (لـ`node:sqlite` المدمج).
3. **مسارات nginx الثابتة**: حُوّلت المسارات المطلقة `D:/1h1h/deploy/...` داخل
   `deploy/nginx.api.conf` و`deploy/nginx.static.conf` إلى تضمين نسبي `include nginx.headers.conf;`
   (يُحلّ نسبةً إلى مجلد الملف نفسه ⇒ يعمل على Linux وWindows).
4. **نقص limit_req_zone**: أُضيفت `limit_req_zone ... zone=apiperip:10m rate=10r/s;`
   في أعلى `deploy/nginx.conf.example` (كانت مفقودة فيعطل إقلاع nginx الإنتاجي).
5. تُرك عامل قاعدة البيانات كما هو: WAL + busy_timeout + synchronous=NORMAL مضبوطة أصلاً
   في `server/src/db/worker.ts:8-16` (SQLite جاهز لحِمل الإنتاج المتوسط).
6. نقطة `/api/health` موجودة أصلاً (`server/src/routes/index.ts:39`) وتعمل (200) — تصلح
   لفحص صحي أمام موازن الحمل.

### خطوات النشر الموصى بها (للتوثيق لا للتنفيذ التلقائي)
- على الخادم: `node -v` ≥ 22.5 ⇒ `npm install` (جميع التبعيات) ⇒ `npm run migrate`
  ⇒ (مرة واحدة) `npm run seed` ⇒ `pm2 start deploy/ecosystem.config.js --env production`.
- nginx: انقل `deploy/*.conf` إلى `/etc/nginx/rafidain/` واربط `nginx.conf.example`
  إلى `sites-enabled`، ثم `certbot` لشهادات Let's Encrypt، ثم `nginx -t && systemctl reload nginx`.
- مجلدات دائمة: `server/data/` و`server/uploads/` على تخزين دائم + نسخ احتياطي دوري.
- متغيرات البيئة: انسخ `server/.env.example` إلى `server/.env` واضبط `JWT_SECRET`,
  `TOTP_ENC_KEY`, `CORS_ORIGINS`, `DB_PATH`, مفاتيح VAPID (تُولَّد تلقائياً إن غابت).
- بناء الواجهات الأربع من المستودع الكامل (يشمل `@rafidain/shared`) وارفع `dist/` إلى
  `/var/www/rafidain/<app>` كما في `nginx.conf.example`.

### ملاحظات لم تُعدَّل عمداً
- CSP في `headers.conf` (`script-src 'self'`) — يلزم التأكد ألا يكسّر الـSPA إن وُجدت سكربتات
  inline قبل اعتمادها في الإنتاج.
- لا يوجد CD تلقائي (CI يختبر ويبني فقط) — النشر يدوي كما أعلاه.
- للتوسع الأفقي الثقيل يُنصح بالانتقال إلى PostgreSQL.
