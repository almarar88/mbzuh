/**
 * جلب منشورات Reddit. يُجرَّب JSON العام أولًا (يعمل من أجهزة المستخدمين مع
 * وكيل متصفح)، ثم خلاصة RSS الرسمية كبديل عند الحجب أو تجاوز الحد.
 */
import { fetchJson, fetchText } from "./http";
import { parseFeed } from "./rss";
import { stripHtml, toIso } from "./text";

export interface RedditPost {
  id: string;
  title: string;
  url: string;
  permalink: string;
  selftext: string;
  selftextHtml: string;
  author: string;
  subreddit: string;
  ups: number;
  numComments: number;
  createdAt: string;
  imageUrl: string | null;
  isSelf: boolean;
  domain: string;
  flair: string | null;
}

interface RedditListing {
  data?: { children?: { data: Record<string, unknown> }[] };
}

const UA_HEADERS = { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) TechPulse/1.0 (news reader)" };

function previewImage(d: Record<string, unknown>): string | null {
  const preview = d.preview as { images?: { source?: { url?: string } }[] } | undefined;
  const src = preview?.images?.[0]?.source?.url;
  if (src) return src.replace(/&amp;/g, "&");
  const url = String(d.url ?? "");
  if (/\.(jpe?g|png|gif|webp)(\?|$)/i.test(url)) return url;
  const thumb = String(d.thumbnail ?? "");
  if (thumb.startsWith("http")) return thumb;
  return null;
}

function mapPost(d: Record<string, unknown>): RedditPost {
  const permalink = `https://www.reddit.com${String(d.permalink ?? "")}`;
  const isSelf = Boolean(d.is_self);
  const url = String(d.url ?? permalink);
  return {
    id: String(d.id ?? ""),
    title: String(d.title ?? ""),
    url: isSelf || !url.startsWith("http") ? permalink : url,
    permalink,
    selftext: String(d.selftext ?? ""),
    selftextHtml: String(d.selftext_html ?? ""),
    author: String(d.author ?? ""),
    subreddit: String(d.subreddit ?? ""),
    ups: Number(d.ups ?? d.score ?? 0),
    numComments: Number(d.num_comments ?? 0),
    createdAt: toIso(Number(d.created_utc ?? 0) || undefined),
    imageUrl: previewImage(d),
    isSelf,
    domain: String(d.domain ?? ""),
    flair: (d.link_flair_text as string | null) ?? null,
  };
}

async function fetchListing(url: string): Promise<RedditPost[] | null> {
  const r = await fetchJson<RedditListing>(url, { headers: UA_HEADERS, timeoutMs: 20000 });
  if (r.status !== 200 || !r.data?.data?.children) return null;
  return r.data.data.children.map((c) => mapPost(c.data)).filter((p) => p.title && !p.title.startsWith("[removed]"));
}

async function fetchRss(url: string, subreddit: string): Promise<RedditPost[]> {
  const r = await fetchText(url, { headers: UA_HEADERS, timeoutMs: 20000 });
  if (r.status !== 200) throw new Error(`Reddit ردّ بالحالة ${r.status}`);
  const feed = parseFeed(r.text, "https://www.reddit.com");
  return feed.items.map((it) => {
    const html = it.contentHtml || it.summaryHtml;
    const ext = /<a href="(https?:\/\/(?!www\.reddit\.com)[^"]+)">\[link\]/.exec(html)?.[1];
    const id = it.guid?.split("_").pop() ?? it.url;
    return {
      id,
      title: it.title,
      url: ext ?? it.url,
      permalink: it.url,
      selftext: stripHtml(html).replace(/submitted by.*$/s, "").trim(),
      selftextHtml: html,
      author: it.author?.replace(/^\/u\//, "") ?? "",
      subreddit,
      ups: 0,
      numComments: 0,
      createdAt: it.publishedAt,
      imageUrl: it.imageUrl,
      isSelf: !ext,
      domain: ext ? new URL(ext).hostname : "reddit.com",
      flair: null,
    };
  });
}

export async function fetchSubreddit(subreddit: string, sort: "hot" | "new" | "top" = "hot", limit = 30): Promise<RedditPost[]> {
  const sub = subreddit.replace(/^\/?r\//, "").trim();
  const t = sort === "top" ? "&t=day" : "";
  const json = await fetchListing(`https://www.reddit.com/r/${encodeURIComponent(sub)}/${sort}.json?limit=${limit}&raw_json=1${t}`);
  if (json) return json;
  return fetchRss(`https://www.reddit.com/r/${encodeURIComponent(sub)}/${sort === "hot" ? "" : sort + "/"}.rss${t ? "?t=day" : ""}`, sub);
}

export async function searchReddit(query: string, limit = 20): Promise<RedditPost[]> {
  const json = await fetchListing(`https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=new&limit=${limit}&raw_json=1`);
  if (json) return json;
  return fetchRss(`https://www.reddit.com/search.rss?q=${encodeURIComponent(query)}&sort=new`, "search");
}
