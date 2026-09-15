package com.alcode.mbzuh;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Rect;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
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
 * مضيف واجهة «منصّة الإداري» (React المبنية في assets/www) داخل WebView.
 * - يقدّم الملفات عبر https://appassets.androidplatform.net حتى تعمل IndexedDB وfetch وWASM بأصل آمن.
 * - يدعم هواتف الطي: يرصد المفصلة (Jetpack WindowManager) ويرسل الوضعية للواجهة.
 * - يعرّض جسر AndroidBridge للواجهة (فتح البوابات، حفظ/فتح الملفات، الطباعة…).
 */
public class MainActivity extends AppCompatActivity {

    private static final String START_URL = "https://appassets.androidplatform.net/assets/www/index.html";
    private WebView webView;
    private WindowInfoTrackerCallbackAdapter windowInfoTracker;
    private final Consumer<WindowLayoutInfo> layoutListener = this::onWindowLayoutInfo;
    private String lastPosture = "";
    private ValueCallback<Uri[]> fileCallback;
    private ActivityResultLauncher<Intent> filePicker;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        window.setStatusBarColor(Color.parseColor("#141118"));
        window.setNavigationBarColor(Color.parseColor("#141118"));
        WindowCompat.setDecorFitsSystemWindows(window, true);
        WindowInsetsControllerCompat insets = WindowCompat.getInsetsController(window, window.getDecorView());
        insets.setAppearanceLightStatusBars(false);
        insets.setAppearanceLightNavigationBars(false);

        filePicker = registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
            if (fileCallback == null) return;
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result.getResultCode(), result.getData()));
            fileCallback = null;
        });

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#141118"));
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        setContentView(webView);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setTextZoom(100);

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
                String url = request.getUrl().toString();
                if (url.startsWith("https://appassets.androidplatform.net/")) return false;
                Bridge.openExternally(MainActivity.this, url);
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try {
                    Intent intent = params.createIntent();
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    filePicker.launch(Intent.createChooser(intent, "اختر ملفًا"));
                } catch (Exception e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });

        webView.addJavascriptInterface(new Bridge(this, webView), "AndroidBridge");

        if (savedInstanceState == null) webView.loadUrl(START_URL);
        else webView.restoreState(savedInstanceState);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                // زر الرجوع يُمرَّر للواجهة (تغلق النوافذ/ترجع للرئيسية)؛ وإلا يخرج.
                webView.evaluateJavascript("(function(){ if (window.__mbzuhBack) return !!window.__mbzuhBack(); return false; })()", value -> {
                    if (!"true".equals(value)) {
                        setEnabled(false);
                        getOnBackPressedDispatcher().onBackPressed();
                        setEnabled(true);
                    }
                });
            }
        });

        windowInfoTracker = new WindowInfoTrackerCallbackAdapter(WindowInfoTracker.getOrCreate(this));
    }

    /* ── هواتف الطي ── */
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
        webView.evaluateJavascript("window.__mbzuhPosture && window.__mbzuhPosture(" + payload + ");", null);
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
    }

    @Override
    protected void onPause() {
        // ملاحظة: لا نستدعي pauseTimers() لأنه يوقف مؤقتات JavaScript في كل WebView بالعملية
        // (بما فيها شاشة البوابة) فتتجمّد Outlook/Teams، ويوقف المساعد الذي يعمل هنا أثناء
        // فتح البوابة. نكتفي بحفظ البيانات.
        webView.evaluateJavascript("window.dispatchEvent(new Event('pagehide'))", null);
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
