package com.alcode.mbzuh;

import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.text.InputType;
import android.text.TextUtils;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;

import org.json.JSONObject;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * بوابة جامعية داخل التطبيق (UMS، Hub، Outlook، Teams، SharePoint، OneHub…):
 * WebView بجلسة دائمة (CookieManager) + حقن «المظهر الحديث» + تعبئة تلقائية لبيانات الدخول
 * + شريط أوامر للمساعد الذكي يُنفَّذ على الصفحة الحالية (المحادثة تعمل في واجهة التطبيق الرئيسية
 * وتُعاد أحداثها إلى هنا عبر الجسر).
 */
public class PortalActivity extends AppCompatActivity {

    static class Spec {
        final String id, url, home, title, css, darkCss, autofill;
        final boolean dark;
        Spec(String id, String url, String home, String title, String css, String darkCss, boolean dark, String autofill) {
            this.id = id; this.url = url; this.home = home; this.title = title; this.css = css; this.darkCss = darkCss; this.dark = dark; this.autofill = autofill;
        }
    }

    static Spec pending;
    static volatile PortalActivity current;

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
    private volatile String currentUrl = "";
    private volatile String currentTitle = "";

    // شريط المساعد
    private LinearLayout aiPanel;
    private ScrollView aiScroll;
    private TextView aiAnswer;
    private TextView aiStatus;
    private EditText aiInput;
    private TextView aiSend;
    private TextView aiStop;
    private boolean aiRunning;
    private final StringBuilder aiText = new StringBuilder();

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
        current = this;

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
        bar.addView(circle("✦", v -> toggleAiPanel()));
        bar.addView(circle("⤴", v -> Bridge.openExternally(this, webView.getUrl() == null ? spec.url : webView.getUrl())));
        root.addView(bar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        progress.getProgressDrawable().setTint(Color.parseColor("#c9a24a"));
        root.addView(progress, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(3)));

