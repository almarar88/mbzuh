package com.alcode.qarar.data

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class AiModel(val id: String, val label: String, val hint: String) {
    companion object {
        val ALL = listOf(
            AiModel("claude-opus-5", "Claude Opus 5", "الأعمق تحليلًا — الافتراضي"),
            AiModel("claude-sonnet-5", "Claude Sonnet 5", "توازن جيد بين السرعة والعمق"),
            AiModel("claude-haiku-4-5", "Claude Haiku 4.5", "الأسرع والأرخص"),
        )
        fun byId(id: String) = ALL.firstOrNull { it.id == id } ?: ALL.first()
    }
}

data class AppSettings(
    val apiKey: String = "",
    val modelId: String = AiModel.ALL.first().id,
    val effort: String = "high",        // low | medium | high | xhigh
    val onboardingDone: Boolean = false,
) {
    val hasKey get() = apiKey.isNotBlank()
}

class SettingsStore(context: Context) {
    private val prefs = context.getSharedPreferences("qarar_settings", Context.MODE_PRIVATE)
    private val _settings = MutableStateFlow(read())
    val settings: StateFlow<AppSettings> = _settings.asStateFlow()

    private fun read() = AppSettings(
        apiKey = prefs.getString("apiKey", "") ?: "",
        modelId = prefs.getString("modelId", AiModel.ALL.first().id) ?: AiModel.ALL.first().id,
        effort = prefs.getString("effort", "high") ?: "high",
        onboardingDone = prefs.getBoolean("onboardingDone", false),
    )

    fun update(block: (AppSettings) -> AppSettings) {
        val next = block(_settings.value)
        prefs.edit()
            .putString("apiKey", next.apiKey.trim())
            .putString("modelId", next.modelId)
            .putString("effort", next.effort)
            .putBoolean("onboardingDone", next.onboardingDone)
            .apply()
        _settings.value = next.copy(apiKey = next.apiKey.trim())
    }
}
