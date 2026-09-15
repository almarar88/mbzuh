package com.alcode.techpulse;

import android.content.Context;

import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.concurrent.TimeUnit;

/** جسر بين واجهة الويب والكود الأصلي: مزامنة بيانات الويدجت والإعدادات، وجدولة عامل الخلفية. */
@CapacitorPlugin(name = "TechPulseNative")
public class TechPulsePlugin extends Plugin {
    private static final String WORK_NAME = "techpulse-news-fetch";

    /** يكتب عناصر الويدجت (عناوين مترجمة من التطبيق) والإعدادات اللازمة للعامل الأصلي. */
    @PluginMethod
    public void sync(PluginCall call) {
        Context ctx = getContext();
        try {
            JSONArray items = call.getArray("items");
            if (items != null) NewsStore.writeWidget(ctx, items);
            JSONObject settings = call.getObject("settings");
            if (settings != null) NewsStore.writeText(ctx, NewsStore.SETTINGS_FILE, settings.toString());
            // ما يعرفه التطبيق يُعتبر مرئيًا حتى لا يكرره العامل في التنبيهات
            JSONArray seen = call.getArray("seenUrls");
            if (seen != null) {
                java.util.List<String> urls = new java.util.ArrayList<>();
                for (int i = 0; i < seen.length(); i++) urls.add(seen.optString(i));
                NewsStore.markSeen(ctx, urls);
            }
            NewsWidgetProvider.refreshAll(ctx);
            NewsFetchWorker.ensureChannels(ctx);
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    /** يجدول (أو يلغي) الجلب الدوري في الخلفية. الحد الأدنى في أندرويد 15 دقيقة. */
    @PluginMethod
    public void configureBackground(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", true));
        int minutes = Math.max(15, call.getInt("minutes", 30));
        WorkManager wm = WorkManager.getInstance(getContext());
        if (!enabled) {
            wm.cancelUniqueWork(WORK_NAME);
            call.resolve();
            return;
        }
        Constraints constraints = new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
        PeriodicWorkRequest req = new PeriodicWorkRequest.Builder(NewsFetchWorker.class, minutes, TimeUnit.MINUTES)
            .setConstraints(constraints)
            .setInitialDelay(minutes, TimeUnit.MINUTES)
            .build();
        wm.enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.UPDATE, req);
        JSObject ret = new JSObject();
        ret.put("minutes", minutes);
        call.resolve(ret);
    }

    @PluginMethod
    public void runOnceNow(PluginCall call) {
        runOnce(getContext());
        call.resolve();
    }

    @PluginMethod
    public void widgetCount(PluginCall call) {
        android.appwidget.AppWidgetManager m = android.appwidget.AppWidgetManager.getInstance(getContext());
        int n = m.getAppWidgetIds(new android.content.ComponentName(getContext(), NewsWidgetProvider.class)).length;
        JSObject ret = new JSObject();
        ret.put("count", n);
        call.resolve(ret);
    }

    static void runOnce(Context ctx) {
        OneTimeWorkRequest req = new OneTimeWorkRequest.Builder(NewsFetchWorker.class)
            .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build();
        WorkManager.getInstance(ctx).enqueueUniqueWork(WORK_NAME + "-once", ExistingWorkPolicy.REPLACE, req);
    }
}
