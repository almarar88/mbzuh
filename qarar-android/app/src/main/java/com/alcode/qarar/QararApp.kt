package com.alcode.qarar

import android.app.Application
import com.alcode.qarar.data.DecisionRepository
import com.alcode.qarar.data.SettingsStore

class QararApp : Application() {
    lateinit var repository: DecisionRepository
        private set
    lateinit var settings: SettingsStore
        private set

    override fun onCreate() {
        super.onCreate()
        repository = DecisionRepository(this)
        settings = SettingsStore(this)
    }
}
