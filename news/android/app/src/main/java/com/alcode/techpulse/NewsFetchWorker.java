package com.alcode.techpulse;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;
import org.xmlpull.v1.XmlPullParser;
import org.xmlpull.v1.XmlPullParserFactory;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * عامل خلفية (WorkManager): يجلب خلاصات RSS/أخبار Google المفعّلة والتطبيق مغلق،
 * ويرسل تنبيهات بالأخبار الجديدة (مع أولوية لاهتمامات المستخدم) ويحدّث الويدجت.
 */
public class NewsFetchWorker extends Worker {
    public static final String CHANNEL_NEWS = "news_new";
    public static final String CHANNEL_INTEREST = "news_interest";
    private static final String UA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36 TechPulse/1.0";

    public NewsFetchWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    static class Item {
        String title, url, summary, source, image, publishedAt;
        boolean ai;
        String interest;
    }

    @NonNull
    @Override
    public Result doWork() {
        Context ctx = getApplicationContext();
        JSONObject settings = NewsStore.readSettings(ctx);
        if (!settings.optBoolean("notifyNew", true)) return Result.success();
        JSONArray sources = settings.optJSONArray("sources");
        if (sources == null || sources.length() == 0) return Result.success();
        JSONArray interests = settings.optJSONArray("interests");
        JSONArray muted = settings.optJSONArray("muted");
        boolean interestOnly = settings.optBoolean("notifyInterestsOnly", false);

        Set<String> seen = NewsStore.readSeen(ctx);
        boolean firstRun = seen.isEmpty();
        List<Item> fresh = new ArrayList<>();
        List<String> newUrls = new ArrayList<>();
        int budget = 0;
        for (int i = 0; i < sources.length() && budget < 25; i++) {
            JSONObject s = sources.optJSONObject(i);
            if (s == null) continue;
            String url = s.optString("url", "");
            if (url.isEmpty()) continue;
            budget++;
            try {
                for (Item it : fetchFeed(url, s.optString("name", ""))) {
                    if (it.url == null || it.title == null || seen.contains(it.url)) continue;
                    newUrls.add(it.url);
                    if (NewsStore.isMuted(it.title, it.summary, muted)) continue;
                    if (!s.optBoolean("techOnly", true) && !NewsStore.isTech(it.title, it.summary)) continue;
                    it.ai = NewsStore.isAi(it.title, it.summary);
                    it.interest = NewsStore.matchInterest(it.title, it.summary, interests);
                    fresh.add(it);
                }
            } catch (Exception ignored) {
            }
        }
        NewsStore.markSeen(ctx, newUrls);
        if (fresh.isEmpty()) return Result.success();

        // أول تشغيل: نسجّل ما رأيناه بلا إزعاج المستخدم بعشرات التنبيهات
        if (!firstRun) notify(ctx, fresh, interestOnly);
        updateWidget(ctx, fresh);
        return Result.success();
    }

    private void updateWidget(Context ctx, List<Item> fresh) {
        try {
            JSONArray existing = NewsStore.readWidgetItems(ctx);
            JSONArray merged = new JSONArray();
            for (Item it : fresh) {
                if (merged.length() >= 20) break;
                JSONObject o = new JSONObject();
                o.put("title", it.title);
                o.put("url", it.url);
                o.put("source", it.source);
                o.put("category", it.ai ? "ai" : "tech");
                o.put("publishedAt", it.publishedAt != null ? it.publishedAt : "");
                o.put("image", it.image != null ? it.image : "");
                merged.put(o);
            }
            for (int i = 0; i < existing.length() && merged.length() < 20; i++) merged.put(existing.get(i));
            NewsStore.writeWidget(ctx, merged);
            NewsWidgetProvider.refreshAll(ctx);
        } catch (Exception ignored) {
        }
    }

