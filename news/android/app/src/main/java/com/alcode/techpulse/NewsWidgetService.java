package com.alcode.techpulse;

import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/** يزوّد قائمة الويدجت بالعناصر من widget.json (المكتوب من التطبيق أو من عامل الخلفية). */
public class NewsWidgetService extends RemoteViewsService {
    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new Factory(getApplicationContext());
    }

    static class Factory implements RemoteViewsFactory {
        private final Context ctx;
        private JSONArray items = new JSONArray();

        Factory(Context ctx) {
            this.ctx = ctx;
        }

        @Override
        public void onCreate() {
            onDataSetChanged();
        }

        @Override
        public void onDataSetChanged() {
            items = NewsStore.readWidgetItems(ctx);
        }

        @Override
        public void onDestroy() {}

        @Override
        public int getCount() {
            return Math.min(items.length(), 12);
        }

        @Override
        public RemoteViews getViewAt(int position) {
            RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.widget_item);
            JSONObject o = items.optJSONObject(position);
            if (o == null) return rv;
            rv.setTextViewText(R.id.item_title, o.optString("title", ""));
            String meta = o.optString("source", "");
            String ago = timeAgo(o.optString("publishedAt", ""));
            if (!ago.isEmpty()) meta += " · " + ago;
            rv.setTextViewText(R.id.item_meta, meta);
            rv.setTextViewText(R.id.item_badge, "ai".equals(o.optString("category", "tech")) ? "AI" : "تقنية");
            rv.setInt(R.id.item_badge, "setBackgroundResource", "ai".equals(o.optString("category", "tech")) ? R.drawable.widget_badge_ai : R.drawable.widget_badge_tech);

            Bitmap thumb = loadThumb(o.optString("image", ""));
            if (thumb != null) {
                rv.setImageViewBitmap(R.id.item_thumb, thumb);
                rv.setViewVisibility(R.id.item_thumb, android.view.View.VISIBLE);
            } else {
                rv.setViewVisibility(R.id.item_thumb, android.view.View.GONE);
            }

            Intent fill = new Intent();
            long id = o.optLong("id", 0);
            fill.setData(Uri.parse(id > 0 ? "techpulse://article/" + id : "techpulse://open?url=" + Uri.encode(o.optString("url", ""))));
            rv.setOnClickFillInIntent(R.id.item_root, fill);
            return rv;
        }

        private Bitmap loadThumb(String url) {
            if (url == null || !url.startsWith("http")) return null;
            try {
                File cache = new File(ctx.getCacheDir(), "wthumb_" + Math.abs(url.hashCode()) + ".jpg");
                if (!cache.exists()) {
                    HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                    c.setConnectTimeout(6000);
                    c.setReadTimeout(8000);
                    c.setRequestProperty("User-Agent", "Mozilla/5.0 TechPulse/1.0");
                    try (InputStream in = c.getInputStream()) {
                        BitmapFactory.Options opt = new BitmapFactory.Options();
                        opt.inSampleSize = 4;
                        Bitmap b = BitmapFactory.decodeStream(in, null, opt);
                        if (b == null) return null;
                        int size = Math.min(b.getWidth(), b.getHeight());
                        Bitmap sq = Bitmap.createBitmap(b, (b.getWidth() - size) / 2, (b.getHeight() - size) / 2, size, size);
                        Bitmap small = Bitmap.createScaledBitmap(sq, 160, 160, true);
                        try (FileOutputStream out = new FileOutputStream(cache)) {
                            small.compress(Bitmap.CompressFormat.JPEG, 82, out);
                        }
                        return small;
                    } finally {
                        c.disconnect();
                    }
                }
                return BitmapFactory.decodeFile(cache.getAbsolutePath());
            } catch (Exception e) {
                return null;
            }
        }

        private static String timeAgo(String iso) {
            if (iso == null || iso.isEmpty()) return "";
            try {
                SimpleDateFormat f = new SimpleDateFormat(iso.length() > 20 ? "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'" : "yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US);
                f.setTimeZone(TimeZone.getTimeZone("UTC"));
                Date d = f.parse(iso);
                if (d == null) return "";
                long m = (System.currentTimeMillis() - d.getTime()) / 60000;
                if (m < 1) return "الآن";
                if (m < 60) return "قبل " + m + " د";
                if (m < 1440) return "قبل " + (m / 60) + " س";
                return "قبل " + (m / 1440) + " ي";
            } catch (Exception e) {
                return "";
            }
        }

        @Override
        public RemoteViews getLoadingView() {
            return null;
        }

        @Override
        public int getViewTypeCount() {
            return 1;
        }

        @Override
        public long getItemId(int position) {
            return position;
        }

        @Override
        public boolean hasStableIds() {
            return false;
        }
    }
}
