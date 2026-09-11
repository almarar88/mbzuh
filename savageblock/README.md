# SavageBlock — كافي تضييع

تطبيق أندرويد أصلي (Kotlin + Jetpack Compose) يراقب وقتك على تطبيقات التضييع
(تيك توك، إنستقرام، يوتيوب، X…) ولما تتعدى الحد اللي حددته بنفسك، يغطي الشاشة
كاملة بشاشة تهزيء عدوانية ما تقدر تتخطاها بسهولة.

كل شي يشتغل على الجهاز. ما فيه سيرفر، ما فيه حساب، وما تُرسل أي بيانات.

## الميزات

| الميزة | التفاصيل |
|---|---|
| **المراقبة** | خدمة أمامية (Foreground Service) تفحص التطبيق الظاهر كل ثانية عبر `UsageStatsManager.queryEvents` وتجمع دقائق اليوم لكل تطبيق محظور. |
| **شاشة الحظر** | نافذة `TYPE_APPLICATION_OVERLAY` مرسومة بـ Compose تغطي الشاشة كاملة، تحجب اللمس عن التطبيق تحتها، وتبتلع زر الرجوع. |
| **العقوبة** | عدّ تنازلي إجباري قبل ما يشتغل زر الخروج، وفي وضع «عديم الرحمة» لازم تكتب جملة الاعتراف «أنا أضيع وقتي بلا هدف» بالحرف. |
| **مستويات الوقاحة** | خفيف (سخرية + ٥ ثوانٍ)، متوسط (طقطقة + اهتزاز + ١٠ ثوانٍ)، عديم الرحمة (إهانات + إنذار صوتي + اهتزاز مستمر + اعتراف مكتوب). |
| **التخصيص حسب الهدف** | دراسة / شغل / جيم / مشروع تجاري / عام. نصف الإهانات تضرب على نقطة ضعفك بالذات. |
| **جدار العار** | عداد الدقائق الضائعة اليوم مترجم لخسائر واقعية: صفحات كتاب، خطوات مشي، تمارين، نسبة من كورس كامل. |
| **الاستمرارية** | يرجع يشتغل تلقائيًا بعد إعادة التشغيل أو التحديث، ويتبنى عدادات النظام نفسها حتى لا تضيع الدقائق لو انقتلت الخدمة. |

## الصلاحيات

| الصلاحية | إجبارية؟ | ليش |
|---|---|---|
| `PACKAGE_USAGE_STATS` (الوصول لبيانات الاستخدام) | نعم | معرفة التطبيق المفتوح حاليًا ومدة استخدامه. |
| `SYSTEM_ALERT_WINDOW` (الظهور فوق التطبيقات) | نعم | رسم شاشة التهزيء فوق التطبيق المحظور. |
| `POST_NOTIFICATIONS` | لا | الإشعار الصامت الدائم للخدمة الأمامية. |
| `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` | لا | يمنع بعض الأجهزة من قتل الخدمة في الخلفية. |

## البناء

المتطلبات: JDK 17 أو أحدث، وAndroid SDK يحتوي على `platforms;android-35` و`build-tools;35.0.0`.

```bash
cd savageblock
echo "sdk.dir=/path/to/android-sdk" > local.properties   # أو صدّر ANDROID_HOME
./gradlew :app:assembleDebug
# النتيجة: app/build/outputs/apk/debug/app-debug.apk
```

نسخة الإصدار (R8 مفعّل، غير موقّعة):

```bash
./gradlew :app:assembleRelease
# النتيجة: app/build/outputs/apk/release/app-release-unsigned.apk
```

للتوقيع أضف `signingConfigs` في `app/build.gradle.kts` أو وقّع الملف الناتج بـ `apksigner`.

## البنية

```
app/src/main/java/com/savageblock/app/
├── SavageBlockApp.kt            # Application: قناة الإشعارات + المستودع
├── MainActivity.kt              # NavHost: onboarding → dashboard → app selector
├── data/
│   ├── Models.kt                # Settings, MonitoredApp, DailyStats, AggressionLevel, Goal
│   ├── Roasts.kt                # مكتبة الإهانات + نصوص جدار العار
│   ├── SettingsRepository.kt    # DataStore (JSON) + ledger اليوم في StateFlow
│   ├── ForegroundDetector.kt    # UsageStatsManager: التطبيق الظاهر + استخدام اليوم
│   └── InstalledApps.kt         # قائمة التطبيقات القابلة للتشغيل + الأيقونات
├── service/
│   ├── MonitorService.kt        # Foreground Service (specialUse) بحلقة فحص كل ثانية
│   ├── OverlayManager.kt        # WindowManager + ComposeView + LifecycleOwner مخصص
│   ├── PenaltyEffects.kt        # الاهتزاز وصوت الإنذار
│   └── BootReceiver.kt          # إعادة التشغيل بعد الإقلاع
├── ui/
│   ├── theme/Theme.kt           # لوحة الألوان، الخطوط، RTL إجباري
│   ├── components/Brutal.kt     # BrutalCard / BrutalButton / HazardStripes …
│   ├── onboarding/              # شاشة الصلاحيات
│   ├── dashboard/               # لوحة التحكم + منتقي التطبيقات + ViewModel
│   └── overlay/                 # محتوى شاشة الحظر
└── util/Permissions.kt          # فحص الصلاحيات و Intents الإعدادات
```

## ملاحظات تقنية

- **الحد الأدنى Android 8.0 (API 26)** لأن `TYPE_APPLICATION_OVERLAY` غير متاح قبله. الهدف API 35.
- **Android 14+**: الخدمة تستخدم `foregroundServiceType="specialUse"` مع خاصية `PROPERTY_SPECIAL_USE_FGS_SUBTYPE` كما يشترط Google Play.
- **الرجوع للشاشة الرئيسية** بعد الخروج من الحظر يتم عبر `ACTION_MAIN/CATEGORY_HOME`؛ التطبيقات الحاصلة على `SYSTEM_ALERT_WINDOW` مستثناة من قيود تشغيل الأنشطة من الخلفية.
- **الخط**: يُستخدم خط النظام الافتراضي بوزن Black. لخط عربي أثقل (مثل Cairo Black) ضع الملف في `res/font/` وبدّل `Heavy` في `Theme.kt`.
- **المطابقة في الاعتراف** متساهلة: تتجاهل التشكيل، وفرق الهمزات، والمسافات الزائدة، لكن لازم الجملة نفسها.
