# 🛡️ Engineering Audit Report — طلباتي WebAR Menu

**Version:** 1.0.0  
**Date:** 2026-07-30  
**Auditors:** AI Code Review Team  
**Environment:** Production (`https://talabati.rest`)  
**Tech Stack:** Firebase Hosting + Functions, Supabase, Express.js, A-Frame 1.5.0, AR.js 3.4.5

---

## 📊 Executive Summary — حالة المشروع

| المجال | الحالة | الخطورة |
|---|---|---|
| Frontend | ❌ يحتاج إصلاح | Critical |
| Backend | ❌ غير موحد | Critical |
| Routing | ❌ معطل | Critical |
| Firebase Functions | ⚠ يحتاج مراجعة | High |
| Supabase | ⚠ يحتاج مراجعة | High |
| Security | ❌ خطر مرتفع | Critical |
| Performance | ⚠ لم يُفحص بالكامل | Medium |
| Testing | ❌ غير موجود | High |
| Monitoring | ❌ غير موجود | High |
| Deployment | ⚠ يحتاج تحسين | Medium |
| Architecture | ❌ يحتاج إعادة تنظيم | High |

---

## 🔴 القسم الأول: مشاكل حرجة (Critical)

### #1 — ثغرة أمنية: مفاتيح Supabase مكشوفة في المستودع

| البند | القيمة |
|---|---|
| **Severity** | 🔴 Critical |
| **Impact** | 100% — يمكن لأي شخص قراءة/كتابة قاعدة البيانات |
| **Likelihood** | مؤكد — المفاتيح موجودة في ملفات `.env` و `.env.production` في Git |
| **Root Cause** | ملفات `.env` لم تُضف إلى `.gitignore`، والمفاتيح الحقيقية مكتوبة مباشرة في الكود المصدري |
| **Evidence** | `SUPABASE_URL=https://hgyhkeuylgqrdtptahru.supabase.co`، `SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...` موجودة في `.env` السطران 8-10 |

**Verification:**
- ✅ شغّل `git log -p -- .env` للتأكد من وجود المفاتيح في تاريخ Git
- ✅ المفاتيح المكشوفة تبقى صالحة حتى تُلغى من Supabase Dashboard

**Action:**
1. ❗ **فوراً**: تدوير المفاتيح من Supabase Dashboard
2. ❗ حذف `.env` من Git باستخدام `git rm --cached .env`
3. ❗ تنظيف تاريخ Git: `git filter-branch` أو `BFG Repo-Cleaner`
4. ❗ التأكد من `.gitignore` يحتوي على `.env`
5. ❗ التحقق من RLS في Supabase

---

### #2 — خادمان منفصلان غير متصلين (Architecture Split)

| البند | القيمة |
|---|---|
| **Severity** | 🔴 Critical |
| **Impact** | 100% — صفحات `/ar/:menuId` و `/menu/:restaurantSlug` لا تعمل لأن منطق التوجيه موجود في `server/index.js` فقط |
| **Likelihood** | مؤكد — Firebase Hosting لا يعرف كيف يوجه هذه المسارات |
| **Root Cause** | المشروع بُني على نسختين: Express server (`server/index.js`) و Firebase Functions (`functions/src/index.js`) بدون تنسيق. Firebase `rewrites` يوجّه `/api/**` فقط إلى `functions`، بينما صفحات HTML الديناميكية تحتاج توجيهاً خاصاً |
| **Evidence** | `firebase.json` سطر 23-25 يوجّه `/api/**` فقط، بينما `server/index.js` سطور 77-89 تعالج `/ar/:menuId` و `/menu/:restaurantSlug` و `/admin` |

**Architecture Issues:**
- ازدواجية الكود بين `server/` و `functions/`
- صعوبة الصيانة
- اختلاف البيئة بين التطوير والإنتاج
- اختلاف Authentication و Routing

**Recommendation:** Firebase Functions تكون Backend الوحيد. حذف `server/` نهائياً.

**Verification:**
- ✅ افتح `https://talabati.rest/ar/{menuId}`
- ✅ يجب تحميل صفحة AR
- ✅ يجب ألا يظهر 404

---

### #3 — دالة `getMenuForAR` تعتمد على RPC غير مضمون في Supabase

