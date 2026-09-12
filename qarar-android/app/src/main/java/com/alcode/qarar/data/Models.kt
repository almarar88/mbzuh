package com.alcode.qarar.data

import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

enum class Stakes(val label: String) {
    LOW("بسيطة"), MEDIUM("متوسطة"), HIGH("مصيرية")
}

enum class DecisionStatus(val label: String) {
    OPEN("مفتوح"), DECIDED("محسوم"), REVIEWED("مُراجَع")
}

data class OptionAnalysis(
    val name: String,
    val pros: List<String>,
    val cons: List<String>,
    val riskLevel: String,          // "منخفض" | "متوسط" | "مرتفع"
    val secondOrderEffects: String,
)

data class Analysis(
    val oneLine: String,
    val realProblem: String,
    val hiddenAssumptions: List<String>,
    val missingOptions: List<String>,
    val options: List<OptionAnalysis>,
    val premortem: List<String>,
    val questionsToAnswer: List<String>,
    val reversibility: String,      // "قابل للتراجع" | "صعب التراجع"
    val reversibilityNote: String,
    val recommendedOption: String,
    val confidence: Int,            // 0..100
    val recommendationWhy: String,
    val model: String,
    val createdAt: Long,
)

data class ReviewAnalysis(
    val verdict: String,            // حكم قصير: هل كان القرار جيدًا بمعزل عن النتيجة؟
    val processVsLuck: String,      // فصل جودة القرار عن جودة النتيجة
    val biases: List<String>,
    val whatWorked: String,
    val lesson: String,
    val createdAt: Long,
)

data class Decision(
    val id: String = UUID.randomUUID().toString(),
    val title: String,
    val context: String,
    val options: List<String>,
    val stakes: Stakes,
    val deadline: Long?,
    val createdAt: Long = System.currentTimeMillis(),
    val analysis: Analysis? = null,
    // القرار
    val chosenOption: String? = null,
    val decisionReason: String? = null,
    val expectedOutcome: String? = null,
    val decidedAt: Long? = null,
    val reviewAt: Long? = null,
    // المراجعة
    val actualOutcome: String? = null,
    val outcomeScore: Int? = null,  // 1..5
    val lessons: String? = null,
    val reviewedAt: Long? = null,
    val reviewAnalysis: ReviewAnalysis? = null,
) {
    val status: DecisionStatus
        get() = when {
            reviewedAt != null -> DecisionStatus.REVIEWED
            decidedAt != null -> DecisionStatus.DECIDED
            else -> DecisionStatus.OPEN
        }

    val followedRecommendation: Boolean?
        get() {
            val rec = analysis?.recommendedOption ?: return null
            val chosen = chosenOption ?: return null
            return rec.trim() == chosen.trim()
        }
}

data class Insights(
    val headline: String,
    val patterns: List<String>,
    val strengths: List<String>,
    val biases: List<String>,
    val advice: String,
    val basedOn: Int,
    val createdAt: Long,
)

// ---------- JSON (de)serialisation ----------

private fun JSONArray?.toStringList(): List<String> {
    if (this == null) return emptyList()
    return (0 until length()).mapNotNull { i -> optString(i).takeIf { it.isNotBlank() } }
}

private fun List<String>.toJsonArray() = JSONArray().also { arr -> forEach { arr.put(it) } }

private fun JSONObject.optLongOrNull(key: String): Long? = if (has(key) && !isNull(key)) optLong(key) else null
private fun JSONObject.optIntOrNull(key: String): Int? = if (has(key) && !isNull(key)) optInt(key) else null
private fun JSONObject.optStringOrNull(key: String): String? = if (has(key) && !isNull(key)) optString(key) else null

fun OptionAnalysis.toJson(): JSONObject = JSONObject()
    .put("name", name).put("pros", pros.toJsonArray()).put("cons", cons.toJsonArray())
    .put("riskLevel", riskLevel).put("secondOrderEffects", secondOrderEffects)

fun JSONObject.toOptionAnalysis() = OptionAnalysis(
    name = optString("name"),
    pros = optJSONArray("pros").toStringList(),
    cons = optJSONArray("cons").toStringList(),
    riskLevel = optString("riskLevel"),
    secondOrderEffects = optString("secondOrderEffects"),
)

fun Analysis.toJson(): JSONObject = JSONObject()
    .put("oneLine", oneLine).put("realProblem", realProblem)
    .put("hiddenAssumptions", hiddenAssumptions.toJsonArray())
    .put("missingOptions", missingOptions.toJsonArray())
    .put("options", JSONArray().also { a -> options.forEach { a.put(it.toJson()) } })
    .put("premortem", premortem.toJsonArray())
    .put("questionsToAnswer", questionsToAnswer.toJsonArray())
    .put("reversibility", reversibility).put("reversibilityNote", reversibilityNote)
    .put("recommendedOption", recommendedOption).put("confidence", confidence)
    .put("recommendationWhy", recommendationWhy).put("model", model).put("createdAt", createdAt)

