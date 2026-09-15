package com.alcode.techpulse;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * تخزين مشترك بين واجهة الويب والكود الأصلي: عناصر الويدجت، الإعدادات، والعناوين المرئية سابقًا.
 */
public final class NewsStore {
    public static final String WIDGET_FILE = "widget.json";
    public static final String SETTINGS_FILE = "native-settings.json";
    private static final String PREFS = "techpulse_native";
    private static final String KEY_SEEN = "seen_urls";
    private static final int SEEN_CAP = 4000;

    private NewsStore() {}

    private static File file(Context ctx, String name) {
        return new File(ctx.getFilesDir(), name);
    }

    public static String readText(Context ctx, String name) {
        File f = file(ctx, name);
        if (!f.exists()) return null;
        try (FileInputStream in = new FileInputStream(f)) {
            byte[] buf = new byte[(int) f.length()];
            int n = in.read(buf);
            return new String(buf, 0, Math.max(n, 0), StandardCharsets.UTF_8);
        } catch (IOException e) {
            return null;
        }
    }

    public static void writeText(Context ctx, String name, String text) {
        try (FileOutputStream out = new FileOutputStream(file(ctx, name))) {
            out.write(text.getBytes(StandardCharsets.UTF_8));
        } catch (IOException ignored) {
        }
    }

    public static JSONObject readSettings(Context ctx) {
        String t = readText(ctx, SETTINGS_FILE);
        if (t == null) return new JSONObject();
        try {
            return new JSONObject(t);
        } catch (JSONException e) {
            return new JSONObject();
        }
    }

    public static JSONArray readWidgetItems(Context ctx) {
        String t = readText(ctx, WIDGET_FILE);
        if (t == null) return new JSONArray();
        try {
            JSONObject o = new JSONObject(t);
            return o.optJSONArray("items") != null ? o.optJSONArray("items") : new JSONArray();
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    public static long readWidgetUpdatedAt(Context ctx) {
        String t = readText(ctx, WIDGET_FILE);
        if (t == null) return 0;
        try {
            return new JSONObject(t).optLong("updatedAt", 0);
        } catch (JSONException e) {
            return 0;
        }
    }

    public static void writeWidget(Context ctx, JSONArray items) {
        JSONObject o = new JSONObject();
        try {
            o.put("items", items);
            o.put("updatedAt", System.currentTimeMillis());
        } catch (JSONException ignored) {
        }
        writeText(ctx, WIDGET_FILE, o.toString());
    }

    public static Set<String> readSeen(Context ctx) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        return new HashSet<>(p.getStringSet(KEY_SEEN, new HashSet<>()));
    }

    public static void writeSeen(Context ctx, Set<String> seen) {
        Set<String> s = seen;
        if (s.size() > SEEN_CAP) {
            List<String> l = new ArrayList<>(s);
            s = new HashSet<>(l.subList(l.size() - SEEN_CAP, l.size()));
        }
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putStringSet(KEY_SEEN, s).apply();
    }

    public static void markSeen(Context ctx, List<String> urls) {
        Set<String> seen = readSeen(ctx);
        seen.addAll(urls);
        writeSeen(ctx, seen);
    }

    // ── تصنيف مبسّط (يوافق مصنّف الواجهة في الخطوط العريضة) ──
    private static final String[] AI_WORDS = {
        "ai", "a.i.", "artificial intelligence", "الذكاء الاصطناعي", "ذكاء اصطناعي", "llm", "language model", "نموذج لغوي", "chatgpt", "openai",
        "gpt", "claude", "anthropic", "gemini", "deepmind", "llama", "mistral", "deepseek", "qwen", "hugging face", "grok", "copilot",
        "machine learning", "deep learning", "neural", "تعلم الآلة", "التعلم الآلي", "التعلم العميق", "روبوت", "robot", "agent", "وكيل ذكي",
        "midjourney", "stable diffusion", "توليد الصور", "كلود", "جيميني", "شات جي بي تي", "أوبن إيه آي"
    };
    private static final String[] TECH_WORDS = {
        "nvidia", "gpu", "chip", "semiconductor", "amd", "intel", "qualcomm", "tsmc", "إنفيديا", "معالج", "رقائق", "شرائح",
        "iphone", "android", "smartphone", "galaxy", "pixel", "ipad", "macbook", "laptop", "آيفون", "أندرويد", "هاتف", "هواتف", "جالكسي",
        "apple", "google", "microsoft", "meta", "amazon", "samsung", "tesla", "spacex", "huawei", "xiaomi", "آبل", "أبل", "جوجل", "غوغل", "مايكروسوفت", "ميتا", "أمازون", "سامسونج", "تسلا", "هواوي", "شاومي",
        "software", "app", "ios", "windows", "linux", "update", "developer", "github", "برمجيات", "تطبيق", "تحديث", "ويندوز",
        "cyber", "hack", "breach", "malware", "ransomware", "vulnerability", "الأمن السيبراني", "اختراق", "قرصنة", "ثغرة",
        "cloud", "aws", "azure", "data center", "سحابية", "مراكز البيانات", "twitter", "tiktok", "instagram", "youtube", "whatsapp", "telegram", "تويتر", "تيك توك", "إنستغرام", "يوتيوب", "واتساب",
        "bitcoin", "crypto", "blockchain", "بيتكوين", "العملات الرقمية", "playstation", "xbox", "nintendo", "gaming", "بلايستيشن",
        "vr", "metaverse", "vision pro", "الواقع الافتراضي", "الواقع المعزز", "5g", "6g", "wi-fi", "starlink", "ستارلينك", "electric vehicle", "self-driving", "القيادة الذاتية",
        "startup", "funding", "acquisition", "شركة ناشئة", "استحواذ", "tech", "technology", "digital", "computer", "internet", "تقنية", "التقنية", "تكنولوجيا", "التكنولوجيا", "رقمي", "الرقمية", "حاسوب", "كمبيوتر", "إنترنت"
    };

    public static boolean isTech(String title, String summary) {
        String hay = (title + " " + summary).toLowerCase(Locale.ROOT);
        for (String w : AI_WORDS) if (hay.contains(w)) return true;
        for (String w : TECH_WORDS) if (hay.contains(w)) return true;
        return false;
    }

    public static boolean isAi(String title, String summary) {
        String hay = (title + " " + summary).toLowerCase(Locale.ROOT);
        for (String w : AI_WORDS) if (hay.contains(w)) return true;
        return false;
    }

    public static String matchInterest(String title, String summary, JSONArray interests) {
        if (interests == null) return null;
        String hay = (title + " " + summary).toLowerCase(Locale.ROOT);
        for (int i = 0; i < interests.length(); i++) {
            String w = interests.optString(i, "").trim();
            if (!w.isEmpty() && hay.contains(w.toLowerCase(Locale.ROOT))) return w;
        }
        return null;
    }

    public static boolean isMuted(String title, String summary, JSONArray muted) {
        return matchInterest(title, summary, muted) != null;
    }
}
