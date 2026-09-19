# تجهيز النشر على Google Play — SavageBlock

كل ما تحتاجه لملء Play Console. الأجزاء التقنية (AAB، التوقيع، targetSdk 35) جاهزة في
المستودع؛ الأجزاء الإدارية (الحساب، الأسرار، الصور) عليك.

## 0. قائمة التحقق السريعة

| البند | الحالة |
|---|---|
| `targetSdk = 35` (متطلب Play منذ أغسطس 2025) | ✅ في `app/build.gradle.kts` |
| App Bundle (AAB) موقّع | ✅ يُبنى في workflow «نشر إصدار SavageBlock» |
| ملف `mapping.txt` لـ R8 | ✅ يُرفق مع الإصدار |
| أيقونة تكيفية + monochrome | ✅ `res/mipmap-anydpi-v26` |
| أيقونة 512×512 وصورة مميزة 1024×500 | ✅ `store/icon-512.png`، `store/feature-graphic.png` |
| سياسة خصوصية برابط عام | ✅ `PRIVACY_POLICY.md` (رابطها في `strings.xml`) |
| مفتاح توقيع ثابت | ✅ `keystore/savageblock-release.jks` (للتوزيع المباشر). لـ Play فعّل Play App Signing أو انقل المفتاح إلى الأسرار (القسم 1) |
| حساب مطوّر Google Play (25$ مرة واحدة) | ⚠️ عليك |
| لقطات شاشة (2–8 لكل نوع جهاز) | ⚠️ خذها من الجهاز بعد التثبيت |
| نموذج «Foreground service» في Play Console | ⚠️ النص جاهز في القسم 4 |

## 1. مفتاح التوقيع (مرة واحدة، لا تفقده)

```bash
cd savageblock
./scripts/make-keystore.sh          # يولّد savageblock-upload.jks ويطبع القيم
```

ثم في GitHub: **Settings → Secrets and variables → Actions → New repository secret**:

| الاسم | القيمة |
|---|---|
| `SAVAGEBLOCK_KEYSTORE_BASE64` | الناتج من السكربت (base64 للملف) |
| `SAVAGEBLOCK_STORE_PASS` | كلمة مرور المخزن التي أدخلتها |
| `SAVAGEBLOCK_KEY_ALIAS` | `savageblock` |
| `SAVAGEBLOCK_KEY_PASS` | كلمة مرور المفتاح |

بعدها كل إصدار يُوقَّع بنفس المفتاح. **احتفظ بنسخة من `.jks` خارج المستودع**؛ فقدانه
يعني عدم القدرة على تحديث التطبيق في المتجر (إلا إذا فعّلت Play App Signing وسجّلت
مفتاح رفع جديد عبر الدعم).

نصيحة: عند إنشاء التطبيق في Play Console اختر **Play App Signing** (الافتراضي). حينها
مفتاحك هو «مفتاح الرفع» فقط وGoogle تحتفظ بمفتاح التوقيع النهائي.

## 2. إصدار جديد

1. عدّل `versionCode` (رقم صحيح متزايد) و`versionName` في `app/build.gradle.kts`.
2. اكتب نفس الرقم في `savageblock/RELEASE_VERSION` وادفع التغيير.
3. الـ workflow يبني ويوقّع ويرفع `SavageBlock-<v>.aab` و`.apk` و`mapping.txt` في صفحة Releases.
4. في Play Console: **Production → Create new release → Upload** الـ AAB، وارفع `mapping.txt`
   تحت App bundle explorer → Downloads → Upload ReTrace mapping file.

## 3. بيانات المتجر

**اسم التطبيق (30 حرفًا):** `SavageBlock — كافي تضييع`

**الوصف المختصر (80 حرفًا):**
`حظر عدواني لتيك توك وإنستقرام ويوتيوب: تعدّي الحد.. تنهزأ.`

**الوصف الكامل (4000 حرف):**

