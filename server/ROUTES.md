# وثائق مسارات الـ API (Backend Routes)

> وثيقة مولّدة آلياً عبر مسح وحدات `src/routes/*.ts` وخرائط التركيب في `src/routes/index.ts`. كل المسارات مُعرّضة تحت بادئة `/api` (مثال: `/api/agents/...`).

## سياسة الحماية (Security)

- **عام**: بلا `authenticate` (مثل `/api/public/*`).
- **مصادقة**: يتطلب `Authorization: Bearer <token>` (`authenticate`).
- **دور/صلاحية**: يتطلب دوراً (`requireRole`) أو صلاحية مورد/فعل (`requirePermission`/`requirePermissionForAdmin`). المسؤول الأعلى (super_admin) يتجاوز الصلاحيات.
- **مسؤول أعلى**: مسارات حسّاسة (إنشاء مستخدم، تعديل صلاحيات الأدوار) مقصورة على super_admin.
- **CSRF**: العمليات المُعدّلة محميّة بـ CSRF عند جلسة تعتمد على الكوكي.

## الوحدة: /health  (البادئة: `/health`)

| الطريقة | المسار الكامل | الحماية |
|---------|--------------|----------|
| GET | `/health` | مصادقة |

## الوحدة: activity  (البادئة: `/activity`)

| الطريقة | المسار الكامل | الحماية |
|---------|--------------|----------|
| GET | `/activity/` | مصادقة |
| GET | `/activity/export` | مصادقة |

## الوحدة: admin-catalog  (البادئة: `/catalog`)

| الطريقة | المسار الكامل | الحماية |
|---------|--------------|----------|
| GET | `/catalog/kinds` | صلاحية:catalog/view |
| GET | `/catalog/` | صلاحية:catalog/view |
| GET | `/catalog/:kind/:id` | صلاحية:catalog/view |
| PUT | `/catalog/:kind/:id` | صلاحية:catalog/edit |
| POST | `/catalog/:kind/:id/toggle` | صلاحية:catalog/edit |
| DELETE | `/catalog/:kind/:id` | صلاحية:catalog/delete |

## الوحدة: admin-coupons  (البادئة: `/coupons`)

| الطريقة | المسار الكامل | الحماية |
|---------|--------------|----------|
| GET | `/coupons/` | صلاحية:coupons/view |
| GET | `/coupons/:id` | صلاحية:coupons/view |
| POST | `/coupons/` | صلاحية:coupons/create |
| PUT | `/coupons/:id` | صلاحية:coupons/edit |
| POST | `/coupons/:id/toggle` | صلاحية:coupons/edit |
| DELETE | `/coupons/:id` | صلاحية:coupons/delete |

## الوحدة: admin-notify  (البادئة: `/admin/notifications`)

| الطريقة | المسار الكامل | الحماية |
|---------|--------------|----------|
| POST | `/admin/notifications/send` | صلاحية:notifications/create |

## الوحدة: admin-reviews  (البادئة: `/reviews`)

| الطريقة | المسار الكامل | الحماية |
|---------|--------------|----------|
| GET | `/reviews/` | صلاحية:reviews/view |
| DELETE | `/reviews/:scope/:id` | صلاحية:reviews/delete |

## الوحدة: agent  (البادئة: `/agent`)

| الطريقة | المسار الكامل | الحماية |
|---------|--------------|----------|
| GET | `/agent/lease` | مصادقة |
| POST | `/agent/lease/renew` | مصادقة |
| GET | `/agent/commissions` | مصادقة |
| GET | `/agent/dashboard` | مصادقة |
| GET | `/agent/dashboard/export` | مصادقة |
| GET | `/agent/customers` | مصادقة |
| GET | `/agent/customers/export` | مصادقة |
| GET | `/agent/wallet` | مصادقة |
| POST | `/agent/wallet/withdraw` | إيجار-وكيل |
| GET | `/agent/commissions/export` | مصادقة |
| GET | `/agent/wallet/export` | مصادقة |
| POST | `/agent/providers/broadcast` | إيجار-وكيل |
| POST | `/agent/orders/remind-pending` | إيجار-وكيل |
| GET | `/agent/activity` | مصادقة |

## الوحدة: agent-withdrawals  (البادئة: `/agent-withdrawals`)