fun JSONObject.toAnalysis(): Analysis = Analysis(
    oneLine = optString("oneLine"),
    realProblem = optString("realProblem"),
    hiddenAssumptions = optJSONArray("hiddenAssumptions").toStringList(),
    missingOptions = optJSONArray("missingOptions").toStringList(),
    options = optJSONArray("options")?.let { a -> (0 until a.length()).map { a.getJSONObject(it).toOptionAnalysis() } } ?: emptyList(),
    premortem = optJSONArray("premortem").toStringList(),
    questionsToAnswer = optJSONArray("questionsToAnswer").toStringList(),
    reversibility = optString("reversibility"),
    reversibilityNote = optString("reversibilityNote"),
    recommendedOption = optString("recommendedOption"),
    confidence = optInt("confidence").coerceIn(0, 100),
    recommendationWhy = optString("recommendationWhy"),
    model = optString("model"),
    createdAt = optLong("createdAt", System.currentTimeMillis()),
)

fun ReviewAnalysis.toJson(): JSONObject = JSONObject()
    .put("verdict", verdict).put("processVsLuck", processVsLuck)
    .put("biases", biases.toJsonArray()).put("whatWorked", whatWorked)
    .put("lesson", lesson).put("createdAt", createdAt)

fun JSONObject.toReviewAnalysis() = ReviewAnalysis(
    verdict = optString("verdict"),
    processVsLuck = optString("processVsLuck"),
    biases = optJSONArray("biases").toStringList(),
    whatWorked = optString("whatWorked"),
    lesson = optString("lesson"),
    createdAt = optLong("createdAt", System.currentTimeMillis()),
)

fun Decision.toJson(): JSONObject = JSONObject().apply {
    put("id", id); put("title", title); put("context", context)
    put("options", options.toJsonArray()); put("stakes", stakes.name)
    put("deadline", deadline ?: JSONObject.NULL); put("createdAt", createdAt)
    put("analysis", analysis?.toJson() ?: JSONObject.NULL)
    put("chosenOption", chosenOption ?: JSONObject.NULL)
    put("decisionReason", decisionReason ?: JSONObject.NULL)
    put("expectedOutcome", expectedOutcome ?: JSONObject.NULL)
    put("decidedAt", decidedAt ?: JSONObject.NULL)
    put("reviewAt", reviewAt ?: JSONObject.NULL)
    put("actualOutcome", actualOutcome ?: JSONObject.NULL)
    put("outcomeScore", outcomeScore ?: JSONObject.NULL)
    put("lessons", lessons ?: JSONObject.NULL)
    put("reviewedAt", reviewedAt ?: JSONObject.NULL)
    put("reviewAnalysis", reviewAnalysis?.toJson() ?: JSONObject.NULL)
}

fun JSONObject.toDecision(): Decision = Decision(
    id = optString("id", UUID.randomUUID().toString()),
    title = optString("title"),
    context = optString("context"),
    options = optJSONArray("options").toStringList(),
    stakes = runCatching { Stakes.valueOf(optString("stakes")) }.getOrDefault(Stakes.MEDIUM),
    deadline = optLongOrNull("deadline"),
    createdAt = optLong("createdAt", System.currentTimeMillis()),
    analysis = optJSONObject("analysis")?.toAnalysis(),
    chosenOption = optStringOrNull("chosenOption"),
    decisionReason = optStringOrNull("decisionReason"),
    expectedOutcome = optStringOrNull("expectedOutcome"),
    decidedAt = optLongOrNull("decidedAt"),
    reviewAt = optLongOrNull("reviewAt"),
    actualOutcome = optStringOrNull("actualOutcome"),
    outcomeScore = optIntOrNull("outcomeScore"),
    lessons = optStringOrNull("lessons"),
    reviewedAt = optLongOrNull("reviewedAt"),
    reviewAnalysis = optJSONObject("reviewAnalysis")?.toReviewAnalysis(),
)

fun Insights.toJson(): JSONObject = JSONObject()
    .put("headline", headline).put("patterns", patterns.toJsonArray())
    .put("strengths", strengths.toJsonArray()).put("biases", biases.toJsonArray())
    .put("advice", advice).put("basedOn", basedOn).put("createdAt", createdAt)

fun JSONObject.toInsights() = Insights(
    headline = optString("headline"),
    patterns = optJSONArray("patterns").toStringList(),
    strengths = optJSONArray("strengths").toStringList(),
    biases = optJSONArray("biases").toStringList(),
    advice = optString("advice"),
    basedOn = optInt("basedOn"),
    createdAt = optLong("createdAt", System.currentTimeMillis()),
)