    public static void ensureChannels(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm == null) return;
        NotificationChannel general = new NotificationChannel(CHANNEL_NEWS, "أخبار جديدة", NotificationManager.IMPORTANCE_DEFAULT);
        general.setDescription("ملخص بالأخبار التقنية الجديدة");
        NotificationChannel interest = new NotificationChannel(CHANNEL_INTEREST, "اهتماماتي", NotificationManager.IMPORTANCE_HIGH);
        interest.setDescription("أخبار تطابق اهتماماتك");
        nm.createNotificationChannel(general);
        nm.createNotificationChannel(interest);
    }

    private PendingIntent openIntent(Context ctx, String url, int reqCode) {
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse("techpulse://open?url=" + Uri.encode(url)));
        i.setPackage(ctx.getPackageName());
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(ctx, reqCode, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private void notify(Context ctx, List<Item> fresh, boolean interestOnly) {
        ensureChannels(ctx);
        NotificationManagerCompat nm = NotificationManagerCompat.from(ctx);
        if (!nm.areNotificationsEnabled()) return;
        int base = (int) (System.currentTimeMillis() / 1000L % 100000);
        int shown = 0;
        try {
            for (Item it : fresh) {
                if (it.interest == null || shown >= 3) continue;
                NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL_INTEREST)
                    .setSmallIcon(R.mipmap.ic_launcher_foreground)
                    .setContentTitle("⭐ " + it.interest + " — " + it.source)
                    .setContentText(it.title)
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(it.title + (it.summary.isEmpty() ? "" : "\n" + it.summary)))
                    .setContentIntent(openIntent(ctx, it.url, base + shown))
                    .setAutoCancel(true)
                    .setPriority(NotificationCompat.PRIORITY_HIGH);
                nm.notify(base + shown, b.build());
                shown++;
            }
            if (interestOnly) return;
            List<Item> rest = new ArrayList<>();
            for (Item it : fresh) if (it.interest == null) rest.add(it);
            if (rest.isEmpty()) return;
            NotificationCompat.InboxStyle style = new NotificationCompat.InboxStyle();
            for (int i = 0; i < Math.min(5, rest.size()); i++) style.addLine((rest.get(i).ai ? "✦ " : "• ") + rest.get(i).title);
            if (rest.size() > 5) style.setSummaryText("و" + (rest.size() - 5) + " خبر آخر");
            NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL_NEWS)
                .setSmallIcon(R.mipmap.ic_launcher_foreground)
                .setContentTitle("نبض التقنية: " + rest.size() + " خبر جديد")
                .setContentText(rest.get(0).title)
                .setStyle(style)
                .setContentIntent(openIntent(ctx, rest.get(0).url, base + 50))
                .setAutoCancel(true)
                .setNumber(rest.size());
            nm.notify(7001, b.build());
        } catch (SecurityException ignored) {
        }
    }

    // ── جلب وتحليل RSS/Atom ──
    private List<Item> fetchFeed(String feedUrl, String sourceName) throws Exception {
        List<Item> out = new ArrayList<>();
        HttpURLConnection c = (HttpURLConnection) new URL(feedUrl).openConnection();
        c.setConnectTimeout(15000);
        c.setReadTimeout(20000);
        c.setInstanceFollowRedirects(true);
        c.setRequestProperty("User-Agent", UA);
        c.setRequestProperty("Accept", "application/rss+xml, application/atom+xml, application/xml, text/xml, */*");
        try (InputStream in = c.getInputStream()) {
            if (c.getResponseCode() >= 400) return out;
            XmlPullParser p = XmlPullParserFactory.newInstance().newPullParser();
            p.setFeature(XmlPullParser.FEATURE_PROCESS_NAMESPACES, true);
            p.setInput(in, null);
            Item cur = null;
            String text = null;
            int ev = p.getEventType();
            while (ev != XmlPullParser.END_DOCUMENT && out.size() < 25) {
                String name = p.getName();
                if (ev == XmlPullParser.START_TAG) {
                    if ("item".equals(name) || "entry".equals(name)) {
                        cur = new Item();
                        cur.source = sourceName;
                        cur.summary = "";
                    } else if (cur != null) {
                        if ("link".equals(name)) {
                            String href = p.getAttributeValue(null, "href");
                            String rel = p.getAttributeValue(null, "rel");
                            if (href != null && (rel == null || "alternate".equals(rel)) && cur.url == null) cur.url = href.trim();
                        } else if (("content".equals(name) || "thumbnail".equals(name)) && "http://search.yahoo.com/mrss/".equals(p.getNamespace())) {
                            String u = p.getAttributeValue(null, "url");
                            String type = p.getAttributeValue(null, "type");
                            if (u != null && cur.image == null && (type == null || type.startsWith("image"))) cur.image = u;
                        } else if ("enclosure".equals(name)) {
                            String u = p.getAttributeValue(null, "url");
                            String type = p.getAttributeValue(null, "type");
                            if (u != null && cur.image == null && type != null && type.startsWith("image")) cur.image = u;
                        }
                    }
                    text = null;
                } else if (ev == XmlPullParser.TEXT) {
                    text = p.getText();
                } else if (ev == XmlPullParser.END_TAG && cur != null) {
                    String t = text == null ? "" : text.trim();
                    if ("title".equals(name) && cur.title == null) cur.title = stripHtml(t);
                    else if ("link".equals(name) && cur.url == null && t.startsWith("http")) cur.url = t;
                    else if (("description".equals(name) || "summary".equals(name)) && cur.summary.isEmpty()) {
                        cur.summary = trim(stripHtml(t), 300);
                        if (cur.image == null) cur.image = firstImg(t);
                    } else if ("encoded".equals(name) && cur.image == null) {
                        cur.image = firstImg(t);
                    } else if (("pubDate".equals(name) || "published".equals(name) || "updated".equals(name) || "date".equals(name)) && cur.publishedAt == null) {
                        cur.publishedAt = toIso(t);
                    } else if ("item".equals(name) || "entry".equals(name)) {
                        if (cur.title != null && cur.url != null) {
                            // عنوان أخبار Google ينتهي بـ " - اسم الصحيفة"
                            int dash = cur.title.lastIndexOf(" - ");
                            if (feedUrl.contains("news.google.com") && dash > 10) {
                                cur.source = cur.title.substring(dash + 3).trim();
                                cur.title = cur.title.substring(0, dash).trim();
                            }
                            out.add(cur);
                        }
                        cur = null;
                    }
                    text = null;
                }
                ev = p.next();
            }
        } finally {
            c.disconnect();
        }
        return out;
    }

    private static String stripHtml(String s) {
        if (s == null) return "";
        return s.replaceAll("<[^>]+>", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"").replace("&#39;", "'").replace("&nbsp;", " ").replaceAll("\\s+", " ").trim();
    }

    private static String firstImg(String html) {
        if (html == null) return null;
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("<img[^>]+src=[\"']([^\"']+)[\"']").matcher(html);
        return m.find() ? m.group(1) : null;
    }

    private static String trim(String s, int n) {
        return s.length() <= n ? s : s.substring(0, n - 1) + "…";
    }

    private static final String[] DATE_FORMATS = {"EEE, dd MMM yyyy HH:mm:ss Z", "EEE, dd MMM yyyy HH:mm:ss zzz", "yyyy-MM-dd'T'HH:mm:ssXXX", "yyyy-MM-dd'T'HH:mm:ss.SSSXXX", "yyyy-MM-dd'T'HH:mm:ss'Z'", "dd MMM yyyy HH:mm:ss Z"};

    private static String toIso(String s) {
        for (String f : DATE_FORMATS) {
            try {
                Date d = new SimpleDateFormat(f, Locale.US).parse(s);
                if (d != null) {
                    SimpleDateFormat iso = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US);
                    iso.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
                    return iso.format(d);
                }
            } catch (Exception ignored) {
            }
        }
        SimpleDateFormat iso = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US);
        iso.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
        return iso.format(new Date());
    }
}