        webView = new WebView(this);
        webView.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
        root.addView(webView, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        root.addView(buildAiDock(), new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
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
                Bridge.openExternally(PortalActivity.this, url);
                return true;
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                currentUrl = url == null ? "" : url;
            }

            @Override
            public void doUpdateVisitedHistory(WebView view, String url, boolean isReload) {
                currentUrl = url == null ? "" : url;
                currentTitle = view.getTitle() == null ? "" : view.getTitle();
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                currentUrl = url == null ? "" : url;
                currentTitle = view.getTitle() == null ? "" : view.getTitle();
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
            public void onReceivedTitle(WebView view, String title) {
                currentTitle = title == null ? "" : title;
                if (!TextUtils.isEmpty(title)) titleView.setText(title);
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

    /* ── واجهة للجسر ── */

    WebView webView() {
        return webView;
    }

    String portalId() {
        return spec == null ? "" : spec.id;
    }

    String currentUrl() {
        return currentUrl;
    }

    String currentTitle() {
        return currentTitle;
    }

    /** يعيد استخدام الشاشة لبوابة أخرى أو لرابط داخل البوابة نفسها. */
    void load(Spec next) {
        if (next == null || webView == null) return;
        boolean sameSite = spec != null && spec.id != null && spec.id.equals(next.id);
        spec = next;
        modern = !TextUtils.isEmpty(spec.css);
        dark = spec.dark;
        themeBtn.setText(modern ? "◐" : "○");
        titleView.setText(spec.title);
        if (!sameSite) {
            autofillCount.clear();
            aiText.setLength(0);
            aiAnswer.setText("");
            aiPanel.setVisibility(View.GONE);
        }
        webView.loadUrl(spec.url);
    }

    void navigateTo(String url) {
        if (webView == null || url == null || !url.startsWith("http")) return;
        webView.loadUrl(url);
    }

    void navigateHome() {
        if (webView != null && spec != null) webView.loadUrl(spec.home);
    }

    /* ── شريط المساعد داخل البوابة ── */

    private View buildAiDock() {
        LinearLayout dock = new LinearLayout(this);
        dock.setOrientation(LinearLayout.VERTICAL);
        dock.setBackgroundColor(Color.parseColor("#1d1922"));

        aiPanel = new LinearLayout(this);
        aiPanel.setOrientation(LinearLayout.VERTICAL);
        aiPanel.setVisibility(View.GONE);
        aiPanel.setPadding(dp(12), dp(8), dp(12), 0);

        aiStatus = new TextView(this);
        aiStatus.setTextColor(Color.parseColor("#c9a24a"));
        aiStatus.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        aiPanel.addView(aiStatus, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        aiScroll = new ScrollView(this);
        aiAnswer = new TextView(this);
        aiAnswer.setTextColor(Color.parseColor("#f7f3f9"));
        aiAnswer.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        aiAnswer.setTextIsSelectable(true);
        aiAnswer.setLineSpacing(0, 1.25f);
        aiScroll.addView(aiAnswer, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        int maxH = Math.round(getResources().getDisplayMetrics().heightPixels * 0.34f);
        LinearLayout.LayoutParams sp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        aiScroll.setLayoutParams(sp);
        aiScroll.setPadding(0, dp(4), 0, dp(6));
        // حد أقصى للارتفاع
        aiScroll.getViewTreeObserver().addOnGlobalLayoutListener(() -> {
            if (aiScroll.getHeight() > maxH) {
                ViewGroup.LayoutParams lp = aiScroll.getLayoutParams();
                lp.height = maxH;
                aiScroll.setLayoutParams(lp);
            }
        });
        aiPanel.addView(aiScroll);
        dock.addView(aiPanel, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(dp(8), dp(6), dp(8), dp(8));

        aiInput = new EditText(this);
        aiInput.setHint("اطلب من المساعد شيئًا في هذه الصفحة…");
        aiInput.setHintTextColor(Color.parseColor("#8f879a"));
        aiInput.setTextColor(Color.WHITE);
        aiInput.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        aiInput.setSingleLine(true);
        aiInput.setImeOptions(EditorInfo.IME_ACTION_SEND);
        aiInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        GradientDrawable ibg = new GradientDrawable();
        ibg.setCornerRadius(dp(22));
        ibg.setColor(Color.parseColor("#27222d"));
        aiInput.setBackground(ibg);
        aiInput.setPadding(dp(16), dp(10), dp(16), dp(10));
        aiInput.setOnEditorActionListener((v, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_SEND) { sendCommand(); return true; }
            return false;
        });
        LinearLayout.LayoutParams ip = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        ip.setMarginEnd(dp(6));
        row.addView(aiInput, ip);

        aiSend = circle("➤", v -> sendCommand());
        aiSend.setBackgroundTintList(null);
        GradientDrawable sbg = new GradientDrawable();
        sbg.setShape(GradientDrawable.OVAL);
        sbg.setColor(Color.parseColor("#ff8f84"));
        aiSend.setBackground(sbg);
        aiSend.setTextColor(Color.parseColor("#2b0f0c"));
        row.addView(aiSend);

        aiStop = circle("■", v -> {
            Bridge b = Bridge.current;
            if (b != null) b.runInHost("window.__mbzuhPortalCancel && window.__mbzuhPortalCancel()");
        });
        aiStop.setVisibility(View.GONE);
        row.addView(aiStop);

        dock.addView(row, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        return dock;
    }

    private void toggleAiPanel() {
        if (aiPanel.getVisibility() == View.VISIBLE) aiPanel.setVisibility(View.GONE);
        else {
            aiPanel.setVisibility(View.VISIBLE);
            if (aiText.length() == 0) aiStatus.setText("اكتب أمرًا بالأسفل: «لخّص هذه الصفحة»، «حوّل الطلبات هنا إلى مهام»، «ما اجتماعاتي اليوم؟»");
        }
    }

    private void sendCommand() {
        String text = aiInput.getText() == null ? "" : aiInput.getText().toString().trim();
        if (text.isEmpty() || aiRunning) return;
        Bridge b = Bridge.current;
        if (b == null) {
            say("واجهة التطبيق غير جاهزة");
            return;
        }
        aiInput.setText("");
        aiText.setLength(0);
        aiAnswer.setText("");
        aiStatus.setText("⏳ يفهم الطلب…");
        aiPanel.setVisibility(View.VISIBLE);
        setRunning(true);
        b.runInHost("window.__mbzuhPortalCommand && window.__mbzuhPortalCommand(" + JSONObject.quote(spec.id) + "," + JSONObject.quote(text) + ")");
    }

    private void setRunning(boolean running) {
        aiRunning = running;
        aiSend.setVisibility(running ? View.GONE : View.VISIBLE);
        aiStop.setVisibility(running ? View.VISIBLE : View.GONE);
    }

    /** حدث بث من المساعد (يصل عبر الجسر على خيط الواجهة). */
    void onAssistantEvent(String json) {
        try {
            JSONObject o = new JSONObject(json);
            String type = o.optString("type");
            switch (type) {
                case "text":
                    aiText.append(o.optString("text"));
                    aiAnswer.setText(aiText.toString());
                    aiPanel.setVisibility(View.VISIBLE);
                    aiScroll.post(() -> aiScroll.fullScroll(View.FOCUS_DOWN));
                    break;
                case "tool": {
                    String label = o.optString("label");
                    boolean start = "start".equals(o.optString("phase"));
                    aiStatus.setText((start ? "⏳ " : (o.optBoolean("ok", true) ? "✓ " : "✕ ")) + label);
                    aiPanel.setVisibility(View.VISIBLE);
                    break;
                }
                case "approval": {
                    String requestId = o.optString("requestId");
                    new AlertDialog.Builder(this)
                            .setTitle("يطلب المساعد الإذن: " + o.optString("label"))
                            .setMessage(o.optString("detail"))
                            .setPositiveButton("موافق، نفّذ", (d, w) -> approve(requestId, true))
                            .setNegativeButton("رفض", (d, w) -> approve(requestId, false))
                            .setOnCancelListener(d -> approve(requestId, false))
                            .show();
                    break;
                }
                case "done": {
                    String full = o.optString("text");
                    if (!full.isEmpty()) {
                        aiText.setLength(0);
                        aiText.append(full);
                        aiAnswer.setText(full);
                    }
                    aiStatus.setText("✓ تم");
                    setRunning(false);
                    break;
                }
                case "error":
                case "refusal":
                    aiStatus.setText("⚠ " + o.optString("message"));
                    aiPanel.setVisibility(View.VISIBLE);
                    setRunning(false);
                    break;
                default:
                    break;
            }
        } catch (Exception ignored) {
        }
    }

    private void approve(String requestId, boolean ok) {
        Bridge b = Bridge.current;
        if (b != null) b.runInHost("window.__mbzuhPortalApprove && window.__mbzuhPortalApprove(" + JSONObject.quote(requestId) + "," + (ok ? "true" : "false") + ")");
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
            String home = Uri.parse(spec.home).getHost();
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
    protected void onResume() {
        super.onResume();
        current = this;
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onPause() {
        CookieManager.getInstance().flush();
        if (webView != null) webView.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (current == this) current = null;
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    private void say(String msg) {
        Toast.makeText(this, msg, Toast.LENGTH_SHORT).show();
    }
}
