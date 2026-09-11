package com.savageblock.app.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.savageblock.app.SavageBlockApp
import com.savageblock.app.util.Permissions
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/** Re-arms monitoring after reboot or app update if the user left it enabled. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        if (action != Intent.ACTION_BOOT_COMPLETED && action != Intent.ACTION_MY_PACKAGE_REPLACED) return
        val pending = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val settings = SavageBlockApp.repository(context).currentSettings()
                if (settings.monitoringEnabled && Permissions.state(context).essentialsGranted) {
                    MonitorService.start(context)
                }
            } finally {
                pending.finish()
            }
        }
    }
}
