package com.savageblock.app.service

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.PixelFormat
import android.view.KeyEvent
import android.view.WindowManager
import android.widget.FrameLayout
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import androidx.lifecycle.setViewTreeLifecycleOwner
import androidx.lifecycle.setViewTreeViewModelStoreOwner
import androidx.savedstate.SavedStateRegistry
import androidx.savedstate.SavedStateRegistryController
import androidx.savedstate.SavedStateRegistryOwner
import androidx.savedstate.setViewTreeSavedStateRegistryOwner
import com.savageblock.app.data.AggressionLevel
import com.savageblock.app.data.Goal
import com.savageblock.app.ui.overlay.SavageOverlayContent
import com.savageblock.app.ui.theme.SavageTheme
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Everything the overlay needs to render one strike. */
data class OverlaySession(
    val id: Long,
    val packageName: String,
    val appLabel: String,
    val roast: String,
    val level: AggressionLevel,
    val goal: Goal,
    val wastedMinutes: Int,
    val limitMinutes: Int,
    val strikesToday: Int,
)

/**
 * Draws the full-screen roast on top of whatever app is open, via [WindowManager].
 *
 * The window is focusable (so the confession text field can take keyboard input), covers the
 * whole screen (so no touches reach the app underneath), and swallows the Back key.
 */
class OverlayManager(private val context: Context) {

    private val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager

    private val _session = MutableStateFlow<OverlaySession?>(null)
    val session: StateFlow<OverlaySession?> = _session.asStateFlow()

    private var rootView: BlockingFrame? = null
    private var lifecycleOwner: OverlayLifecycleOwner? = null

    val isShowing: Boolean get() = rootView != null
    val currentPackage: String? get() = _session.value?.packageName

    @SuppressLint("ClickableViewAccessibility")
    fun show(session: OverlaySession, onLeave: () -> Unit) {
        _session.value = session
        if (rootView != null) return // Already on screen; state update re-renders it.

        val owner = OverlayLifecycleOwner().also { it.create() }
        val composeView = ComposeView(context).apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
            setContent {
                SavageTheme {
                    val current by this@OverlayManager.session.collectAsState()
                    current?.let { SavageOverlayContent(session = it, onLeave = onLeave) }
                }
            }
        }
        val frame = BlockingFrame(context).apply {
            setViewTreeLifecycleOwner(owner)
            setViewTreeViewModelStoreOwner(owner)
            setViewTreeSavedStateRegistryOwner(owner)
            addView(composeView)
        }

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
            PixelFormat.TRANSLUCENT,
        ).apply {
            // ADJUST_RESIZE is deprecated on API 30+ (Compose's imePadding handles insets there)
            // but is still the only way to make room for the keyboard on API 26-29.
            @Suppress("DEPRECATION")
            softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE or
                WindowManager.LayoutParams.SOFT_INPUT_STATE_HIDDEN
        }

        runCatching { windowManager.addView(frame, params) }
            .onSuccess {
                rootView = frame
                lifecycleOwner = owner
                owner.resume()
            }
            .onFailure {
                owner.destroy()
                _session.value = null
            }
    }

    fun hide() {
        val view = rootView ?: return
        runCatching { windowManager.removeViewImmediate(view) }
        lifecycleOwner?.destroy()
        lifecycleOwner = null
        rootView = null
        _session.value = null
    }

    /** Full-screen container that eats the Back key so the roast cannot be dismissed early. */
    private class BlockingFrame(context: Context) : FrameLayout(context) {
        override fun dispatchKeyEvent(event: KeyEvent): Boolean {
            if (event.keyCode == KeyEvent.KEYCODE_BACK) return true
            return super.dispatchKeyEvent(event)
        }
    }

    /** Minimal owner set so a ComposeView can live inside a WindowManager window. */
    private class OverlayLifecycleOwner : LifecycleOwner, ViewModelStoreOwner, SavedStateRegistryOwner {
        private val registry = LifecycleRegistry(this)
        private val savedStateController = SavedStateRegistryController.create(this)
        override val viewModelStore: ViewModelStore = ViewModelStore()
        override val lifecycle: Lifecycle get() = registry
        override val savedStateRegistry: SavedStateRegistry get() = savedStateController.savedStateRegistry

        fun create() {
            savedStateController.performRestore(null)
            registry.currentState = Lifecycle.State.CREATED
        }

        fun resume() {
            registry.currentState = Lifecycle.State.RESUMED
        }

        fun destroy() {
            registry.currentState = Lifecycle.State.DESTROYED
            viewModelStore.clear()
        }
    }
}