```
كافي تضييع.

SavageBlock تطبيق يراقب وقتك على تطبيقات التضييع (تيك توك، إنستقرام، يوتيوب، X، سناب…)
ولما تتعدى الحد اللي حددته بنفسك، يغطي الشاشة كاملة بتهزيء ما يرحم. ما فيه زر رجوع،
ما فيه تخطي، فيه عدّ تنازلي إجباري وفي أعنف مستوى لازم تكتب اعتراف بالحرف عشان تطلع.

★ ثلاثة مستويات وقاحة
خفيف: سخرية ذكية. متوسط: طقطقة قوية واهتزاز. عديم الرحمة: إهانات مبطنة، إنذار صوتي،
اهتزاز مستمر، واعتراف مكتوب.

★ تهزيء يعرف نقطة ضعفك
حدد هدفك (دراسة، شغل، جيم، مشروع تجاري) ونصف العبارات تضرب عليه بالذات.

★ لوحة نظيفة وتقارير تفضحك
الوقت الضائع اليوم، عدد الضربات، سلسلة الالتزام، والمتبقي من حدّك. تقارير يومية
وأسبوعية وشهرية مع مؤشر نصف دائري ورسوم بيانية، وجدار عار يترجم دقائقك لصفحات كتاب
وخطوات مشي ونسبة من كورس كامل.

★ أوقات التركيز
فعّل الحظر فقط في ساعات معينة وأيام معينة، وخارجها احسب بس بدون تهزيء.

★ الوضع الصارم
اقفل على نفسك حتى منتصف الليل: ما تقدر توقف المراقبة ولا تزيد الحدود ولا تحذف تطبيق.

★ تنبيه قبل الحد
إشعار عند 80٪ (قابل للتعديل) عشان تقفل وأنت مرفوع الرأس.

★ خصوصية كاملة
كل شي على جهازك. ما فيه سيرفر، ما فيه حساب، ما فيه إعلانات، وما نرسل أي بيانات لأحد.

يدعم الأجهزة القابلة للطي والأجهزة اللوحية بتخطيط ثنائي الأعمدة.

الصلاحيات المطلوبة: الوصول لبيانات الاستخدام (لمعرفة التطبيق المفتوح ومدته) والظهور فوق
التطبيقات (لعرض شاشة الحظر). بدونهما التطبيق ما يقدر يسوي شي.
```

**English short description:**
`Savage app blocker for TikTok, Instagram & YouTube. Cross your limit, get roasted.`

**English full description (optional second language):**

```
Enough scrolling.

SavageBlock watches your time on the apps that eat your day (TikTok, Instagram, YouTube, X,
Snapchat…) and, once you cross the limit you set yourself, covers the whole screen with a
merciless roast. No back button, no skip: a mandatory countdown, and on the harshest level
you must type a written confession to leave.

• Three aggression levels: witty, harsh, or savage (alarm sound, constant vibration, confession).
• Roasts that know your weak spot: pick study, work, gym or business.
• Clean dashboard and reports: today's wasted minutes, strikes, streak, remaining allowance;
  daily / weekly / monthly reports with a gauge and charts; a "hall of shame" that converts
  minutes into book pages, steps and course progress.
• Focus hours: block only during the hours and days you choose.
• Strict mode: lock yourself in until midnight — no stopping, no raising limits, no removing apps.
• Heads-up at 80% of a limit.
• Total privacy: everything stays on your device. No server, no account, no ads, no tracking.

Supports foldables and tablets with a two-pane layout.

Required permissions: Usage access (which app is open and for how long) and Draw over other
apps (to show the blocking screen).
```

**الفئة:** Productivity · **الوسوم:** Digital wellbeing, App blocker, Focus, Screen time
**جهة الاتصال:** بريدك الإلكتروني · **سياسة الخصوصية:** رابط `PRIVACY_POLICY.md` العام

## 4. الإقرارات في Play Console

### Data safety
- Does your app collect or share any of the required user data types? **No**
- Is all of the user data collected by your app encrypted in transit? **N/A** (لا يوجد جمع)
- Do you provide a way for users to request that their data is deleted? **Yes** (امسح السجل / إلغاء التثبيت)

### Foreground service permission declaration (`FOREGROUND_SERVICE_SPECIAL_USE`)
نوع الخدمة: **Special use**. وصف مقترح:

```
SavageBlock is a user-configured screen-time limiter. The user explicitly selects apps and a
daily allowance. A foreground service polls the foreground app once per second via
UsageStatsManager to accumulate usage and, when the self-imposed limit is exceeded, shows a
blocking overlay. No other foreground service type (e.g. dataSync, mediaPlayback) describes
continuous local usage monitoring. The service runs only while the user keeps monitoring on,
shows a persistent notification with a Stop action, and is never used for background data
transfer.
```

### Permissions declaration
- **Usage access (`PACKAGE_USAGE_STATS`)**: Core feature — measuring time spent in the apps
  the user chose to limit. Prominent in-app disclosure is shown on the permissions screen
  before the settings page is opened.
- **Display over other apps (`SYSTEM_ALERT_WINDOW`)**: Core feature — the blocking screen.

### Content rating (IARC)
أجب بصدق: لا عنف، لا محتوى جنسي، لا مقامرة. **يوجد لغة قاسية/ساخرة** يختارها المستخدم
(اختر «Mild/Infrequent profanity or crude humor»). التصنيف المتوقع: Teen / PEGI 12.

### Target audience
13+ (لا تختر الأطفال).

## 5. لقطات الشاشة

خذ من جهازك (Settings → Developer options → Take screenshot، أو زر الطاقة + خفض الصوت):
1. الرئيسية (لوحة الوقت الضائع والبلاطات).
2. التقارير (المؤشر والرسم البياني).
3. شاشة الحظر (افتح تطبيق محظور بعد تجاوز الحد).
4. الإعدادات (أوقات التركيز + الوضع الصارم).
5. Onboarding.

المقاسات المقبولة: 16:9 أو 9:16، بين 320 و3840 بكسل. جهاز 1080×2400 مناسب.
