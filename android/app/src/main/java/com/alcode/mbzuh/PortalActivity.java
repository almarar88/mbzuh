package com.alcode.mbzuh;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.text.TextUtils;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * بوابة جامعية داخل التطبيق (UMS، Hub، Outlook، Teams، SharePoint، OneHub…):
 * WebView بجلسة دائمة (CookieManager) + حقن «المظهر الحديث» + تعبئة تلقائية لبيانات الدخول.
 */
public class PortalActivity extends AppCompatActivity {

    static class Spec {
        final String url, title, css, darkCss, autofill;
        final boolean dark;
        Spec(String url, String title, String css, String darkCss, boolean dark, String autofill) {
            this.url = url; this.title = title; this.css = css; this.darkCss = darkCss; this.dark = dark; this.autofill = autofill;
        }
    }

    static Spec pending;

    private static final List<String> SSO_DOMAINS = Arrays.asList(
            "microsoftonline.com", "microsoft.com", "live.com", "office.com", "office.net", "office365.com", "sharepoint.com",
            "cloud.microsoft", "msauth.net", "msftauth.net", "microsoftonline-p.com", "windows.net", "azureedge.net",
            "uaepass.ae", "gov.ae", "mbzuh.ac.ae", "skype.com", "onenote.com", "sharepointonline.com", "svc.ms", "outlook.com");

    private Spec spec;
    private WebView webView;
    private ProgressBar progress;
    private TextView titleView;
    private TextView themeBtn;
    private boolean modern;
    private boolean dark;
    private final Map<String, Integer> autofillCount = new HashMap<>();
    private ValueCallback<Uri[]> fileCallback;
    private ActivityResultLauncher<Intent> filePicker;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        spec = pending;
        if (spec == null) {
            finish();
            return;
        }
        modern = !TextUtils.isEmpty(spec.css);
        dark = spec.dark;

        getWindow().setStatusBarColor(Color.parseColor("#141118"));
        getWindow().setNavigationBarColor(Color.parseColor("#141118"));