| الطريقة | المسار الكامل | الحماية |
|---------|--------------|----------|
| GET | `/agent-withdrawals/` | صلاحية:withdrawals/view |
| POST | `/agent-withdrawals/:id/decision` | صلاحية:withdrawals/edit |

## الوحدة: agents  (البادئة: `/agents`)

| الطريقة | المسار الكامل | الحماية |
|---------|--------------|----------|
| GET | `/agents/` | صلاحية:agents/view |
| GET | `/agents/:id` | صلاحية:agents/view |
| POST | `/agents/` | صلاحية:agents/create |
| PUT | `/agents/:id` | صلاحية:agents/edit |
| DELETE | `/agents/:id` | صلاحية:agents/delete |
| POST | `/agents/:id/renew-lease` | صلاحية:agents/edit |
| GET | `/agents/:id/lease-payments` | صلاحية:agents/view |

## الوحدة: auth  (البادئة: `/auth`)

| الطريقة | المسار الكامل | الحماية |
|---------|--------------|----------|
| POST | `/auth/login` | عام |
| POST | `/auth/2fa/verify` | عام |
| POST | `/auth/2fa/setup` | مصادقة |
| POST | `/auth/2fa/enable` | مصادقة |
| POST | `/auth/2fa/disable` | مصادقة |
| POST | `/auth/2fa/reset` | مصادقة |
| GET | `/auth/me` | مصادقة |
| POST | `/auth/change-password` | مصادقة + CSRF |
| POST | `/auth/change-email` | مصادقة + CSRF |
| POST | `/auth/register-customer` | عام |
| POST | `/auth/verify-email` | عام |
| POST | `/auth/resend-verification` | عام |
| POST | `/auth/logout` | مصادقة |
| POST | `/auth/logout-all` | مصادقة |
| POST | `/auth/reset-password` | مصادقة + إيجار-وكيل + CSRF |

## الوحدة: backups  (البادئة: `/backups`)

| الطريقة | المسار الكامل | الحماية |
|---------|--------------|----------|
| GET | `/backups/` | دور:admin + صلاحية:backups/view |
| POST | `/backups/` | دور:admin + صلاحية:backups/create |
| GET | `/backups/:name` | دور:admin + صلاحية:backups/view |
| POST | `/backups/:name/restore` | دور:admin + صلاحية:backups/restore |
| POST | `/backups/:name/upload` | دور:admin + صلاحية:backups/create |
| DELETE | `/backups/:name` | دور:admin + صلاحية:backups/delete |

## الوحدة: bulk  (البادئة: `/bulk`)

| الطريقة | المسار الكامل | الحماية |
|---------|--------------|----------|
| GET | `/bulk/template/:entity` | صلاحية:bulk/view |
| POST | `/bulk/preview/:entity` | صلاحية:bulk/view |
| POST | `/bulk/import/:entity` | صلاحية:bulk/create |
| GET | `/bulk/export/:entity` | صلاحية:bulk/export |

## الوحدة: commissions  (البادئة: `/commissions`)

| الطريقة | المسار الكامل | الحماية |
|---------|--------------|----------|
| GET | `/commissions/` | صلاحية:commissions/view |
| PUT | `/commissions/` | صلاحية:commissions/edit |

## الوحدة: customer  (البادئة: `/customer`)

| الطريقة | المسار الكامل | الحماية |
|---------|--------------|----------|
| GET | `/customer/dashboard` | مصادقة |
| GET | `/customer/profile` | مصادقة |
| PUT | `/customer/profile` | مصادقة |
| GET | `/customer/rate/:providerId` | مصادقة |
| POST | `/customer/rate/:providerId` | مصادقة |
| GET | `/customer/rate-item/:kind/:itemId` | مصادقة |
| POST | `/customer/rate-item/:kind/:itemId` | مصادقة |
| GET | `/customer/favorites` | مصادقة |
| GET | `/customer/favorites/ids` | مصادقة |
| POST | `/customer/favorites` | مصادقة |
| DELETE | `/customer/favorites/:providerId` | مصادقة |
| GET | `/customer/favorites/items-ids` | مصادقة |
| GET | `/customer/favorites/items` | مصادقة |
| POST | `/customer/favorites/items` | مصادقة |
| DELETE | `/customer/favorites/items/:itemType/:itemId` | مصادقة |
| GET | `/customer/following` | مصادقة |
| POST | `/customer/follow` | مصادقة |
| DELETE | `/customer/follow/:providerId` | مصادقة |
| GET | `/customer/addresses` | مصادقة |
| POST | `/customer/addresses` | مصادقة |
| PUT | `/customer/addresses/:id` | مصادقة |
| POST | `/customer/addresses/:id/default` | مصادقة |
| DELETE | `/customer/addresses/:id` | مصادقة |
| GET | `/customer/coupons/preview` | مصادقة |
| GET | `/customer/loyalty` | مصادقة |
| GET | `/customer/referral` | مصادقة |