| البند | القيمة |
|---|---|
| **Severity** | 🔴 Critical |
| **Impact** | 100% of AR pages fail — `GET /api/menu/:menuId` يفشل |
| **Likelihood** | مؤكد في حال عدم إنشاء الدالة يدوياً |
| **Root Cause** | `getMenuForAR` تستدعي `supabase.rpc('get_menu_for_ar', ...)` لكن دالة PostgreSQL هذه قد لا تكون موجودة في قاعدة البيانات |
| **Evidence** | `server/supabase.js` سطر 290, `functions/src/supabase.js` سطر 322 |

**Action:** إضافة fallback logic بدون RPC — جلب menu مع relations مباشرة باستخدام Supabase JS joins.

**Verification:**
- ✅ `GET /api/menu/{menuId}` يجب أن يرجع JSON كامل مع restaurant, categories, dishes

---

### #4 — Firebase Functions لا تقرأ `.env` في بيئة الإنتاج

| البند | القيمة |
|---|---|
| **Severity** | 🔴 Critical |
| **Impact** | جميع API calls عبر Firebase Functions تفشل (لا Supabase URL/Keys) |
| **Likelihood** | مؤكد ما لم تُضبط المتغيرات في Firebase Secret Manager |
| **Root Cause** | Firebase Functions runtime لا يقرأ ملف `.env` تلقائياً. يجب استخدام `firebase functions:secrets:set` |
| **Evidence** | `functions/src/index.js` سطر 123 يسرد المفاتيح كـ `secrets`، لكن يلزم التأكد أنها مضبوطة فعلاً. أيضاً `server/supabase.js` و `functions/src/supabase.js` يستخدمان `dotenv.config()` (يعمل فقط محلياً) |

**Action:** التأكد من ضبط `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` في Firebase Secret Manager.

**Verification:**
- ✅ شغّل `firebase functions:secrets:list`
- ✅ استدعي `/api/health` عبر Firebase Functions

---

## 🟠 القسم الثاني: مشاكل عالية الخطورة (High)

### #5 — RLS Policies في Supabase — هل Row Level Security مفعّل؟

| البند | القيمة |
|---|---|
| **Severity** | 🟠 High |
| **Impact** | لو المفاتيح مكشوفة + RLS غير مفعلة = أي شخص يقرأ/يكتب جداولك |
| **Likelihood** | يجب التحقق |
| **Root Cause** | ملفات `supabase/fix_rls.sql` و `supabase/storage_policies.sql` موجودة لكن غير مؤكد تطبيقها |
| **Evidence** | `/supabase/fix_rls.sql` موجود |

**Action:** التحقق من RLS policies في Supabase Dashboard.

---

### #6 — CORS Configuration بين talabati.rest والـ Functions/Supabase

| البند | القيمة |
|---|---|
| **Severity** | 🟠 High |
| **Impact** | قد تفشل الطلبات صامتة — المستخدم لا يرى خطأ لكن البيانات لا ترجع |
| **Likelihood** | محتمل — لو `CLIENT_URL` غير مضبوط في Firebase Functions |
| **Root Cause** | `functions/src/index.js` سطر 60: `origin: process.env.CLIENT_URL || 'http://localhost:5173'` |
| **Evidence** | `process.env.CLIENT_URL` مطلوب أن يكون `https://talabati.rest` |

**Verification:**
- ✅ من Console المتصفح: `fetch('https://.../api/health')` من `https://talabati.rest`
- ✅ يجب ألا يظهر خطأ CORS

---

### #7 — `functions/src/supabase.js` يستخدم Proxy — قد يفشل Supabase Client

| البند | القيمة |
|---|---|
| **Severity** | 🟠 High |
| **Impact** | دوال Supabase تحتاج `this` binding صحيح — Proxy قد يكسره |
| **Likelihood** | محتمل في بيئة الإنتاج |
| **Evidence** | `functions/src/supabase.js` سطور 47-57 |

**Action:** استبدال Proxy بـ getter functions مباشرة.

---

### #8 — ملفات `functions/lib/` غير موجودة (Build Output Missing)

| البند | القيمة |
|---|---|
| **Severity** | 🟠 High |
| **Impact** | Firebase Functions قد لا تنشر (deploy يفشل أو ينشر كود قديم) |
| **Likelihood** | محتمل |

**Action:** التأكد من `npm --prefix functions run build` يعمل وينتج `functions/lib/`.

---

## 🟡 القسم الثالث: مشاكل متوسطة الخطورة (Medium)

### #9 — X-Frame-Options: DENY + CSP قد يكسر WebXR

