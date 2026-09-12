package com.alcode.qarar

import android.graphics.Bitmap
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.test.core.app.ApplicationProvider
import com.alcode.qarar.data.Analysis
import com.alcode.qarar.data.Decision
import com.alcode.qarar.data.OptionAnalysis
import com.alcode.qarar.data.Stakes
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** Captures PNG screenshots of the real UI (dark theme) into app/build/screens for visual QA. Skipped unless -Pscreens. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = QararApp::class, qualifiers = "w411dp-h891dp-night-xxhdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class ScreenshotTest {
    @get:Rule val rule = createAndroidComposeRule<MainActivity>()

    private val out = File(System.getProperty("user.dir"), "build/screens").apply { mkdirs() }
    private fun snap(name: String) {
        rule.waitForIdle()
        val view = rule.activity.window.decorView
        val bmp = Bitmap.createBitmap(view.width.coerceAtLeast(1), view.height.coerceAtLeast(1), Bitmap.Config.ARGB_8888)
        rule.runOnUiThread { view.draw(android.graphics.Canvas(bmp)) }
        File(out, "$name.png").outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 90, it) }
    }

    @Test
    fun capture() {
        if (System.getProperty("qarar.screens") != "true") return
        snap("01_onboarding")
        rule.onNodeWithText("ابدأ").performClick()
        snap("02_home_empty")

        val app = ApplicationProvider.getApplicationContext<QararApp>()
        app.settings.update { it.copy(apiKey = "sk-ant-demo") }
        val analysis = Analysis(
            oneLine = "المشكلة ليست الراتب، بل الخوف من خسارة شبكة الدعم.",
            realProblem = "أنت تقارن راتبين بينما القرار الحقيقي هو: هل تريد بناء حياة جديدة بعيدًا عن عائلتك في الثلاثين؟",
            hiddenAssumptions = listOf("أن هذا العرض لن يتكرر", "أن الراتب الأعلى يعني ادخارًا أعلى بعد تكاليف المعيشة", "أن العلاقات ستبقى كما هي عن بُعد"),
            missingOptions = listOf("التفاوض على سنة تجريبية مع عمل هجين", "طلب تأجيل البدء 3 أشهر"),
            options = listOf(
                OptionAnalysis("أقبل العرض", listOf("قفزة في المسار المهني", "دخل أعلى بـ 40٪"), listOf("بُعد عن العائلة", "تكلفة معيشة أعلى"), "متوسط", "بعد سنة قد تجد أن خبرتك تفتح أبوابًا لم تكن متاحة، أو أن الوحدة أثّرت على أدائك."),
                OptionAnalysis("أبقى في عملي", listOf("استقرار", "قرب من الأهل"), listOf("ركود مهني محتمل", "ندم لاحق"), "منخفض", "الاستقرار يتحوّل إلى جمود إن لم تخلق تحديًا بديلًا."),
            ),
            premortem = listOf("لم تبنِ شبكة اجتماعية جديدة خلال الأشهر الستة الأولى", "ارتفعت التكاليف فتبخّر فارق الراتب"),
            questionsToAnswer = listOf("هل يمكن العودة إلى وظيفتك الحالية لو فشل الأمر؟", "ما الحد الأدنى للراتب الذي يجعل الانتقال مجديًا بعد التكاليف؟"),
            reversibility = "قابل للتراجع", reversibilityNote = "الانتقال مكلف لكنه ليس نهائيًا؛ الباب مفتوح للعودة خلال سنة.",
            recommendedOption = "أقبل العرض", confidence = 68,
            recommendationWhy = "الخسارة الأكبر هنا هي فرصة نمو نادرة في سنك، والمخاطر الاجتماعية قابلة للإدارة بخطة واضحة.",
            model = "claude-opus-5", createdAt = System.currentTimeMillis(),
        )
        app.repository.upsert(Decision(
            title = "هل أقبل عرض العمل في دبي؟",
            context = "عرض براتب أعلى بـ 40٪ في شركة كبيرة، لكن يعني الانتقال بعيدًا عن العائلة والأصدقاء والبدء من الصفر اجتماعيًا.",
            options = listOf("أقبل العرض", "أبقى في عملي"), stakes = Stakes.HIGH,
            deadline = System.currentTimeMillis() + 14L * 86_400_000, analysis = analysis,
        ))
        app.repository.upsert(Decision(
            title = "هل أشتري سيارة الآن أم أنتظر؟", context = "سيارتي الحالية تحتاج صيانة متكررة، والأسعار مرتفعة هذا العام.",
            options = listOf("أشتري الآن", "أنتظر سنة"), stakes = Stakes.MEDIUM, deadline = null,
            chosenOption = "أنتظر سنة", decisionReason = "الصيانة أرخص من فرق السعر", expectedOutcome = "أوفر 15 ألفًا",
            decidedAt = System.currentTimeMillis() - 40L * 86_400_000, reviewAt = System.currentTimeMillis() - 5L * 86_400_000,
        ))
        snap("03_home")
        rule.onAllNodesWithText("هل أقبل عرض العمل في دبي؟").onFirst().performClick()
        snap("04_detail_top")
        rule.onNodeWithText("تشريح الخيارات").performScrollTo()
        snap("05_detail_options")
        rule.onNodeWithText("سجّل قرارك").performScrollTo()
        snap("06_detail_decide")
        rule.onNode(hasContentDescription("رجوع")).performClick()
        rule.onNode(hasContentDescription("الأنماط")).performClick()
        snap("07_insights")
        rule.onNode(hasContentDescription("رجوع")).performClick()
        rule.onNode(hasContentDescription("الإعدادات")).performClick()
        snap("08_settings")
        rule.onNode(hasContentDescription("رجوع")).performClick()
        rule.onNodeWithText("قرار جديد", useUnmergedTree = true).performClick()
        rule.onNodeWithText("ما القرار؟").performTextInput("هل أبدأ مشروعي الخاص؟")
        snap("09_new")
    }
}
