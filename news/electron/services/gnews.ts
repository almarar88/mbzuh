/**
 * أخبار Google بالعربية: خلاصة بحث RSS مع فكّ روابط news.google.com إلى
 * الرابط الأصلي للمقال عبر نقطة batchexecute (أفضل جهد؛ عند الفشل يُترك رابط Google).
 */
import { fetchText } from "./http";
import { parseFeed, type FeedItem } from "./rss";

export function gnewsSearchUrl(query: string, lang: "ar" | "en" = "ar"): string {
  const ceid = lang === "ar" ? "SA:ar" : "US:en";
  const gl = lang === "ar" ? "SA" : "US";
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${lang}&gl=${gl}&ceid=${ceid}`;
}

export async function fetchGoogleNews(query: string, lang: "ar" | "en" = "ar"): Promise<FeedItem[]> {
  const r = await fetchText(gnewsSearchUrl(query, lang), { timeoutMs: 20000 });
  if (r.status !== 200) throw new Error(`Google News ردّ بالحالة ${r.status}`);
  const feed = parseFeed(r.text, "https://news.google.com");
  return feed.items.map((it) => ({
    ...it,
    // العنوان يأتي بصيغة "العنوان - اسم الصحيفة"
    title: it.title.replace(/\s+-\s+[^-]+$/, "").trim() || it.title,
    author: it.title.match(/\s+-\s+([^-]+)$/)?.[1]?.trim() ?? it.author,
  }));
}

const cache = new Map<string, string>();

/** يفكّ رابط news.google.com/rss/articles/... إلى الرابط الأصلي. */
export async function decodeGoogleNewsUrl(url: string): Promise<string> {
  if (!/news\.google\.com\/rss\/articles\//.test(url)) return url;
  const hit = cache.get(url);
  if (hit) return hit;
  const id = url.split("/articles/")[1]?.split("?")[0];
  if (!id) return url;
  try {
    const page = await fetchText(url, { timeoutMs: 15000 });
    const sg = /data-n-a-sg="([^"]+)"/.exec(page.text)?.[1];
    const ts = /data-n-a-ts="([^"]+)"/.exec(page.text)?.[1];
    if (!sg || !ts) return url;
    const inner = JSON.stringify([
      "garturlreq",
      [["X", "X", ["X", "X"], null, null, 1, 1, "US:en", null, 1, null, null, null, null, null, 0, 1], "X", "X", 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0],
      id,
      Number(ts),
      sg,
    ]);
    const payload = JSON.stringify([[["Fbv4je", inner, null, "generic"]]]);
    const res = await fetchText("https://news.google.com/_/DotsSplashUi/data/batchexecute", {
      method: "POST",
      timeoutMs: 15000,
      headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: "f.req=" + encodeURIComponent(payload),
    });
    const m = /garturlres\\",\\"(https?:[^\\"]+)/.exec(res.text) ?? /"garturlres","(https?:[^"]+)"/.exec(res.text);
    if (!m) return url;
    const decoded = m[1].replace(/\\\//g, "/");
    cache.set(url, decoded);
    return decoded;
  } catch {
    return url;
  }
}