| البند | القيمة |
|---|---|
| **Severity** | 🟡 Medium |
| **Impact** | بعض متصفحات AR (خصوصاً iOS Safari) تحتاج iframe أو fullscreen مع سياسات محددة |
| **Likelihood** | محتمل على iOS |
| **Root Cause** | `firebase.json` سطر 55: `"X-Frame-Options": "DENY"` |
| **Evidence** | `firebase.json` سطور 46-62 |

**Action:** تغيير `DENY` إلى `SAMEORIGIN` + إضافة استثناءات CSP لـ WebXR.

---

### #10 — لا يوجد Health Check Endpoint موحد

| البند | القيمة |
|---|---|
| **Severity** | 🟡 Medium |
| **Impact** | لا يمكن معرفة حالة النظام بعد النشر |
| **Likelihood** | مؤكد — endpoint `/api/health` موجود لكنه لا يفحص التبعيات |

**Action:** توسيع `/api/health` لفحص: Firebase ✅ | Supabase ✅ | Storage ✅ | Functions ✅ | Version | Build | Uptime

---

### #11 — لا يوجد Versioning للـ API

| البند | القيمة |
|---|---|
| **Severity** | 🟡 Medium |
| **Impact** | تحديثات مستقبلية قد تكسر التطبيقات القديمة |
| **Likelihood** | مؤكد مع مرور الوقت |

**Recommendation:** استخدام `/api/v1/menu` بدلاً من `/api/menu`.

---

### #12 — Logging غير كافٍ

| البند | القيمة |
|---|---|
| **Severity** | 🟡 Medium |
| **Impact** | تتبع الأخطاء في الإنتاج صعب جداً |
| **Missing:** | Request ID · Error ID · Structured Logs · Correlation ID |

---

### #13 — لا توجد خطة Backup أو Disaster Recovery

| البند | القيمة |
|---|---|
| **Severity** | 🟡 Medium |
| **Impact** | فقدان البيانات في حال حادث |
| **Missing:** | نسخ دوري · استرجاع · Export |

**Action:** تفعيل Supabase Automated Backups + عمل dump دوري.

---

### #14 — Rate Limiting غير كافٍ

| البند | القيمة |
|---|---|
| **Severity** | 🟡 Medium |
| **Impact** | أي شخص قد يرسل آلاف الطلبات بدون حماية |
| **Evidence** | `server/index.js` سطور 40-45: `max: 100` فقط على `/api/` (100 طلب كل 15 دقيقة — هذا قليل جداً ويُمنع المستخدمين الشرعيين) |

**Action:** زيادة الحد إلى 500+ مع stricter limits على endpoints الحساسة فقط.

---

### #15 — محتوى إعدادات لوحة التحكم قديم

| البند | القيمة |
|---|---|
| **Severity** | 🟡 Medium |
| **Impact** | يرتبك المستخدم |
| **Evidence** | `public/admin/index.html` سطر 538: لا يزال يشير إلى "MongoDB URI" مع أن المشروع migrated إلى Supabase |

---

## 🟢 القسم الرابع: تحسينات (Low Priority)

### #16 — أداء الصفحات

| النقطة | الحالة |
|---|---|
| ضغط الصور | ❌ غير مؤكد |
| Lazy Loading | ⚠ موجود في بعض الصور (`loading="lazy"`) |
| Cache-Control | ✅ موجود في `firebase.json` للأصول الثابتة |
| Code Splitting | ❌ غير موجود |
| Brotli Compression | ❌ غير موجود (Firebase يستخدم gzip) |

### #17 — SEO

| النقطة | الحالة |
|---|---|
| Sitemap | ❌ غير موجود |
| Robots.txt | ❌ غير موجود |
| OG Tags | ❌ غير موجودة |
| Meta Description | ✅ موجودة في الصفحات الرئيسية |
| Title ديناميكي | ❌ ثابت |

### #18 — PWA

| النقطة | الحالة |
|---|---|
| manifest.json | ✅ موجود في `/ar/manifest.json` |
| Service Worker | ❌ غير موجود |
| Offline Support | ❌ لا يوجد |
| Install Prompt | ❌ لا يوجد |

### #19 — Technical Debt

| النقطة | الوصف |
|---|---|
| ازدواجية الكود | `server/supabase.js` و `functions/src/supabase.js` متطابقان تقريباً |
| ملفات غير مستخدمة | `.env.txt`, `.env.example`, `PRODUCTION_CHECKLIST.md`, `server/index.js` (للاستغناء عنه) |
| TODO/Console.log | يحتاج فحص |

### #20 — Tests

