package com.savageblock.app.data

import kotlin.random.Random

/**
 * The roast library. Lines use `{app}` and `{min}` placeholders.
 * Goal-specific lines hit the user's declared weak spot; level lines set the tone.
 */
object Roasts {

    private val low = listOf(
        "٣٠ دقيقة على {app}؟ وش اللي كان بيصير لو قفلته من زمان.. غير إنك تنجز؟",
        "الخوارزمية فرحانة فيك. أنت؟ لا أعتقد.",
        "كل مقطع «أخير» تشوفه له أخ وأخت وابن عم.",
        "الوقت اللي ضيعته اليوم ما يرجع، بس الباقي منه ينقذ.",
        "تصفّح بلا هدف = هدف بلا تصفّح. اختر.",
        "أنت ما تستخدم {app}.. {app} هو اللي يستخدمك.",
        "لو كان الإنجاز يجي بالسحب للأعلى، كان صرت أسطورة.",
        "{min} دقيقة راحت. ما راح تلقاها في المفضلة.",
        "خذ نفس. قفل التطبيق. ما بيطير المحتوى.",
    )

    private val medium = listOf(
        "مستقبلك يضيع وأنت تطالع مقاطع تافهة؟ ارجع اشتغل.",
        "أهلك يدرون إنك تضيع مستقبلك بهالطريقة؟",
        "إبهامك أنشط من عقلك اليوم. عيب.",
        "{min} دقيقة على {app}.. لو كنت تشتغل بنفس الحماس كان فيك خير.",
        "الناس اللي تتابعهم يشتغلون وأنت تتفرج. شفت الفرق؟",
        "قفل الجوال. العالم ما بينهار لو ما شفت المقطع الجاي.",
        "كل ما سحبت للأعلى، سحبت من مستقبلك شوي.",
        "أنت مو تستريح، أنت تهرب. والهروب ما يخلص شغل.",
        "«خمس دقايق بس» صارت {min} دقيقة. كذاب حتى على نفسك.",
    )

    private val savage = listOf(
        "يا متبطح، {min} دقيقة على {app} وبعدك تحسب نفسك مشغول؟",
        "تكسل عن الشغل بس أصابعك ما تكل من السحب. فاشل باحتراف.",
        "الخوارزمية تعرف إنك ضعيف. عشان كذا تطعمك تفاهات وأنت تبلع.",
        "أهلك ربوك عشان تصير شي، مو عشان تصير متفرج.",
        "الوقت اللي ضيعته اليوم كان يبني لك شي. أنت اخترت الفاضي.",
        "لا تقول «آخر مقطع» وأنت كذاب. اقفل.",
        "الناس تبني مستقبلها وأنت تبني تاريخ مشاهدة. عيب عليك.",
        "{app} ما يحتاجك. مستقبلك يحتاجك. بس واضح إنك ما تفرق.",
        "يا خامل. ما فيه كلمة ألطف. اقفل التطبيق وقم اشتغل.",
        "مبروك، {min} دقيقة من عمرك راحت لشركة ما تعرف اسمك.",
    )

    private val byGoal: Map<Goal, List<String>> = mapOf(
        Goal.STUDY to listOf(
            "الامتحان ما بيسأل عن المقاطع اللي شفتها. ارجع للمذكرة.",
            "زملاؤك يذاكرون وأنت تسحب للأعلى. الدرجات ما تجي بالسحب.",
            "كل دقيقة على {app} = صفحة ما قريتها. حاسب.",
            "تبي تنجح؟ الطريق ما يمر من {app}.",
            "المعدل ينزل وأنت تطلع مقاطع. معادلة واضحة.",
        ),
        Goal.WORK to listOf(
            "شغلك متكدس وأنت تتفرج؟ مديرك يدري؟",
            "المشروع ما بيخلص نفسه. وواضح إنك مو بتخلصه اليوم.",
            "{min} دقيقة على {app} في وقت شغل. هذا اسمه سرقة وقت.",
            "الترقية ما تجي لمن يشوف مقاطع. تجي لمن يشتغل.",
            "الإيميلات تتراكم وأنت تتراكم على الكنبة.",
        ),
        Goal.GYM to listOf(
            "الجسم اللي تحلم فيه ما ينبني وأنت متبطح على {app}.",
            "{min} دقيقة تفرّج = تمرين كامل ضاع. مبروك.",
            "الناس اللي تتابعهم بالجيم يتمرنون. أنت تتفرج عليهم. شفت الفرق؟",
            "قم. الحديد ما بيرفع نفسه.",
            "عضلة الإبهام هي الوحيدة اللي تمرنها اليوم.",
        ),
        Goal.BUSINESS to listOf(
            "مستقبلك التجاري بيضيع وأنت تتفرج مقاطع رقص؟",
            "منافسك يشتغل الحين. أنت على {app}. احسبها.",
            "المشروع يحتاج صاحب، مو متفرج.",
            "كل دقيقة على {app} هي دقيقة عميل راح لغيرك.",
            "تبي تبني إمبراطورية بإبهام؟ الإمبراطوريات تنبنى بالشغل.",
        ),
        Goal.GENERAL to emptyList(),
    )