## الوحدة: customers  (البادئة: `/customers`)

| الطريقة | المسار الكامل | الحماية |
|---------|--------------|----------|
| GET | `/customers/` | صلاحية:customers/view |
| GET | `/customers/:id` | صلاحية:customers/view |
| POST | `/customers/` | صلاحية:customers/create |
| PUT | `/customers/:id` | صلاحية:customers/edit |
| DELETE | `/customers/:id` | صلاحية:customers/delete |

## الوحدة: dashboard  (البادئة: `/dashboard`)

| الطريقة | المسار الكامل | الحماية |
|---------|--------------|----------|
| GET | `/dashboard/` | دور:admin + صلاحية:dashboard/view |
| GET | `/dashboard/agent` | دور:agent |
| GET | `/dashboard/executive` | دور:admin + صلاحية:dashboard/view |

## الوحدة: districts  (البادئة: `/districts`)

| الطريقة | المسار الكامل | الحماية |
|---------|--------------|----------|
| GET | `/districts/` | صلاحية:districts/view |
| GET | `/districts/:id` | صلاحية:districts/view |
| POST | `/districts/` | دور:admin + صلاحية:districts/create |
| PUT | `/districts/:id` | دور:admin + صلاحية:districts/edit |
| DELETE | `/districts/:id` | دور:admin + صلاحية:districts/delete |
| POST | `/districts/:id/toggle` | دور:admin + صلاحية:districts/edit |

## الوحدة: financial-report  (البادئة: `/financial-report`)

| الطريقة | المسار الكامل | الحماية |
|---------|--------------|----------|
| GET | `/financial-report/` | مصادقة |
| GET | `/financial-report/export` | مصادقة |

## الوحدة: governorates  (البادئة: `/governorates`)

| الطريقة | المسار الكامل | الحماية |
|---------|--------------|----------|
| GET | `/governorates/` | صلاحية:governorates/view |
| GET | `/governorates/:id` | صلاحية:governorates/view |
| POST | `/governorates/` | دور:admin + صلاحية:governorates/create |
| PUT | `/governorates/:id` | دور:admin + صلاحية:governorates/edit |
| DELETE | `/governorates/:id` | دور:admin + صلاحية:governorates/delete |
| POST | `/governorates/:id/toggle` | دور:admin + صلاحية:governorates/edit |

## الوحدة: leases  (البادئة: `/leases`)

| الطريقة | المسار الكامل | الحماية |
|---------|--------------|----------|
| GET | `/leases/` | صلاحية:leases/view |
| POST | `/leases/` | صلاحية:leases/create |
| PUT | `/leases/:id` | صلاحية:leases/edit |
| POST | `/leases/:id/cancel` | صلاحية:leases/edit |
| GET | `/leases/agent/:agentId` | صلاحية:leases/view |
| POST | `/leases/:id/approve` | صلاحية:leases/edit |
| POST | `/leases/:id/reject` | صلاحية:leases/edit |

## الوحدة: notifications  (البادئة: `/notifications`)

| الطريقة | المسار الكامل | الحماية |
|---------|--------------|----------|
| GET | `/notifications/stream` | مصادقة |
| GET | `/notifications/` | مصادقة |
| POST | `/notifications/:id/read` | مصادقة |
| POST | `/notifications/read-all` | مصادقة |
| GET | `/notifications/unread-count` | مصادقة |

## الوحدة: orders  (البادئة: `/orders`)

| الطريقة | المسار الكامل | الحماية |
|---------|--------------|----------|
| GET | `/orders/` | صلاحية:orders/view |
| GET | `/orders/stats` | صلاحية:orders/view |
| GET | `/orders/export` | صلاحية:orders/export |
| GET | `/orders/:id` | صلاحية:orders/view |
| POST | `/orders/` | صلاحية:orders/create + إيجار-وكيل |
| PUT | `/orders/:id/status` | صلاحية:orders/edit + إيجار-وكيل |