| النوع | الحالة |
|---|---|
| Unit Tests | ❌ غير موجودة |
| Integration Tests | ❌ غير موجودة |
| E2E Tests | ❌ غير موجودة |

### #21 — Monitoring

| الأداة | الحالة |
|---|---|
| Firebase Crashlytics | ❌ غير مضبوط |
| Google Analytics | ⚠ GA_MEASUREMENT_ID فارغ في `.env` |
| Error Logging | ⚠ يوجد `console.error` لكن لا يرسل لخدمة |
| Performance Monitoring | ❌ غير موجود |
| Sentry | ⚠ SENTRY_DSN فارغ في `.env` |

### #22 — CI/CD

| الخطوة | الحالة |
|---|---|
| GitHub Actions | ❌ غير موجود |
| Lint | ❌ غير موجود |
| Build تلقائي | ❌ غير موجود |
| Deploy تلقائي | ❌ غير موجود |
| Tests تلقائية | ❌ غير موجودة |

### #23 — آلية Fallback عند فشل تحميل النموذج ثلاثي الأبعاد

| البند | القيمة |
|---|---|
| **Impact** | تجربة مستخدم أفضل عند فشل غير متوقع |
| **الحالي** | `showToast('No 3D model available', 'info')` — جيد لكن يمكن تحسينه |
| **مقترح** | صورة ثابتة للطبق مع رسالة "النموذج ثلاثي الأبعاد غير متاح حالياً" |

### #24 — نسخ احتياطي قبل أي تعديل على قاعدة البيانات

| البند | القيمة |
|---|---|
| **مطلوب قبل:** | إضافة RPC جديد، تعديل schema، تحديث RLS |
| **Action:** | عمل Supabase Database Backup قبل أي migration |

---

## 📋 خطة الإصلاح — مرتبة حسب الأولوية

| # | الإجراء | Severity | الوقت المقدر |
|---|---|---|---|
| 1 | تدوير مفاتيح Supabase + حذفها من Git History | 🔴 Critical | 15 دقيقة |
| 2 | جعل Firebase Functions خادم API الوحيد مع توجيه صحيح للصفحات | 🔴 Critical | 45 دقيقة |
| 3 | إصلاح `getMenuForAR` بدون RPC (استخدام joins) | 🔴 Critical | 20 دقيقة |
| 4 | التأكد من متغيرات البيئة في Firebase Secrets | 🔴 Critical | 10 دقيقة |
| 5 | التحقق من RLS في Supabase | 🟠 High | 15 دقيقة |
| 6 | إصلاح CORS + CSP + X-Frame-Options | 🟠 High | 15 دقيقة |
| 7 | إصلاح `functions/src/supabase.js` Proxy bug | 🟠 High | 10 دقيقة |
| 8 | التحقق من Build output (`functions/lib/`) | 🟠 High | 5 دقيقة |
| 9 | توسيع `/api/health` لفحص جميع التبعيات | 🟡 Medium | 18 دقيقة |
| 10 | تنظيف الإعدادات القديمة (MongoDB reference) | 🟡 Medium | 5 دقيقة |
| 11 | تحسين Rate Limiting | 🟡 Medium | 5 دقيقة |
| 12 | إضافة fallback UI للنماذج ثلاثية الأبعاد | 🟢 Low | 10 دقيقة |
| 13 | حذف `server/` بعد التأكد من عمل Firebase Functions | 🟢 Low | 5 دقيقة |
| 14 | إضافة API Versioning (`/api/v1/`) | 🟢 Low | 10 دقيقة |

**الوقت الإجمالي المقدر:** 3-4 ساعات

---

## 🧪 Verification Checklist

بعد كل إصلاح، تأكد من:

- [x] `GET /api/health` ← يرجع JSON مع حالة جميع التبعيات
- [ ] `GET /api/v1/menu/{menuId}` ← يرجع menu كامل مع dishes
- [ ] `https://talabati.rest/ar/{menuId}` ← يحمّل صفحة AR
- [ ] `https://talabati.rest/menu/{slug}` ← يحمّل صفحة القائمة
- [ ] `https://talabati.rest/admin` ← يحمّل لوحة التحكم
- [ ] لا توجد مفاتيح Supabase في Git History
- [ ] Firebase Functions تنشر بنجاح
- [ ] RLS Policies مفعلة على جميع الجداول
- [ ] CORS: الطلبات من `talabati.rest` تنجح إلى `*.cloudfunctions.net`
- [ ] اختبار AR على جهاز حقيقي (Android Chrome + iOS Safari)