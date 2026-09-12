package com.alcode.qarar.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.alcode.qarar.QararApp
import com.alcode.qarar.ai.AiException
import com.alcode.qarar.ai.ClaudeClient
import com.alcode.qarar.data.AppSettings
import com.alcode.qarar.data.Decision
import com.alcode.qarar.data.DecisionRepository
import com.alcode.qarar.data.DecisionStatus
import com.alcode.qarar.data.Insights
import com.alcode.qarar.data.SettingsStore
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Which long-running AI job is in flight, keyed by decision id ("__insights__" for the global one). */
enum class Job { ANALYZE, REVIEW, INSIGHTS, PING }

class AppViewModel(
    private val repo: DecisionRepository,
    private val settingsStore: SettingsStore,
) : ViewModel() {

    val decisions: StateFlow<List<Decision>> = repo.decisions
    val insights: StateFlow<Insights?> = repo.insights
    val settings: StateFlow<AppSettings> = settingsStore.settings

    private val _busy = MutableStateFlow<Map<String, Job>>(emptyMap())
    val busy: StateFlow<Map<String, Job>> = _busy.asStateFlow()

    private val _messages = MutableSharedFlow<String>(extraBufferCapacity = 8)
    val messages: SharedFlow<String> = _messages.asSharedFlow()

    private val _pingResult = MutableStateFlow<String?>(null)
    val pingResult: StateFlow<String?> = _pingResult.asStateFlow()

    fun decision(id: String) = repo.get(id)

    fun save(decision: Decision) = repo.upsert(decision)

    fun delete(id: String) {
        repo.delete(id)
        _messages.tryEmit("حُذف القرار")
    }

    fun updateSettings(block: (AppSettings) -> AppSettings) {
        settingsStore.update(block)
        _pingResult.value = null
    }

    fun completeOnboarding() = settingsStore.update { it.copy(onboardingDone = true) }

    private fun client(): ClaudeClient? {
        val s = settings.value
        if (!s.hasKey) {
            _messages.tryEmit("أضف مفتاح API من الإعدادات أولًا لتفعيل الذكاء الاصطناعي")
            return null
        }
        return ClaudeClient(s.apiKey, s.modelId, s.effort)
    }

    private fun setBusy(key: String, job: Job?) = _busy.update { m ->
        if (job == null) m - key else m + (key to job)
    }

    fun analyze(id: String) {
        val d = repo.get(id) ?: return
        val c = client() ?: return
        if (_busy.value.containsKey(id)) return
        setBusy(id, Job.ANALYZE)
        viewModelScope.launch {
            try {
                val analysis = c.analyze(d)
                repo.get(id)?.let { repo.upsert(it.copy(analysis = analysis)) }
                _messages.emit("اكتمل التحليل")
            } catch (e: AiException) {
                _messages.emit(e.message ?: "حدث خطأ")
            } catch (e: Exception) {
                _messages.emit("خطأ غير متوقع: ${e.message ?: e::class.simpleName}")
            } finally {
                setBusy(id, null)
            }
        }
    }

    fun review(id: String) {
        val d = repo.get(id) ?: return
        if (d.reviewedAt == null) return
        val c = client() ?: return
        if (_busy.value.containsKey(id)) return
        setBusy(id, Job.REVIEW)
        viewModelScope.launch {
            try {
                val r = c.review(d)
                repo.get(id)?.let { repo.upsert(it.copy(reviewAnalysis = r)) }
                _messages.emit("اكتملت مراجعة القرار")
            } catch (e: AiException) {
                _messages.emit(e.message ?: "حدث خطأ")
            } catch (e: Exception) {
                _messages.emit("خطأ غير متوقع: ${e.message ?: e::class.simpleName}")
            } finally {
                setBusy(id, null)
            }
        }
    }

    fun generateInsights() {
        val eligible = decisions.value.filter { it.status != DecisionStatus.OPEN }
        if (eligible.size < 2) {
            _messages.tryEmit("تحتاج إلى قرارين محسومين على الأقل لاستخراج الأنماط")
            return
        }
        val c = client() ?: return
        if (_busy.value.containsKey(INSIGHTS_KEY)) return
        setBusy(INSIGHTS_KEY, Job.INSIGHTS)
        viewModelScope.launch {
            try {
                repo.saveInsights(c.insights(eligible))
                _messages.emit("تم استخراج الأنماط")
            } catch (e: AiException) {
                _messages.emit(e.message ?: "حدث خطأ")
            } catch (e: Exception) {
                _messages.emit("خطأ غير متوقع: ${e.message ?: e::class.simpleName}")
            } finally {
                setBusy(INSIGHTS_KEY, null)
            }
        }
    }

    fun ping() {
        val c = client() ?: return
        if (_busy.value.containsKey(PING_KEY)) return
        setBusy(PING_KEY, Job.PING)
        _pingResult.value = null
        viewModelScope.launch {
            try {
                val name = c.ping()
                _pingResult.value = "✓ الاتصال ناجح — $name"
            } catch (e: AiException) {
                _pingResult.value = "✕ ${e.message}"
            } catch (e: Exception) {
                _pingResult.value = "✕ ${e.message ?: "خطأ"}"
            } finally {
                setBusy(PING_KEY, null)
            }
        }
    }

    companion object {
        const val INSIGHTS_KEY = "__insights__"
        const val PING_KEY = "__ping__"

        fun factory(app: QararApp) = object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T =
                AppViewModel(app.repository, app.settings) as T
        }
    }
}