## الوحدة: promotions  (البادئة: `/public/promotions`)

| الطريقة | المسار الكامل | الحماية |
|---------|--------------|----------|
| GET | `/public/promotions/` | دور:provider |
| POST | `/public/promotions/` | دور:provider |
| POST | `/public/promotions/:id/extend` | دور:provider |
| DELETE | `/public/promotions/:id` | صلاحية:promotions/delete |
| GET | `/public/promotions/admin/items` | دور:admin + صلاحية:promotions/view |
| POST | `/public/promotions/admin/create` | دور:admin + صلاحية:promotions/create |
| GET | `/public/promotions/all` | دور:admin + صلاحية:promotions/view |
| GET | `/public/promotions/all/export` | دور:admin + صلاحية:promotions/export |

## الوحدة: provider  (البادئة: `/provider`)

| الطريقة | المسار الكامل | الحماية |
|---------|--------------|----------|
| GET | `/provider/catalog-net` | مصادقة |
| GET | `/provider/dashboard` | مصادقة |
| GET | `/provider/profile` | مصادقة |
| PUT | `/provider/profile` | مصادقة |
| GET | `/provider/bookings` | مصادقة |
| GET | `/provider/orders-summary` | مصادقة |
| GET | `/provider/rooms/availability` | مصادقة |
| GET | `/provider/ratings` | مصادقة |
| PUT | `/provider/ratings/:id/reply` | مصادقة |
| GET | `/provider/verification` | مصادقة |
| PUT | `/provider/verification` | مصادقة |
| GET | `/provider/coupons` | مصادقة |
| POST | `/provider/coupons` | مصادقة |
| PUT | `/provider/coupons/:id` | مصادقة |
| POST | `/provider/coupons/:id/toggle` | مصادقة |
| DELETE | `/provider/coupons/:id` | مصادقة |

## الوحدة: providers  (البادئة: `/providers`)

| الطريقة | المسار الكامل | الحماية |
|---------|--------------|----------|
| GET | `/providers/` | صلاحية:providers/view |
| GET | `/providers/:id` | صلاحية:providers/view |
| GET | `/providers/:id/overview` | صلاحية:providers/view |
| POST | `/providers/` | صلاحية:providers/create + إيجار-وكيل |
| PUT | `/providers/:id` | صلاحية:providers/edit |
| POST | `/providers/:id/toggle` | صلاحية:providers/edit |
| GET | `/providers/:id/documents/:field` | صلاحية:providers/view |
| POST | `/providers/:id/verify` | صلاحية:providers/edit |
| POST | `/providers/:id/reset-password` | صلاحية:providers/edit |
| DELETE | `/providers/:id` | صلاحية:providers/delete |

## الوحدة: public  (البادئة: `/public`)

| الطريقة | المسار الكامل | الحماية |
|---------|--------------|----------|
| GET | `/public/payment-info` | مصادقة + دور:provider |
| GET | `/public/governorates` | عام |
| GET | `/public/governorates/by-geo` | عام |
| GET | `/public/coupons` | عام |
| GET | `/public/config` | عام |
| GET | `/public/services` | عام |
| GET | `/public/providers` | عام |
| GET | `/public/providers/:id` | عام |
| GET | `/public/providers/:id/reviews` | عام |
| GET | `/public/providers/:id/categories` | عام |
| GET | `/public/providers/:id/products` | عام |
| GET | `/public/providers/:id/menu` | عام |
| GET | `/public/providers/:id/rooms` | عام |
| GET | `/public/providers/:id/flights` | عام |
| GET | `/public/providers/:id/packages` | عام |
| GET | `/public/items/:kind/:id/reviews` | عام |
| GET | `/public/deals` | عام |
| GET | `/public/top-selling` | عام |
| GET | `/public/home-layout` | عام |
| PUT | `/public/home-layout` | مصادقة + دور:admin + صلاحية:home_layout/edit |
| GET | `/public/content` | عام |

## الوحدة: push  (البادئة: `/push`)

| الطريقة | المسار الكامل | الحماية |
|---------|--------------|----------|
| GET | `/push/vapid-key` | مصادقة |
| POST | `/push/subscribe` | مصادقة |
| POST | `/push/unsubscribe` | مصادقة |

