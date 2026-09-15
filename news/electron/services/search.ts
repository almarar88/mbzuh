/**
 * بحث الويب بلا مفتاح: Bing (RSS) للبحث العام، وGoogle News (RSS) للأخبار،
 * وDuckDuckGo Lite كبديل أخير.
 */
import type { SearchResult } from "@shared/types";
import { fetchText } from "./http";
import { parseFeed } from "./rss";
import { decodeEntities, stripHtml } from "./text";
import { fetchGoogleNews } from "./gnews";

export async function searchBing(query: string, limit = 10): Promise<SearchResult[]> {
  const r = await fetchText(`https://www.bing.com/search?q=${encodeURIComponent(query)}&format=rss&count=${limit}`, { timeoutMs: 15000 });
  if (r.status !== 200 || !r.text.includes("<rss")) throw new Error(`Bing ردّ بالحالة ${r.status}`);
  const feed = parseFeed(r.text, "https://www.bing.com");
  return feed.items.slice(0, limit).map((it) => ({
    title: it.title,
    url: it.url,
    snippet: stripHtml(it.summaryHtml).slice(0, 400),
    source: safeHost(it.url),
    publishedAt: null,
  }));
}

export async function searchDuckDuckGo(query: string, limit = 10): Promise<SearchResult[]> {
  const r = await fetchText(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`, { timeoutMs: 15000 });
  if (r.status >= 400) throw new Error(`DuckDuckGo ردّ بالحالة ${r.status}`);
  const out: SearchResult[] = [];
  const re = /<a[^>]+class="result-link"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<td[^>]+class="result-snippet"[^>]*>([\s\S]*?)<\/td>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(r.text)) && out.length < limit) {
    let url = decodeEntities(m[1]);
    const uddg = /uddg=([^&]+)/.exec(url);
    if (uddg) url = decodeURIComponent(uddg[1]);
    if (!url.startsWith("http")) continue;
    out.push({ title: stripHtml(m[2]), url, snippet: stripHtml(m[3]).slice(0, 400), source: safeHost(url), publishedAt: null });
  }
  return out;
}

export async function searchNews(query: string, lang: "ar" | "en" = "ar", limit = 10): Promise<SearchResult[]> {
  const items = await fetchGoogleNews(query, lang);
  return items.slice(0, limit).map((it) => ({
    title: it.title,
    url: it.url,
    snippet: stripHtml(it.summaryHtml).slice(0, 400),
    source: it.author ?? "Google News",
    publishedAt: it.publishedAt,
  }));
}

export async function searchWeb(query: string, limit = 10): Promise<{ results: SearchResult[]; engine: string }> {
  const errors: string[] = [];
  try {
    const results = await searchBing(query, limit);
    if (results.length) return { results, engine: "bing" };
  } catch (e) {
    errors.push((e as Error).message);
  }
  try {
    const results = await searchDuckDuckGo(query, limit);
    if (results.length) return { results, engine: "duckduckgo" };
  } catch (e) {
    errors.push((e as Error).message);
  }
  throw new Error(`تعذّر البحث في الويب: ${errors.join(" | ") || "لا نتائج"}`);
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
