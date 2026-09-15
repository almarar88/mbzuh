package com.alcode.techpulse;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/** ويدجت الشاشة الرئيسية: قائمة بأحدث الأخبار من التطبيق. */
public class NewsWidgetProvider extends AppWidgetProvider {
    public static final String ACTION_REFRESH = "com.alcode.techpulse.WIDGET_REFRESH";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) update(context, manager, id);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (ACTION_REFRESH.equals(intent.getAction())) {
            // نطلب من التطبيق/العامل تحديثًا فوريًا ثم نعيد رسم الويدجت
            TechPulsePlugin.runOnce(context);
            refreshAll(context);
        }
    }

    public static void refreshAll(Context context) {
        AppWidgetManager m = AppWidgetManager.getInstance(context);
        int[] ids = m.getAppWidgetIds(new ComponentName(context, NewsWidgetProvider.class));
        for (int id : ids) update(context, m, id);
        m.notifyAppWidgetViewDataChanged(ids, R.id.widget_list);
    }

    static void update(Context context, AppWidgetManager manager, int id) {
        RemoteViews rv = new RemoteViews(context.getPackageName(), R.layout.widget_news);
        Intent svc = new Intent(context, NewsWidgetService.class);
        svc.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id);
        svc.setData(Uri.parse(svc.toUri(Intent.URI_INTENT_SCHEME)));
        rv.setRemoteAdapter(R.id.widget_list, svc);
        rv.setEmptyView(R.id.widget_list, R.id.widget_empty);

        long ts = NewsStore.readWidgetUpdatedAt(context);
        String time = ts > 0 ? new SimpleDateFormat("HH:mm", Locale.getDefault()).format(new Date(ts)) : "—";
        rv.setTextViewText(R.id.widget_updated, "حُدّث " + time);

        // فتح التطبيق من الرأس
        Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse("techpulse://home"));
        open.setPackage(context.getPackageName());
        rv.setOnClickPendingIntent(R.id.widget_header, PendingIntent.getActivity(context, 100, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        // زر التحديث
        Intent refresh = new Intent(context, NewsWidgetProvider.class).setAction(ACTION_REFRESH);
        rv.setOnClickPendingIntent(R.id.widget_refresh, PendingIntent.getBroadcast(context, 101, refresh, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        // قالب نقر العناصر
        Intent item = new Intent(Intent.ACTION_VIEW);
        item.setPackage(context.getPackageName());
        rv.setPendingIntentTemplate(R.id.widget_list, PendingIntent.getActivity(context, 102, item, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE));

        manager.updateAppWidget(id, rv);
    }
}
