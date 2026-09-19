package com.savageblock.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import com.savageblock.app.data.SettingsRepository

class SavageBlockApp : Application() {

    val repository: SettingsRepository by lazy { SettingsRepository(this) }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.createNotificationChannel(
            NotificationChannel(
                MONITOR_CHANNEL_ID,
                getString(R.string.notification_channel_name),
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = getString(R.string.notification_channel_description)
                setShowBadge(false)
            },
        )
        manager.createNotificationChannel(
            NotificationChannel(
                ALERT_CHANNEL_ID,
                getString(R.string.alert_channel_name),
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = getString(R.string.alert_channel_description)
            },
        )
    }

    companion object {
        const val MONITOR_CHANNEL_ID = "savageblock.monitor"
        const val ALERT_CHANNEL_ID = "savageblock.alerts"

        fun repository(context: Context): SettingsRepository =
            (context.applicationContext as SavageBlockApp).repository
    }
}