    /** Short lines shown under the countdown while the user waits. */
    val countdownHints = listOf(
        "اقرأ. استوعب. لا تعيدها.",
        "الانتظار جزء من العقوبة.",
        "فكّر وش كان يمديك تسوي بدل هذا.",
        "الخوارزمية ما تنتظرك. مستقبلك كذلك.",
        "كل ثانية هنا أرخص من الساعة اللي ضيعتها.",
    )

    private var lastLine: String? = null

    fun pick(goal: Goal, level: AggressionLevel, appLabel: String, wastedMinutes: Int): String {
        val levelPool = when (level) {
            AggressionLevel.LOW -> low
            AggressionLevel.MEDIUM -> medium
            AggressionLevel.SAVAGE -> savage
        }
        val goalPool = byGoal[goal].orEmpty()
        // Hit the personal weak spot roughly half the time when one is declared.
        val pool = if (goalPool.isNotEmpty() && Random.nextBoolean()) goalPool else levelPool
        var line = pool.random()
        if (line == lastLine && pool.size > 1) line = pool.filter { it != lastLine }.random()
        lastLine = line
        return line.fill(appLabel, wastedMinutes)
    }

    private fun String.fill(appLabel: String, minutes: Int): String =
        replace("{app}", appLabel).replace("{min}", minutes.toArabicDigits())
}

/** Renders a number with Eastern Arabic digits so it sits naturally inside Arabic copy. */
fun Int.toArabicDigits(): String = toString().map { c ->
    if (c in '0'..'9') '٠' + (c - '0') else c
}.joinToString("")

fun Long.toArabicDigits(): String = toString().map { c ->
    if (c in '0'..'9') '٠' + (c - '0') else c
}.joinToString("")

/** Hall of Shame copy: translates wasted minutes into what the user could have done instead. */
object Shame {
    data class Equivalent(val label: String, val value: String)

    fun equivalents(minutes: Int): List<Equivalent> {
        if (minutes <= 0) return emptyList()
        val pages = minutes / 2
        val steps = minutes * 111 // ~10,000 steps in 90 minutes of walking
        val lessons = minutes / 15
        val workouts = minutes / 60
        val coursePercent = (minutes * 100 / 180).coerceAtMost(100)
        return buildList {
            if (pages > 0) add(Equivalent("صفحة كتاب", pages.toArabicDigits()))
            if (steps > 0) add(Equivalent("خطوة مشي", steps.toArabicDigits()))
            if (lessons > 0) add(Equivalent("درس مفيد", lessons.toArabicDigits()))
            if (workouts > 0) add(Equivalent("تمرين جيم", workouts.toArabicDigits()))
            if (coursePercent > 0) add(Equivalent("من كورس كامل", "${coursePercent.toArabicDigits()}٪"))
        }
    }

    fun remark(minutes: Int): String {
        val m = minutes.toArabicDigits()
        return when {
            minutes <= 0 -> "صفر دقائق ضائعة. مشكوك فيه، بس نصدقك مؤقتًا."
            minutes < 15 -> "$m دقيقة. بداية سيئة، بس ممكن تنقذ اليوم."
            minutes < 45 -> "$m دقيقة ضايعة. كان يمديك تقرأ ${(minutes / 2).toArabicDigits()} صفحة يا مثقف المقاطع."
            minutes < 120 -> "$m دقيقة اليوم.. كان يمديك تمشي ${(minutes * 111).toArabicDigits()} خطوة بدل ما تمشي بإبهامك."
            else -> {
                val h = minutes / 60
                val hoursText = when (h) {
                    1 -> "ساعة"
                    2 -> "ساعتين"
                    in 3..10 -> "${h.toArabicDigits()} ساعات"
                    else -> "${h.toArabicDigits()} ساعة"
                }
                "اليوم ضيعت $hoursText.. كان يمديك تخلص فيها كورس كامل أو تمشي ١٠ آلاف خطوة يا متبطح."
            }
        }
    }
}
