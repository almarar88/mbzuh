package com.alcode.qarar.ai

import com.alcode.qarar.data.Analysis
import com.alcode.qarar.data.Decision
import com.alcode.qarar.data.Insights
import com.alcode.qarar.data.ReviewAnalysis
import com.alcode.qarar.data.toAnalysis
import com.alcode.qarar.data.toInsights
import com.alcode.qarar.data.toReviewAnalysis
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

class AiException(message: String, val retryable: Boolean = false) : Exception(message)

/**
 * Thin client over the Claude Messages API (raw HTTP, no SDK: keeps the APK small and
 * avoids desktop-JVM dependencies on Android). Uses structured outputs so the UI never
 * has to parse free text.
 */
class ClaudeClient(
    private val apiKey: String,
    private val model: String,
    private val effort: String,
) {
    private val http = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.MINUTES)   // Opus with adaptive thinking can take a while
        .writeTimeout(60, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    private val json = "application/json; charset=utf-8".toMediaType()

    private val supportsEffort get() = !model.startsWith("claude-haiku")
    private val supportsFallbacks get() = model.startsWith("claude-opus-5") || model.startsWith("claude-fable")

    suspend fun analyze(decision: Decision): Analysis = withContext(Dispatchers.IO) {
        val out = complete(Prompts.ANALYST_SYSTEM, Prompts.analysisUser(decision), Prompts.analysisSchema)
        out.toAnalysis().copy(model = model, createdAt = System.currentTimeMillis())
    }

    suspend fun review(decision: Decision): ReviewAnalysis = withContext(Dispatchers.IO) {
        val out = complete(Prompts.REVIEWER_SYSTEM, Prompts.reviewUser(decision), Prompts.reviewSchema)
        out.toReviewAnalysis().copy(createdAt = System.currentTimeMillis())
    }

    suspend fun insights(decisions: List<Decision>): Insights = withContext(Dispatchers.IO) {
        val out = complete(Prompts.INSIGHTS_SYSTEM, Prompts.insightsUser(decisions), Prompts.insightsSchema)
        out.toInsights().copy(basedOn = decisions.size, createdAt = System.currentTimeMillis())
    }

    /** Cheap connectivity/key check: GET /v1/models/{model} costs nothing. */
    suspend fun ping(): String = withContext(Dispatchers.IO) {
        val req = Request.Builder()
            .url("https://api.anthropic.com/v1/models/$model")
            .header("x-api-key", apiKey)
            .header("anthropic-version", "2023-06-01")
            .get().build()
        try {
            http.newCall(req).execute().use { res ->
                val body = res.body?.string().orEmpty()
                if (!res.isSuccessful) throw mapHttpError(res.code, body)
                JSONObject(body).optString("display_name", model)
            }
        } catch (e: IOException) {
            throw AiException("تعذّر الاتصال بالخادم. تحقق من الإنترنت.", retryable = true)
        }
    }

    private fun complete(system: String, user: String, schema: JSONObject): JSONObject {
        val body = JSONObject().apply {
            put("model", model)
            put("max_tokens", 8000)
            put("system", JSONArray().put(
                JSONObject().put("type", "text").put("text", system)
                    .put("cache_control", JSONObject().put("type", "ephemeral"))
            ))
            put("messages", JSONArray().put(JSONObject().put("role", "user").put("content", user)))
            val outputConfig = JSONObject().put("format", JSONObject().put("type", "json_schema").put("schema", schema))
            if (supportsEffort) outputConfig.put("effort", effort)
            put("output_config", outputConfig)
            if (supportsFallbacks) put("fallbacks", "default")
        }

        val reqBuilder = Request.Builder()
            .url("https://api.anthropic.com/v1/messages")
            .header("x-api-key", apiKey)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .post(body.toString().toRequestBody(json))
        if (supportsFallbacks) reqBuilder.header("anthropic-beta", "server-side-fallback-2026-07-01")

        val raw = try {
            http.newCall(reqBuilder.build()).execute().use { res ->
                val text = res.body?.string().orEmpty()
                if (!res.isSuccessful) throw mapHttpError(res.code, text)
                text
            }
        } catch (e: IOException) {
            throw AiException("انقطع الاتصال أثناء التحليل. حاول مرة أخرى.", retryable = true)
        }

        val msg = JSONObject(raw)
        when (msg.optString("stop_reason")) {
            "refusal" -> {
                val why = msg.optJSONObject("stop_details")?.optString("explanation").orEmpty()
                throw AiException("رفض النموذج معالجة هذا الطلب." + if (why.isNotBlank()) "\n$why" else "")
            }
            "max_tokens" -> throw AiException("الإجابة أطول من الحد المسموح. اختصر السياق وحاول مجددًا.")
        }
        val content = msg.optJSONArray("content") ?: throw AiException("استجابة غير متوقعة من الخادم.")
        val text = (0 until content.length())
            .map { content.getJSONObject(it) }
            .firstOrNull { it.optString("type") == "text" }
            ?.optString("text")
            ?: throw AiException("لم يُرجع النموذج نصًا.")
        return try {
            JSONObject(text)
        } catch (e: Exception) {
            throw AiException("تعذّر قراءة مخرجات النموذج. حاول مرة أخرى.", retryable = true)
        }
    }

    private fun mapHttpError(code: Int, body: String): AiException {
        val apiMsg = runCatching { JSONObject(body).optJSONObject("error")?.optString("message") }.getOrNull().orEmpty()
        return when (code) {
            401 -> AiException("مفتاح API غير صالح. راجع الإعدادات.")
            403 -> AiException("المفتاح لا يملك صلاحية لهذا النموذج.")
            404 -> AiException("النموذج «$model» غير متاح لحسابك. جرّب نموذجًا آخر من الإعدادات.")
            400 -> AiException("طلب مرفوض من الخادم: ${apiMsg.ifBlank { "بيانات غير صالحة" }}")
            413 -> AiException("السياق طويل جدًا. اختصره وحاول مجددًا.")
            429 -> AiException("تجاوزت حد الاستخدام مؤقتًا. انتظر دقيقة ثم أعد المحاولة.", retryable = true)
            529 -> AiException("الخادم مزدحم حاليًا. أعد المحاولة بعد قليل.", retryable = true)
            in 500..599 -> AiException("خطأ مؤقت في الخادم ($code). أعد المحاولة.", retryable = true)
            else -> AiException("خطأ غير متوقع ($code): ${apiMsg.ifBlank { "بدون تفاصيل" }}")
        }
    }
}
