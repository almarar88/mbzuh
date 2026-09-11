package com.savageblock.app.service

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import com.savageblock.app.data.AggressionLevel

/**
 * Physical punishment for opening a blocked app: vibration patterns and, in Savage mode,
 * the device's alarm ringtone at alarm volume until the user escapes the overlay.
 */
class PenaltyEffects(private val context: Context) {

    private val vibrator: Vibrator? by lazy {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager)?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }
    }

    private var player: MediaPlayer? = null

    fun start(level: AggressionLevel) {
        if (level.vibrates) vibrate(level)
        if (level.playsAlarm) playAlarm()
    }

    fun stop() {
        vibrator?.cancel()
        player?.runCatching { stop() }
        player?.release()
        player = null
    }

    private fun vibrate(level: AggressionLevel) {
        val v = vibrator ?: return
        if (!v.hasVibrator()) return
        val pattern = when (level) {
            AggressionLevel.SAVAGE -> longArrayOf(0, 600, 150, 600, 150, 900, 400)
            else -> longArrayOf(0, 250, 120, 250, 800)
        }
        // Savage keeps buzzing until dismissed; medium buzzes a couple of times then stops.
        val repeatIndex = if (level == AggressionLevel.SAVAGE) 0 else -1
        v.vibrate(VibrationEffect.createWaveform(pattern, repeatIndex))
    }

    private fun playAlarm() {
        val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            ?: return
        player = MediaPlayer().apply {
            runCatching {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build(),
                )
                setDataSource(context, uri)
                isLooping = true
                prepare()
                start()
            }.onFailure {
                release()
                player = null
            }
        }
    }
}
