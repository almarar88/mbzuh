package com.alcode.mbzuh;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebStorage;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/** جسر JavaScript ↔ أندرويد المعروض للواجهة باسم AndroidBridge. */
public class Bridge {
    private final Activity activity;
    private final WebView host;
    private WebView printView; // مرجع حتى لا يُجمع أثناء الطباعة

    Bridge(Activity activity, WebView host) {
        this.activity = activity;
        this.host = host;
    }

    static void openExternally(Activity activity, String url) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(i);
        } catch (Exception e) {
            Toast.makeText(activity, "تعذّر فتح الرابط", Toast.LENGTH_SHORT).show();
        }
    }

    @JavascriptInterface
    public void openExternal(String url) {
        activity.runOnUiThread(() -> openExternally(activity, url));
    }

    @JavascriptInterface
    public void openPortal(String url, String title, String css, String darkCss, boolean dark, String extraJson) {
        String autofill = "";
        try {
            JSONObject extra = new JSONObject(extraJson == null ? "{}" : extraJson);
            autofill = extra.optString("autofill", "");
        } catch (Exception ignored) {
        }
        PortalActivity.pending = new PortalActivity.Spec(url, title, css == null ? "" : css, darkCss == null ? "" : darkCss, dark, autofill);
        activity.runOnUiThread(() -> {
            Intent i = new Intent(activity, PortalActivity.class);
            activity.startActivity(i);
        });
    }

    @JavascriptInterface
    public void clearPortalSession() {
        activity.runOnUiThread(() -> {
            CookieManager cm = CookieManager.getInstance();
            cm.removeAllCookies(null);
            cm.flush();
            WebStorage.getInstance().deleteAllData();
        });
    }

    @JavascriptInterface
    public void saveFile(String name, String mime, String base64) {
        try {
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, name);
            values.put(MediaStore.Downloads.MIME_TYPE, mime);
            values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/MBZUH");
            Uri uri = activity.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) throw new IllegalStateException("insert failed");
            try (OutputStream out = activity.getContentResolver().openOutputStream(uri)) {
                if (out == null) throw new IllegalStateException("no stream");
                out.write(bytes);
            }
            toast("تم الحفظ في التنزيلات/MBZUH: " + name);
        } catch (Exception e) {
            toast("تعذّر حفظ الملف: " + e.getMessage());
        }
    }

    @JavascriptInterface
    public void openFile(String name, String mime, String base64) {
        try {
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            File dir = new File(activity.getCacheDir(), "opened");
            if (!dir.exists()) dir.mkdirs();
            File f = new File(dir, name.replaceAll("[\\\\/:*?\"<>|]", "_"));
            try (FileOutputStream out = new FileOutputStream(f)) {
                out.write(bytes);
            }
            Uri uri = FileProvider.getUriForFile(activity, "com.alcode.mbzuh.admin.files", f);
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(uri, mime);
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.runOnUiThread(() -> {
                try {
                    activity.startActivity(Intent.createChooser(i, name));
                } catch (Exception e) {
                    toast("لا يوجد تطبيق يفتح هذا الملف");
                }
            });
        } catch (Exception e) {
            toast("تعذّر فتح الملف");
        }
    }

    /** يفتح حوار الطباعة الأصلي (يتيح «حفظ كـPDF») لمحتوى HTML. */
    @JavascriptInterface
    public void printHtml(String html, String jobName) {
        activity.runOnUiThread(() -> {
            printView = new WebView(activity);
            printView.getSettings().setJavaScriptEnabled(false);
            printView.setWebViewClient(new WebViewClient() {
                @Override
                public void onPageFinished(WebView view, String url) {
                    PrintManager pm = (PrintManager) activity.getSystemService(Activity.PRINT_SERVICE);
                    String name = (jobName == null || jobName.isEmpty()) ? "تقرير" : jobName;
                    pm.print(name, view.createPrintDocumentAdapter(name),
                            new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build());
                }
            });
            printView.loadDataWithBaseURL(null, html, "text/html", "utf-8", null);
        });
    }

    @JavascriptInterface
    public void toast(String message) {
        if (message == null || message.isEmpty()) return;
        activity.runOnUiThread(() -> Toast.makeText(activity, message, Toast.LENGTH_SHORT).show());
    }

    @JavascriptInterface
    public String getInfo() {
        try {
            JSONObject o = new JSONObject();
            o.put("sdk", Build.VERSION.SDK_INT);
            o.put("model", Build.MODEL);
            o.put("version", activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0).versionName);
            return o.toString();
        } catch (Exception e) {
            return "{}";
        }
    }

    WebView host() {
        return host;
    }
}
