package com.alcode.qarar

import com.alcode.qarar.ai.Prompts
import com.alcode.qarar.data.Analysis
import com.alcode.qarar.data.Decision
import com.alcode.qarar.data.DecisionStatus
import com.alcode.qarar.data.OptionAnalysis
import com.alcode.qarar.data.ReviewAnalysis
import com.alcode.qarar.data.Stakes
import com.alcode.qarar.data.toAnalysis
import com.alcode.qarar.data.toDecision
import com.alcode.qarar.data.toJson
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ModelsJsonTest {

    private fun sample() = Decision(
        title = "هل أقبل عرض العمل؟",
        context = "عرض براتب أعلى لكن في مدينة أخرى بعيدًا عن العائلة.",
        options = listOf("أقبل", "أرفض", "أفاوض على العمل عن بعد"),
        stakes = Stakes.HIGH,
        deadline = 1_800_000_000_000L,
        analysis = Analysis(
            oneLine = "المشكلة ليست الراتب بل الخوف من الغربة",
            realProblem = "…", hiddenAssumptions = listOf("أن العرض لن يتكرر"),
            missingOptions = listOf("طلب تأجيل البدء"),
            options = listOf(OptionAnalysis("أقبل", listOf("دخل أعلى"), listOf("بُعد"), "متوسط", "…")),
            premortem = listOf("الوحدة"), questionsToAnswer = listOf("هل يمكن العمل عن بعد؟"),
            reversibility = "صعب التراجع", reversibilityNote = "…",
            recommendedOption = "أفاوض على العمل عن بعد", confidence = 62, recommendationWhy = "…",
            model = "claude-opus-5", createdAt = 1L,
        ),
        chosenOption = "أفاوض على العمل عن بعد", decisionReason = "…", expectedOutcome = "…",
        decidedAt = 2L, reviewAt = 3L,
        actualOutcome = "قبلوا", outcomeScore = 5, lessons = "فاوض دائمًا", reviewedAt = 4L,
        reviewAnalysis = ReviewAnalysis("قرار جيد", "…", listOf("تفاؤل"), "…", "…", 5L),
    )

    @Test
    fun `decision survives a JSON round trip`() {
        val d = sample()
        val back = JSONObject(d.toJson().toString()).toDecision()
        assertEquals(d, back)
        assertEquals(DecisionStatus.REVIEWED, back.status)
        assertEquals(true, back.followedRecommendation)
    }

    @Test
    fun `nullable fields stay null and status is derived`() {
        val d = Decision(title = "x", context = "y", options = listOf("a", "b"), stakes = Stakes.LOW, deadline = null)
        val back = JSONObject(d.toJson().toString()).toDecision()
        assertNull(back.deadline); assertNull(back.analysis); assertNull(back.decidedAt)
        assertEquals(DecisionStatus.OPEN, back.status)
        assertNull(back.followedRecommendation)
        val decided = back.copy(chosenOption = "a", decidedAt = 1L)
        assertEquals(DecisionStatus.DECIDED, JSONObject(decided.toJson().toString()).toDecision().status)
    }

    @Test
    fun `confidence is clamped and missing arrays tolerated when parsing model output`() {
        val partial = JSONObject("""{"oneLine":"a","realProblem":"b","confidence":140,"recommendedOption":"x"}""").toAnalysis()
        assertEquals(100, partial.confidence)
        assertTrue(partial.options.isEmpty())
        assertTrue(partial.hiddenAssumptions.isEmpty())
    }

    @Test
    fun `structured output schemas are strict objects with every property required`() {
        for (schema in listOf(Prompts.analysisSchema, Prompts.reviewSchema, Prompts.insightsSchema)) {
            assertEquals("object", schema.getString("type"))
            assertFalse(schema.getBoolean("additionalProperties"))
            val props = schema.getJSONObject("properties").keys().asSequence().toSet()
            val required = schema.getJSONArray("required").let { a -> (0 until a.length()).map { a.getString(it) } }.toSet()
            assertEquals(props, required)
        }
        val option = Prompts.analysisSchema.getJSONObject("properties").getJSONObject("options").getJSONObject("items")
        assertFalse(option.getBoolean("additionalProperties"))
    }

    @Test
    fun `prompt builders include every user-entered fact`() {
        val d = sample()
        val a = Prompts.analysisUser(d)
        assertTrue(a.contains(d.title)); assertTrue(a.contains(d.context)); d.options.forEach { assertTrue(a.contains(it)) }
        val r = Prompts.reviewUser(d)
        assertTrue(r.contains("قبلوا")); assertTrue(r.contains("5 من 5"))
        val i = Prompts.insightsUser(listOf(d))
        assertTrue(i.contains("1 قرارًا"))
    }
}
