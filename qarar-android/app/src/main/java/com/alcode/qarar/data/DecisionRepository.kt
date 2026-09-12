package com.alcode.qarar.data

import android.content.Context
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * Local-only persistence: a single JSON document in the app's private storage.
 * Nothing leaves the device except the text sent to the AI when the user asks for it.
 */
class DecisionRepository(context: Context) {
    private val file = File(context.filesDir, "qarar_decisions.json")
    private val insightsFile = File(context.filesDir, "qarar_insights.json")
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val writeLock = Mutex()

    private val _decisions = MutableStateFlow<List<Decision>>(emptyList())
    val decisions: StateFlow<List<Decision>> = _decisions.asStateFlow()

    private val _insights = MutableStateFlow<Insights?>(null)
    val insights: StateFlow<Insights?> = _insights.asStateFlow()

    init {
        scope.launch {
            _decisions.value = load()
            _insights.value = loadInsights()
        }
    }

    private fun load(): List<Decision> = runCatching {
        if (!file.exists()) return emptyList()
        val arr = JSONArray(file.readText())
        (0 until arr.length()).map { arr.getJSONObject(it).toDecision() }
    }.getOrDefault(emptyList())

    private fun loadInsights(): Insights? = runCatching {
        if (!insightsFile.exists()) null else JSONObject(insightsFile.readText()).toInsights()
    }.getOrNull()

    private fun persist(list: List<Decision>) {
        scope.launch {
            writeLock.withLock {
                val arr = JSONArray().also { a -> list.forEach { a.put(it.toJson()) } }
                val tmp = File(file.parentFile, file.name + ".tmp")
                tmp.writeText(arr.toString())
                tmp.renameTo(file)
            }
        }
    }

    fun get(id: String): Decision? = _decisions.value.firstOrNull { it.id == id }

    fun upsert(decision: Decision) {
        _decisions.update { list ->
            val idx = list.indexOfFirst { it.id == decision.id }
            val next = if (idx >= 0) list.toMutableList().also { it[idx] = decision } else list + decision
            next.sortedByDescending { it.createdAt }.also(::persist)
        }
    }

    fun delete(id: String) {
        _decisions.update { list -> list.filterNot { it.id == id }.also(::persist) }
    }

    fun saveInsights(insights: Insights?) {
        _insights.value = insights
        scope.launch {
            writeLock.withLock {
                if (insights == null) insightsFile.delete() else insightsFile.writeText(insights.toJson().toString())
            }
        }
    }
}
