package com.alcode.qarar

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.performScrollTo
import androidx.test.core.app.ApplicationProvider
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * Renders the real activity (theme, fonts, navigation, view-model, persistence) on the JVM
 * and drives the primary flow: onboarding -> home -> new decision -> detail.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = QararApp::class, qualifiers = "w411dp-h891dp-xxhdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class UiRenderTest {

    @get:Rule
    val rule = createAndroidComposeRule<MainActivity>()

    @Test
    fun onboarding_then_home_renders() {
        rule.onNodeWithText("ابدأ").assertIsDisplayed().performClick()
        // Robolectric reports LazyColumn children as "not displayed" even when their window
        // bounds are inside the root, so lazy items are checked for existence + placement.
        rule.onNodeWithText("لا قرارات بعد").assertExists().assertIsPlaced()
        rule.onNodeWithText("قرار جديد", useUnmergedTree = true).assertExists()
        rule.onNodeWithText("فعّل الذكاء الاصطناعي").assertExists().assertIsPlaced()
        val app = ApplicationProvider.getApplicationContext<QararApp>()
        assert(app.settings.settings.value.onboardingDone)
    }

    @Test
    fun create_decision_and_open_detail() {
        rule.onNodeWithText("ابدأ").performClick()
        rule.onNodeWithText("قرار جديد", useUnmergedTree = true).performClick()
        rule.onNodeWithText("ما القرار؟").performTextInput("هل أنتقل إلى دبي؟")
        rule.onNodeWithText("السياق").performTextInput("عرض عمل براتب أعلى لكن بعيد عن الأهل والأصدقاء.")
        rule.onNodeWithText("الخيار 1").performTextInput("أنتقل")
        rule.onNodeWithText("الخيار 2").performTextInput("أبقى")
        rule.onNodeWithText("مصيرية").performClick()
        rule.onNodeWithText("حفظ القرار").performScrollTo().performClick()

        // Detail screen for the saved decision
        rule.onAllNodesWithText("هل أنتقل إلى دبي؟").onFirst().assertExists()
        rule.onNodeWithText("التحليل الذكي").assertExists().assertIsPlaced()
        rule.onNodeWithText("أضف مفتاح API أولًا").assertExists()
        rule.onNodeWithText("سجّل قرارك").performScrollTo().assertExists()

        val app = ApplicationProvider.getApplicationContext<QararApp>()
        val saved = app.repository.decisions.value.single()
        assert(saved.title == "هل أنتقل إلى دبي؟")
        assert(saved.options == listOf("أنتقل", "أبقى"))
    }

    @Test
    fun settings_screen_saves_key_and_model() {
        rule.onNodeWithText("ابدأ").performClick()
        rule.onNodeWithContentDescriptionCompat("الإعدادات").performClick()
        rule.onNodeWithText("sk-ant-…").performTextInput("sk-ant-test-123")
        rule.onNodeWithText("حفظ").performClick()
        rule.onNodeWithText("Claude Sonnet 5").performClick()
        val app = ApplicationProvider.getApplicationContext<QararApp>()
        assert(app.settings.settings.value.apiKey == "sk-ant-test-123")
        assert(app.settings.settings.value.modelId == "claude-sonnet-5")
    }
}

private fun androidx.compose.ui.test.junit4.ComposeTestRule.onNodeWithContentDescriptionCompat(desc: String) =
    onNode(androidx.compose.ui.test.hasContentDescription(desc))

private fun androidx.compose.ui.test.SemanticsNodeInteraction.assertIsPlaced(): androidx.compose.ui.test.SemanticsNodeInteraction {
    val node = fetchSemanticsNode()
    check(node.layoutInfo.isPlaced && node.boundsInWindow.width > 0 && node.boundsInWindow.height > 0) { "node not placed: $node" }
    return this
}
