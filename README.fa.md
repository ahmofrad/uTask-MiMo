<div dir="rtl" align="center">

# 🚀 تسک‌اپ (TaskApp)

**پلتفرم مدیریت تسک سازمانی — مستقر در محل**

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-TBD-blue)](#مجوز)

فارسی 🇮🇷 · English 🇺🇸 — پشتیبانی کامل RTL، تقویم جلالی

[English](./README.md) | [فارسی](./README.fa.md)

</div>

---

<div dir="rtl">

## تسک‌اپ چیست؟

تسک‌اپ یک **پلتفرم مدیریت تسک سازمانی و مستقر در محل** است که برای شرکت‌هایی طراحی شده که زیرساخت خود را مدیریت می‌کنند. این پلتفرم رابط کاربری مدرن مدیریت تسک/پروژه را با قابلیت‌های سیستم اطلاعات مدیریت پروژه (PMIS) ترکیب می‌کند — خط‌مبنای پروژه، ارزش کسب‌شده، ردیابی ریسک، درخواست‌های تغییر و خودکارسازی.

**نکات کلیدی:**

- 🔐 **۳ روش احراز هویت** — محلی (ایمیل/گذرواژه)، LDAP/AD، SAML 2.0 SSO
- 🌐 **دو زبانه** — فارسی (پیش‌فرض، RTL، تقویم جلالی) + انگلیسی
- 📊 **مدیریت پروژه** — خط‌مبنای پروژه، EVM، ثبت ریسک، درخواست تغییر
- 🤖 **خودکارسازی** — موتور «ماشه → شرط → عمل»
- 🌙 **پوسته‌بندی** — حالت روشن/تاریک، ۸ رنگ لهجه + انتخابگر سفارشی
- 🔌 **API عمومی REST** — توکن bearer، OpenAPI 3.1، Swagger UI
- 📡 **وب‌هوک** — امضای HMAC-SHA256، تلاش خودکار، نامه‌ مرده
- 🏠 **مستقر در محل** — Docker Compose برای کوچک، Helm برای بزرگ. بدون تله‌متری.

---

## ✨ امکانات

### مدیریت تسک
- پروژه‌ها، تسک‌ها، زیرتسک‌ها با قابلیت کشیدن و مرتب کردن
- نظرات، اشاره‌ها، پیوست‌ها
- فیلدهای سفارشی پروژه‌محور (متن، عدد، تاریخ، انتخابی، کاربر، چک‌باکس، URL)
- نمایش‌های کانبان، لیست، گانت، WBS، تقویم
- روزهای کاری / تعطیلات / برنامه‌ریزی ظرفیت

### مدیریت و برنامه‌ریزی پروژه
- **خط‌مبنای پروژه و EVM** — اسنپ‌شات برنامه زمانی، محاسبه CPI/SPI/EAC، نمودار S، گزارش انحرافات
- **ثبت ریسک** — امتیازدهی احتمال × تأثیر، برنامه‌های پاسخ (کاهش/پذیرش/انتقال/اجتناب)
- **درخواست‌های تغییر** — چرخه حیات رسمی CR با اسنپ‌شات خودکار خط‌مبنای هنگام اعمال
- **قوانین خودکارسازی** — ماشه روی تغییر وضعیت، تخصیص، تاریخ سررسید → اجرای عملیات

### احراز هویت و امنیت
- حساب‌های محلی با هش bcrypt + قفل حمله Brute-force
- ادغام LDAP / Active Directory با تخصیص گروه‌محور
- SAML 2.0 SSO (Azure AD، Okta، Keycloak، AD FS)
- احراز هویت دو مرحله‌ای TOTP با ثبت QR، رمزهای رمزنگاری‌شده، کدهای بازیابی
- کنترل دسترسی نقش‌محور — مالک، مدیر، مدیر پروژه، عضو، مهمان

### ادغام‌ها
- API عمومی REST با توکن‌های bearer کاربرمحور و محدوده‌های دسترسی
- وب‌هوک با امضای HMAC-SHA256 و تلاش خودکار
- بلادرنگ از طریق Socket.IO

### استقرار
- Docker Compose برای استقرار تک ماشین مجازی (< ۵۰۰ کاربر)
- نمودار Helm برای Kubernetes (۱,۰۰۰ تا ۱۰,۰۰۰ کاربر)
- بدون ترافیک خروجی، بدون تله‌متری، بدون وابستگی‌های شخص ثالث

---

## 📚 مستندات

| سند | توضیحات |
|-----|---------|
| [`SPEC.md`](./SPEC.md) | مشخصات کامل محصول |
| [`AGENTS.md`](./AGENTS.md) | راهنمای عامل‌های کدنویسی هوش مصنوعی |
| [`TASKS.md`](./TASKS.md) | برنامه ساخت مرحله‌ای |
| [`AUTH.md`](./AUTH.md) | راهنمای احراز هویت محلی + LDAP + SAML SSO |
| [`i18n.md`](./i18n.md) | فارسی + انگلیسی، RTL، تقویم جلالی |
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | استقرار در محل (Docker + Helm) |
| [`DESIGN.md`](./DESIGN.md) | سیستم طراحی — توکن‌ها، تایپوگرافی، مولفه‌ها |
| [`INSTALL.md`](./INSTALL.md) | راهنمای نصب |
| [`docs/admin-guide.md`](./docs/admin-guide.md) | راهنمای مدیریت سیستم |
| [`docs/user-guide.md`](./docs/user-guide.md) | مستندات کاربر نهایی |
| [`docs/api-integration.md`](./docs/api-integration.md) | ادغام API REST |
| [`docs/webhook-integration.md`](./docs/webhook-integration.md) | ادغام وب‌هوک |
| [`docs/roadmap-pmis.md`](./docs/roadmap-pmis.md) | نقشه راه قابلیت‌های PMIS |

---

## 🛠 فناوری‌های استفاده شده

| لایه | فناوری |
|------|--------|
| **فرانت‌اند** | Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind CSS · shadcn/ui |
| **بک‌اند** | Node.js 20 LTS · Fastify (اختیاری) |
| **پایگاه داده** | PostgreSQL 16 · PgBouncer · Prisma ORM |
| **کش / صف** | Redis 7 · BullMQ |
| **بلادرنگ** | Socket.IO با آداپتور Redis |
| **احراز هویت** | Auth.js v5 · `ldapts` · `@node-saml/node-saml` |
| **بین‌المللی‌سازی** | `next-intl` · `date-fns-jalali` |
| **ذخیره‌سازی** | سازگار با S3 (MinIO) |
| **لاگ** | Pino → Loki |
| **متغیرها** | prom-client → Prometheus → Grafana |
| **ردیابی** | OpenTelemetry → Tempo |
| **PWA** | Serwist service worker |
| **تست** | Vitest · Playwright · Testcontainers |
| **استقرار** | Docker Compose · Helm |

---

## 🚀 شروع سریع

### پیش‌نیازها

- **Node.js** ≥ 20
- **pnpm** ≥ 9 (`npm i -g pnpm`)
- **Docker** + Docker Compose v2.20+
- ۴ گیگابایت RAM خالی

### راه‌اندازی توسعه

```bash
# 1. نصب وابستگی‌ها
pnpm install

# 2. راه‌اندازی پشته محلی (Postgres، Redis، MinIO، Mailhog)
pnpm docker:up

# 3. تنظیم محیط
cp .env.example .env

# 4. مقداردهی اولیه پایگاه داده
pnpm db:baseline    # هماهنگ‌سازی اسکیما + تاریخچه مایگریشن
pnpm db:seed        # ایجاد admin@utask.local (گذرواژه: password)
pnpm db:sample      # اختیاری: اضافه کردن داده نمونه

# 5. راه‌اندازی سرور توسعه
pnpm dev
```

باز کنید **http://localhost:3000** 🎉

### حساب‌های پیش‌فرض (پس از `db:sample`)

| نقش | ایمیل | گذرواژه |
|-----|-------|---------|
| مالک | owner@utask.local | password |
| مدیر سیستم | admin@utask.local | password |
| مدیر پروژه | manager@utask.local | password |
| عضو | sara@utask.local | password |
| عضو | ali@utask.local | password |
| مهمان | guest@utask.local | password |

---

## 📦 دستورات موجود

| دستور | توضیحات |
|-------|---------|
| `pnpm dev` | سرور توسعه |
| `pnpm worker` | کارگر پس‌زمینه (BullMQ + هماهنگ‌سازی LDAP) |
| `pnpm build` | بیلد تولید |
| `pnpm start` | سرور تولید |
| `pnpm lint` | بررسی ESLint |
| `pnpm typecheck` | بررسی TypeScript |
| `pnpm test` | تست‌های واحد و یکپارچه |
| `pnpm test:e2e` | تست‌های E2E با Playwright |
| `pnpm test:a11y` | تست‌های دسترس‌پذیری |
| `pnpm test:visual` | تست‌های رگرسیون بصری |
| `pnpm docker:up` | راه‌اندازی پشته توسعه |
| `pnpm docker:down` | توقف پشته توسعه |
| `pnpm db:seed` | کاشت داده نمونه |
| `pnpm db:baseline` | هماهنگ‌سازی اسکیما |
| `pnpm dev:clean` | پاک‌سازی کش + راه‌اندازی مجدد |
| `pnpm i18n:check` | بررسی کامل بودن ترجمه‌ها |
| `pnpm design:check` | بررسی نقض توکن‌های طراحی |

---

## 🔌 API عمومی REST

آدرس پایه: `/api/v1/public/` · احراز هویت: `Authorization: Bearer <token>`

| نقطه اتصال | محدوده‌ها | توضیحات |
|-----------|----------|---------|
| `GET /me` | — | هویت جاری |
| `GET/POST /tasks` | `tasks:read` / `tasks:write` | لیست / ایجاد |
| `GET/PATCH/DELETE /tasks/:id` | همان بالا | خواندن / ویرایش / حذف |
| `GET/POST /projects` | `projects:read` / `projects:write` | لیست / ایجاد |
| `GET/POST /webhooks` | `webhooks:manage` | CRUD وب‌هوک |
| `GET/POST/DELETE /tokens` | — | مدیریت توکن‌های خود |

📋 مشخصات کامل: [`/api/v1/public/openapi.json`](/api/v1/public/openapi.json)
📖 رابط Swagger: [`/api/v1/public/docs`](/api/v1/public/docs)

برای مثال‌های کد و بهترین شیوه‌ها، [راهنمای ادغام API](./docs/api-integration.md) را ببینید.

---

## 🌐 بین‌المللی‌سازی

- **پیش‌فرض:** فارسی (fa-IR) — RTL، تقویم جلالی
- **ثانویه:** انگلیسی (en-US) — LTR، تقویم میلادی
- تنظیم زبان کاربرمحور
- بدون رشته‌های سخت‌کد شده — تمام متن‌های رابط از طریق `useTranslations()`
- پشتیبانی کامل RTL با ویژگی‌های CSS منطقی

---

## 🎨 سیستم طراحی

تعریف شده در [`DESIGN.md`](./DESIGN.md):

- متغیرهای CSS مبتنی بر توکن برای رنگ‌ها، فاصله‌ها، تایپوگرافی، حرکات
- حالت روشن + تاریک با بازنویسی کاربرمحور
- ۸ رنگ لهجه + انتخابگر سفارشی (کنتراست WCAG AA)
- آماده RTL با ویژگی‌های CSS منطقی
- کتابخانه مولفه‌ها روی پریمیتیوهای shadcn/ui

---

## 🚢 استقرار

| مقیاس | روش |
|-------|-----|
| کوچک (< ۵۰۰ کاربر) | Docker Compose — تک ماشین مجازی |
| بزرگ (۱,۰۰۰ تا ۱۰,۰۰۰ کاربر) | نمودار Helm روی Kubernetes |

بدون ترافیک خروجی. بدون تله‌متری. بدون وابستگی شخص ثالث.

جزئیات بیشتر در [`DEPLOYMENT.md`](./DEPLOYMENT.md).

---

## 📊 قابلیت مشاهده

- **لاگ‌ها:** Pino → JSON ساختاریافته → Loki
- **متغیرها:** prom-client → Prometheus → داشبوردهای Grafana
- **ردیابی:** OpenTelemetry → Tempo (اختیاری)
- داشبوردهای از پیش آماده Grafana در `ops/grafana/`

---

## 📁 ساختار پروژه

```
src/
├── app/                    # Next.js App Router
│   ├── api/v1/             # API REST داخلی
│   ├── api/v1/public/      # API REST عمومی (توکن bearer)
│   └── [locale]/           # مسیرهای بین‌المللی‌سازی
├── components/             # مولفه‌های رابط
├── lib/                    # منطق تجاری
│   ├── auth/               # محلی + LDAP + SAML
│   ├── baselines/          # EVM و خط‌مبنای پروژه
│   ├── risks/              # ثبت ریسک
│   ├── change-requests/    # چرخه حیات درخواست تغییر
│   ├── automation/         # موتور خودکارسازی
│   ├── custom-fields/      # اسکیما و مقادیر فیلدها
│   ├── api-token/          # مدیریت توکن
│   ├── webhook/            # ارسال رویداد + امضا
│   └── openapi/            # تولیدکننده مشخصات
├── styles/tokens.css       # توکن‌های طراحی
└── messages/               # فایل‌های ترجمه ICU (fa-IR، en-US)

prisma/                     # اسکیما + مایگریشن‌ها + بذر
ops/                        # Docker، Helm، Grafana، Prometheus
scripts/                    # پشتیبان‌گیری، بازیابی، تست دود
tests/                      # واحد، یکپارچه، E2E
```

---

## 📄 مجوز

توسط سازمان استقرارکننده تعیین می‌شود.

---

<div align="center">

**با ❤️ برای تیم‌های سازمانی که حاکمیت داده را ارزشمند می‌دانند ساخته شده.**

</div>