## الوحدة: rbac  (البادئة: `/rbac`)

| الطريقة | المسار الكامل | الحماية |
|---------|--------------|----------|
| GET | `/rbac/roles` | صلاحية:roles/view |
| GET | `/rbac/roles/:id` | صلاحية:roles/view |
| POST | `/rbac/roles` | صلاحية:roles/create |
| PUT | `/rbac/roles/:id` | صلاحية:roles/edit |
| DELETE | `/rbac/roles/:id` | صلاحية:roles/delete |
| PUT | `/rbac/roles/:id/permissions` | صلاحية:roles/edit + مسؤول-أعلى |
| GET | `/rbac/users` | صلاحية:users/view |
| POST | `/rbac/users` | صلاحية:users/create + مسؤول-أعلى |
| PATCH | `/rbac/users/:id` | صلاحية:users/edit |
| DELETE | `/rbac/users/:id` | صلاحية:users/delete |
| POST | `/rbac/users/:userId/roles` | صلاحية:users/edit |
| DELETE | `/rbac/users/:userId/roles/:roleId` | صلاحية:users/edit |
| GET | `/rbac/resources` | صلاحية:roles/view |

## الوحدة: recharges  (البادئة: `/recharges`)

| الطريقة | المسار الكامل | الحماية |
|---------|--------------|----------|
| GET | `/recharges/` | دور:admin + صلاحية:recharges/view |
| GET | `/recharges/provider` | مصادقة |
| GET | `/recharges/:id` | صلاحية:recharges/view |
| POST | `/recharges/` | صلاحية:recharges/create |
| POST | `/recharges/:id/approve` | دور:admin + صلاحية:recharges/edit |
| POST | `/recharges/:id/reject` | دور:admin + صلاحية:recharges/edit |

## الوحدة: services  (البادئة: `/services`)

| الطريقة | المسار الكامل | الحماية |
|---------|--------------|----------|
| GET | `/services/` | صلاحية:services/view |
| POST | `/services/` | دور:admin + صلاحية:services/create |
| PUT | `/services/:id` | دور:admin + صلاحية:services/edit |
| POST | `/services/:id/toggle` | دور:admin + صلاحية:services/edit |
| DELETE | `/services/:id` | دور:admin + صلاحية:services/delete |

## الوحدة: settings  (البادئة: `/settings`)

| الطريقة | المسار الكامل | الحماية |
|---------|--------------|----------|
| GET | `/settings/` | صلاحية:settings/view |
| PUT | `/settings/` | صلاحية:settings/edit |
| PUT | `/settings/:key` | صلاحية:settings/edit |
| GET | `/settings/:key` | صلاحية:settings/view |

## الوحدة: upload  (البادئة: `/upload`)

| الطريقة | المسار الكامل | الحماية |
|---------|--------------|----------|
| POST | `/upload/` | مصادقة |

## الوحدة: wallets  (البادئة: `/wallets`)

| الطريقة | المسار الكامل | الحماية |
|---------|--------------|----------|
| GET | `/wallets/provider` | مصادقة |
| GET | `/wallets/` | دور:admin + صلاحية:wallets/view |
| GET | `/wallets/agent/ledger` | مصادقة |
| GET | `/wallets/:id` | دور:admin + صلاحية:wallets/view |
| POST | `/wallets/:id/recharge` | دور:admin + صلاحية:wallets/edit |

## الوحدة: payments  (البادئة: `/payments`)

> البنية الأساسية لبوابات الدفع. كل البوابات مسجّلة معطّلة (`is_active=0`) في وضع تجريبي؛
> أي عملية دفع عبر بوابة معطّلة تُرد بـ 501 ولا تلمس نظام المحافظ إطلاقاً.

| الطريقة | المسار الكامل | الحماية |
|---------|--------------|----------|
| GET | `/payments/` | صلاحية:payment_gateways/view |
| POST | `/payments/charge` | مصادقة (يُرد 501 ما لم تكن البوابة مفعّلة) |
| POST | `/payments/webhook/:gateway` | مصادقة (يُرد 501 ما لم تكن البوابة مفعّلة) |
| POST | `/payments/refund` | مصادقة (يُرد 501 ما لم تكن البوابة مفعّلة) |
| GET | `/payments/:code` | صلاحية:payment_gateways/view |