        filePicker = registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
            if (fileCallback == null) return;
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result.getResultCode(), result.getData()));
            fileCallback = null;
        });

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.parseColor("#141118"));
        root.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);

        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        int pad = dp(8);
        bar.setPadding(pad, pad, pad, pad);
        bar.setBackgroundColor(Color.parseColor("#1d1922"));

        bar.addView(circle("✕", v -> finish()));
        bar.addView(circle("‹", v -> { if (webView.canGoBack()) webView.goBack(); }));
        bar.addView(circle("↻", v -> webView.reload()));
        titleView = new TextView(this);
        titleView.setText(spec.title);
        titleView.setTextColor(Color.WHITE);
        titleView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        titleView.setTypeface(null, android.graphics.Typeface.BOLD);
        titleView.setSingleLine(true);
        titleView.setEllipsize(TextUtils.TruncateAt.END);
        titleView.setPadding(dp(8), 0, dp(8), 0);
        LinearLayout.LayoutParams tp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        titleView.setLayoutParams(tp);
        bar.addView(titleView);
        themeBtn = circle(modern ? "◐" : "○", v -> {
            modern = !modern;
            themeBtn.setText(modern ? "◐" : "○");
            applyTheme();
        });
        bar.addView(themeBtn);
        bar.addView(circle("☾", v -> {
            dark = !dark;
            if (!modern) { modern = true; themeBtn.setText("◐"); }
            applyTheme();
        }));
        bar.addView(circle("⤴", v -> Bridge.openExternally(this, webView.getUrl() == null ? spec.url : webView.getUrl())));
        root.addView(bar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        progress.getProgressDrawable().setTint(Color.parseColor("#c9a24a"));
        root.addView(progress, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(3)));

        webView = new WebView(this);
        webView.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
        root.addView(webView, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        setContentView(root);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(true);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
        s.setSupportMultipleWindows(false);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        // بعض خدمات تسجيل الدخول ترفض WebView المعلَن؛ نستخدم وكيل مستخدم كروم القياسي.
        s.setUserAgentString(s.getUserAgentString().replace("; wv", ""));

        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        cm.setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith("http") && isInternal(url)) return false;
                if (url.startsWith("http")) {
                    Bridge.openExternally(PortalActivity.this, url);
                    return true;
                }
                // مخططات أخرى (mailto, tel, msteams…) تُمرَّر للنظام
                Bridge.openExternally(PortalActivity.this, url);
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                titleView.setText(TextUtils.isEmpty(view.getTitle()) ? spec.title : view.getTitle());
                applyTheme();
                runAutofill(url);
                CookieManager.getInstance().flush();
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progress.setProgress(newProgress);
                progress.setVisibility(newProgress >= 100 ? View.INVISIBLE : View.VISIBLE);
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try {
                    Intent intent = params.createIntent();
                    filePicker.launch(Intent.createChooser(intent, "اختر ملفًا"));
                } catch (Exception e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });

        if (savedInstanceState == null) webView.loadUrl(spec.url);
        else webView.restoreState(savedInstanceState);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack();
                else finish();
            }
        });
    }

    private TextView circle(String glyph, View.OnClickListener onClick) {
        TextView t = new TextView(this);
        t.setText(glyph);
        t.setTextColor(Color.WHITE);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        t.setGravity(Gravity.CENTER);
        GradientDrawable bg = new GradientDrawable();
        bg.setShape(GradientDrawable.OVAL);
        bg.setColor(Color.parseColor("#2a2530"));
        t.setBackground(bg);
        int size = dp(38);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(size, size);
        lp.setMarginStart(dp(4));
        lp.setMarginEnd(dp(4));
        t.setLayoutParams(lp);
        t.setOnClickListener(onClick);
        return t;
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    /* ── المظهر ── */
    private void applyTheme() {
        if (webView == null) return;
        String css = modern ? spec.css + (dark ? spec.darkCss : "") : "";
        String js = "(function(){var s=document.getElementById('mbzuh-theme');" +
                "if(!s){s=document.createElement('style');s.id='mbzuh-theme';(document.head||document.documentElement).appendChild(s);}" +
                "s.textContent=" + JSONObject.quote(css) + ";})()";
        webView.evaluateJavascript(js, null);
    }

    /* ── تعبئة بيانات الدخول ── */
    private void runAutofill(String url) {
        if (TextUtils.isEmpty(spec.autofill) || url == null) return;
        String host;
        try {
            host = Uri.parse(url).getHost();
        } catch (Exception e) {
            return;
        }
        if (host == null) return;
        int n = autofillCount.containsKey(host) ? autofillCount.get(host) : 0;
        if (n >= 4) return;
        webView.postDelayed(() -> webView.evaluateJavascript(spec.autofill, value -> {
            if ("true".equals(value)) autofillCount.put(host, autofillCount.containsKey(host) ? autofillCount.get(host) + 1 : 1);
        }), 700);
    }

    /* ── نطاقات البوابة ── */
    private static String rootDomain(String host) {
        String[] parts = host.toLowerCase().split("\\.");
        if (parts.length <= 2) return host.toLowerCase();
        String second = parts[parts.length - 2];
        String tld = parts[parts.length - 1];
        boolean composite = tld.length() == 2 && Arrays.asList("gov", "ac", "co", "com", "org", "net", "edu", "sch").contains(second);
        int from = parts.length - (composite ? 3 : 2);
        return TextUtils.join(".", Arrays.copyOfRange(parts, from, parts.length));
    }

    private boolean isInternal(String url) {
        try {
            String host = Uri.parse(url).getHost();
            String home = Uri.parse(spec.url).getHost();
            if (host == null || home == null) return true;
            host = host.toLowerCase();
            if (host.equals(home.toLowerCase())) return true;
            if (rootDomain(host).equals(rootDomain(home))) return true;
            for (String d : SSO_DOMAINS) if (host.equals(d) || host.endsWith("." + d)) return true;
            return false;
        } catch (Exception e) {
            return true;
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) webView.saveState(outState);
    }

    @Override
    protected void onPause() {
        CookieManager.getInstance().flush();
        if (webView != null) webView.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    @SuppressWarnings("unused")
    private static String toJsonArray(List<String> list) {
        return new JSONArray(list).toString();
    }

    @SuppressWarnings("unused")
    private void say(String msg) {
        Toast.makeText(this, msg, Toast.LENGTH_SHORT).show();
    }
}
