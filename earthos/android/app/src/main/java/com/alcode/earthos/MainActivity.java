package com.alcode.earthos;

import android.annotation.SuppressLint;
import android.graphics.Color;
import android.graphics.Rect;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.core.util.Consumer;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.WebViewAssetLoader;
import androidx.window.java.layout.WindowInfoTrackerCallbackAdapter;
import androidx.window.layout.DisplayFeature;
import androidx.window.layout.FoldingFeature;
import androidx.window.layout.WindowInfoTracker;
import androidx.window.layout.WindowLayoutInfo;

import org.json.JSONObject;

/**
 * Full-screen WebView host for the EarthOS dashboard bundled in assets/www.
 * Foldable support: observes the hinge (Jetpack WindowManager) and forwards the posture to the web app,
 * which re-lays out into tabletop (globe on top / controls below) or book (globe left / controls right) mode.
 */
public class MainActivity extends AppCompatActivity {

    private static final String START_URL = "https://appassets.androidplatform.net/assets/www/index.html";
    private WebView webView;
    private WindowInfoTrackerCallbackAdapter windowInfoTracker;
    private final Consumer<WindowLayoutInfo> layoutListener = this::onWindowLayoutInfo;
    private String lastPosture = "";

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        window.setStatusBarColor(Color.parseColor("#0a0f1d"));
        window.setNavigationBarColor(Color.parseColor("#0a0f1d"));
        WindowCompat.setDecorFitsSystemWindows(window, true);
        WindowInsetsControllerCompat insets = WindowCompat.getInsetsController(window, window.getDecorView());
        insets.setAppearanceLightStatusBars(false);
        insets.setAppearanceLightNavigationBars(false);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#0a0f1d"));
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        setContentView(webView);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);

        // Serve the bundled web app over https://appassets.androidplatform.net so the page runs with a
        // proper secure origin (localStorage, clipboard, fetch to api.anthropic.com / NASA GIBS all work).
        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // Keep navigation inside the bundled app.
                return !request.getUrl().toString().startsWith("https://appassets.androidplatform.net/");
            }
        });
        // Default chrome client renders JS alert/confirm/prompt dialogs (used by scenario import/export).
        webView.setWebChromeClient(new WebChromeClient());

        if (savedInstanceState == null) {
            webView.loadUrl(START_URL);
        } else {
            webView.restoreState(savedInstanceState);
        }

        windowInfoTracker = new WindowInfoTrackerCallbackAdapter(WindowInfoTracker.getOrCreate(this));
    }

    /* ── foldable posture ── */
    private void onWindowLayoutInfo(WindowLayoutInfo info) {
        String posture = "flat";
        JSONObject json = new JSONObject();
        try {
            for (DisplayFeature feature : info.getDisplayFeatures()) {
                if (!(feature instanceof FoldingFeature)) continue;
                FoldingFeature fold = (FoldingFeature) feature;
                if (fold.getState() != FoldingFeature.State.HALF_OPENED) continue;
                Rect b = fold.getBounds();
                float density = getResources().getDisplayMetrics().density;
                if (fold.getOrientation() == FoldingFeature.Orientation.HORIZONTAL) {
                    posture = "tabletop";
                    json.put("top", b.top / density);
                    json.put("bottom", b.bottom / density);
                } else {
                    posture = "book";
                    json.put("left", b.left / density);
                    json.put("right", b.right / density);
                }
            }
            json.put("posture", posture);
        } catch (Exception ignored) {
            return;
        }
        String payload = json.toString();
        if (payload.equals(lastPosture) || webView == null) return;
        lastPosture = payload;
        webView.evaluateJavascript("window.EarthOSNative && window.EarthOSNative.setPosture(" + payload + ");", null);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    protected void onStart() {
        super.onStart();
        windowInfoTracker.addWindowLayoutInfoListener(this, ContextCompat.getMainExecutor(this), layoutListener);
    }

    @Override
    protected void onStop() {
        windowInfoTracker.removeWindowLayoutInfoListener(layoutListener);
        super.onStop();
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
        webView.resumeTimers();
    }

    @Override
    protected void onPause() {
        webView.pauseTimers();
        webView.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
