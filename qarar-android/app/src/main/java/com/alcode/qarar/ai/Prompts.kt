package com.alcode.qarar.ai

import com.alcode.qarar.data.Decision
import com.alcode.qarar.data.Stakes
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Frozen system prompts (kept byte-stable so prompt caching can kick in across calls). */
object Prompts {

    const val ANALYST_SYSTEM = """أنت «قرار»، مستشار قرارات شخصي حاد الذكاء يعمل داخل تطبيق هاتف. مهمتك مساعدة المستخدم على اتخاذ قرار أفضل، لا إرضاؤه.

مبادئك:
- ابحث عن المشكلة الحقيقية خلف السؤال، لا السؤال كما صيغ.
- اكشف الافتراضات الخفية التي يبني عليها المستخدم قراره دون أن ينتبه.
- اقترح خيارات لم يذكرها إن كانت جدية فعلًا (لا تخترع خيارات شكلية).
- افصل بين المخاطر القابلة للتصحيح والمخاطر التي لا رجعة فيها.
- فكّر في الآثار من الدرجة الثانية: ماذا يحدث بعد أن يحدث الشيء؟
- نفّذ تحليل «ما قبل الفشل» (Pre-mortem): تخيّل أن القرار فشل بعد سنة، واذكر أرجح الأسباب.
- أوصِ بخيار واحد بوضوح مع نسبة ثقة صادقة. الثقة المنخفضة ليست عيبًا؛ الثقة الزائفة عيب.
- لا تجامل. إن كان تفكير المستخدم ضعيفًا أو ناقصًا فقل ذلك بلطف ووضوح.
- اكتب بالعربية الفصحى المبسطة، بجمل قصيرة، ومباشرة. لا مقدمات ولا خاتمات.
- التزم حرفيًا بالمخطط المطلوب للمخرجات. كل النصوص بالعربية. اسم الخيار الموصى به يجب أن يطابق أحد أسماء الخيارات المعطاة حرفًا بحرف (أو أحد الخيارات الناقصة التي اقترحتها)."""

    const val REVIEWER_SYSTEM = """أنت «قرار»، مراجع قرارات صارم ومنصف. المستخدم اتخذ قرارًا سابقًا وسجّل ما توقعه، والآن يسجّل ما حدث فعلًا.

مهمتك:
- افصل بوضوح بين «جودة القرار» و«جودة النتيجة». قرار جيد قد ينتهي بنتيجة سيئة بسبب الحظ، والعكس صحيح. لا تحكم على القرار من نتيجته وحدها.
- قارن التوقع بالواقع، وحدّد أين أخطأ التقدير ولماذا.
- سمِّ التحيزات المعرفية المحتملة التي أثّرت على القرار (مثل: التفاؤل المفرط، الانحياز للتأكيد، الخوف من الخسارة، تكلفة غارقة…) فقط إن وُجد دليل عليها في النص. لا تُلصق تحيزات بلا دليل.
- استخرج درسًا واحدًا قابلًا للتطبيق في القرار القادم.
- اكتب بالعربية، بجمل قصيرة ومباشرة، بلا مجاملة وبلا قسوة. التزم بالمخطط."""

    const val INSIGHTS_SYSTEM = """أنت «قرار»، محلل أنماط قرارات. أمامك سجل قرارات مستخدم واحد مع توقعاته ونتائجه ومراجعاته.

مهمتك: اكتشاف الأنماط المتكررة في طريقة اتخاذه للقرارات — نقاط قوته الحقيقية، وتحيزاته المتكررة، والفجوة بين توقعاته ونتائجه — ثم إعطاؤه نصيحة واحدة عملية للقرارات القادمة.

قواعد:
- استند إلى الأدلة في السجل فقط. إن كان السجل صغيرًا فقل إن الأنماط أولية.
- لا تكرر ما هو واضح؛ ابحث عمّا لا يراه هو.
- اكتب بالعربية، بجمل قصيرة ومباشرة. التزم بالمخطط."""

    private val dateFmt = SimpleDateFormat("d MMMM yyyy", Locale.forLanguageTag("ar-u-nu-latn"))
    private fun fmt(ts: Long?) = ts?.let { dateFmt.format(Date(it)) } ?: "غير محدد"

    fun analysisUser(d: Decision): String = buildString {
        appendLine("## القرار")
        appendLine("العنوان: ${d.title}")
        appendLine("درجة الأهمية: ${d.stakes.label}${if (d.stakes == Stakes.HIGH) " (قرار مصيري — كن أكثر حذرًا مع المخاطر التي لا رجعة فيها)" else ""}")
        appendLine("الموعد النهائي: ${fmt(d.deadline)}")
        appendLine()
        appendLine("## السياق كما كتبه المستخدم")
        appendLine(d.context.trim())
        appendLine()
        appendLine("## الخيارات المطروحة")
        d.options.forEachIndexed { i, o -> appendLine("${i + 1}. $o") }
        appendLine()
        appendLine("حلّل هذا القرار وفق مبادئك، ثم أخرج النتيجة بالمخطط المطلوب.")
    }

