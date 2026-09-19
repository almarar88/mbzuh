# سياسة الخصوصية — SavageBlock (كافي تضييع)

**آخر تحديث:** 19 سبتمبر 2026 · **المطوّر:** Alcode

## الخلاصة

SavageBlock يعمل بالكامل على جهازك. لا يملك خادمًا، ولا حسابات، ولا يجمع أي بيانات
شخصية، ولا يرسل أي معلومات إلى المطوّر أو إلى أي طرف ثالث.

## ما الذي يصل إليه التطبيق ولماذا

| الصلاحية | الاستخدام | أين تُخزَّن البيانات |
|---|---|---|
| **الوصول لبيانات الاستخدام** (`PACKAGE_USAGE_STATS`) | معرفة التطبيق الظاهر على الشاشة حاليًا ومدة استخدامه، حتى يُحتسب الوقت على التطبيقات التي اخترت مراقبتها. | على جهازك فقط (تخزين محلي مشفَّر بواسطة النظام). |
| **الظهور فوق التطبيقات** (`SYSTEM_ALERT_WINDOW`) | عرض شاشة الحظر فوق التطبيق المحظور عند تجاوز الحد. | لا تُخزَّن بيانات. |
| **الإشعارات** (`POST_NOTIFICATIONS`) | إشعار الخدمة الدائم وتنبيه «اقتربت من الحد». | لا تُخزَّن بيانات. |
| **الخدمة الأمامية** (`FOREGROUND_SERVICE_SPECIAL_USE`) | إبقاء المراقبة شغّالة في الخلفية حسب اختيارك. | لا تُخزَّن بيانات. |
| **الاهتزاز** (`VIBRATE`) | العقوبة الحسّية في المستويات المتوسطة والعنيفة. | لا تُخزَّن بيانات. |
| **الإقلاع** (`RECEIVE_BOOT_COMPLETED`) | إعادة تشغيل المراقبة بعد إعادة تشغيل الجهاز إذا كانت مفعّلة. | لا تُخزَّن بيانات. |
| **استثناء البطارية** (`REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`) | اختياري: منع النظام من قتل خدمة المراقبة. | لا تُخزَّن بيانات. |
| **قائمة التطبيقات المثبَّتة** (`QUERY` للمشغِّل) | عرض التطبيقات القابلة للتشغيل لتختار ما تريد مراقبته. | تُقرأ عند الطلب ولا تُخزَّن. |

## البيانات المخزَّنة محليًا

- إعداداتك: اسمك (اختياري)، هدفك، مستوى الوقاحة، التطبيقات المحظورة وحدودها، أوقات التركيز.
- سجل الاستخدام اليومي للتطبيقات المحظورة (دقائق وعدد الضربات) لآخر 60 يومًا لعرض التقارير والسلسلة.

كل هذا يُحفظ في التخزين الخاص بالتطبيق على جهازك. يمكنك مسحه من داخل التطبيق
(الإعدادات ← امسح السجل) أو بحذف التطبيق، فتُحذف كل البيانات نهائيًا.

## ما لا نفعله

- لا نجمع ولا نرسل أي بيانات شخصية أو بيانات استخدام إلى أي جهة.
- لا إعلانات، لا تتبّع، لا تحليلات، لا مكتبات طرف ثالث تجمع بيانات.
- لا نصل إلى محتوى التطبيقات الأخرى؛ نعرف فقط اسم الحزمة الظاهرة على الشاشة ومدة ظهورها.

## النسخ الاحتياطي

قد يشمل النسخ الاحتياطي التلقائي لنظام أندرويد (Google Backup) إعدادات التطبيق
وسجله إذا كان النسخ الاحتياطي مفعّلًا على جهازك. هذا يخضع لسياسة خصوصية Google
ويمكنك تعطيله من إعدادات الجهاز.

## الأطفال

التطبيق غير موجّه للأطفال دون 13 عامًا، وقد يحتوي على لغة ساخرة قاسية اخترتها بنفسك
عبر «مستوى الوقاحة».

## التغييرات

أي تعديل على هذه السياسة يُنشر في هذه الصفحة مع تاريخ التحديث.

## التواصل

للاستفسارات: افتح Issue في مستودع المشروع على GitHub
(`github.com/almarar88/mbzuh`).

---

# Privacy Policy — SavageBlock

**Last updated:** September 19, 2026 · **Developer:** Alcode

SavageBlock runs entirely on your device. It has no server, no accounts, collects no
personal data and transmits nothing to the developer or any third party.

**Permissions and why:** Usage access (to know which app is in the foreground and for
how long, so time on the apps *you* chose is counted); Draw over other apps (to show the
blocking screen); Notifications (persistent service notice and the "approaching your limit"
heads-up); Foreground service / special use (to keep monitoring alive while you keep it on);
Vibrate; Boot completed (to resume monitoring after a reboot if it was on); Ignore battery
optimizations (optional); querying launchable apps (to let you pick apps to monitor).

**Data stored locally only:** your optional name, goal, aggression level, monitored apps and
limits, focus schedule, and a 60-day daily ledger of minutes and strikes for reports and
streaks. Clear it in Settings → Clear history, or uninstall the app to delete everything.

**We do not** collect, sell or transmit any data; there are no ads, analytics or trackers.
Android's automatic backup may include the app's settings if enabled on your device.

The app is not directed at children under 13 and contains harsh sarcastic language that you
opt into via the aggression level.