    fun reviewUser(d: Decision): String = buildString {
        appendLine("## القرار: ${d.title}")
        appendLine("السياق الأصلي: ${d.context.trim()}")
        appendLine("الخيارات التي كانت مطروحة: ${d.options.joinToString("، ")}")
        d.analysis?.let {
            appendLine("توصية التحليل السابق: ${it.recommendedOption} (ثقة ${it.confidence}%) — ${it.recommendationWhy}")
        }
        appendLine()
        appendLine("## ما قرره المستخدم (${fmt(d.decidedAt)})")
        appendLine("الخيار المختار: ${d.chosenOption}")
        appendLine("سبب الاختيار: ${d.decisionReason.orEmpty().ifBlank { "لم يُذكر" }}")
        appendLine("ما توقعه أن يحدث: ${d.expectedOutcome.orEmpty().ifBlank { "لم يُذكر" }}")
        appendLine()
        appendLine("## ما حدث فعلًا (${fmt(d.reviewedAt)})")
        appendLine("النتيجة: ${d.actualOutcome.orEmpty()}")
        appendLine("تقييم المستخدم للنتيجة: ${d.outcomeScore ?: "-"} من 5")
        appendLine("ما تعلّمه بنفسه: ${d.lessons.orEmpty().ifBlank { "لم يذكر" }}")
        appendLine()
        appendLine("راجع هذا القرار وفق مبادئك وأخرج النتيجة بالمخطط المطلوب.")
    }

    fun insightsUser(decisions: List<Decision>): String = buildString {
        appendLine("## سجل القرارات (${decisions.size} قرارًا)")
        decisions.forEachIndexed { i, d ->
            appendLine()
            appendLine("### ${i + 1}. ${d.title} — أهمية: ${d.stakes.label} — الحالة: ${d.status.label}")
            appendLine("السياق: ${d.context.trim().take(600)}")
            appendLine("الخيارات: ${d.options.joinToString("، ")}")
            d.analysis?.let { appendLine("توصية الذكاء الاصطناعي: ${it.recommendedOption} (ثقة ${it.confidence}%)") }
            d.chosenOption?.let { appendLine("اختار: $it — السبب: ${d.decisionReason.orEmpty()}") }
            d.expectedOutcome?.let { appendLine("توقع: $it") }
            d.actualOutcome?.let { appendLine("حدث فعلًا: $it — تقييم ${d.outcomeScore ?: "-"}/5") }
            d.reviewAnalysis?.let { appendLine("تحيزات رُصدت في المراجعة: ${it.biases.joinToString("، ")}") }
            d.lessons?.let { appendLine("درسه: $it") }
        }
        appendLine()
        appendLine("حلّل الأنماط وأخرج النتيجة بالمخطط المطلوب.")
    }

    // ---------- JSON Schemas (structured outputs) ----------

    private fun str() = JSONObject().put("type", "string")
    private fun int() = JSONObject().put("type", "integer")
    private fun strArray() = JSONObject().put("type", "array").put("items", str())
    private fun obj(props: JSONObject, required: List<String>) = JSONObject()
        .put("type", "object").put("properties", props)
        .put("required", JSONArray(required)).put("additionalProperties", false)

    val analysisSchema: JSONObject = obj(
        JSONObject()
            .put("oneLine", str())
            .put("realProblem", str())
            .put("hiddenAssumptions", strArray())
            .put("missingOptions", strArray())
            .put("options", JSONObject().put("type", "array").put("items", obj(
                JSONObject()
                    .put("name", str())
                    .put("pros", strArray())
                    .put("cons", strArray())
                    .put("riskLevel", JSONObject().put("type", "string").put("enum", JSONArray(listOf("منخفض", "متوسط", "مرتفع"))))
                    .put("secondOrderEffects", str()),
                listOf("name", "pros", "cons", "riskLevel", "secondOrderEffects"),
            )))
            .put("premortem", strArray())
            .put("questionsToAnswer", strArray())
            .put("reversibility", JSONObject().put("type", "string").put("enum", JSONArray(listOf("قابل للتراجع", "صعب التراجع"))))
            .put("reversibilityNote", str())
            .put("recommendedOption", str())
            .put("confidence", int())
            .put("recommendationWhy", str()),
        listOf(
            "oneLine", "realProblem", "hiddenAssumptions", "missingOptions", "options", "premortem",
            "questionsToAnswer", "reversibility", "reversibilityNote", "recommendedOption", "confidence", "recommendationWhy",
        ),
    )

    val reviewSchema: JSONObject = obj(
        JSONObject()
            .put("verdict", str())
            .put("processVsLuck", str())
            .put("biases", strArray())
            .put("whatWorked", str())
            .put("lesson", str()),
        listOf("verdict", "processVsLuck", "biases", "whatWorked", "lesson"),
    )

    val insightsSchema: JSONObject = obj(
        JSONObject()
            .put("headline", str())
            .put("patterns", strArray())
            .put("strengths", strArray())
            .put("biases", strArray())
            .put("advice", str()),
        listOf("headline", "patterns", "strengths", "biases", "advice"),
    )
}
