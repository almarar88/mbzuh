/**
 * جلب تغريدات حساب على X (تويتر). ثلاث طبقات بالترتيب:
 *  1) واجهة X API v2 إذا وُجد Bearer Token في الإعدادات (الأكثر موثوقية).
 *  2) نقطة النشر العامة syndication.twitter.com (بلا مفتاح، قد تُحجب أحيانًا).
 *  3) مرايا Nitter عبر RSS (أفضل جهد).
 */
import { fetchJson, fetchText } from "./http";
import { parseFeed } from "./rss";
import { stripHtml, toIso } from "./text";

export interface Tweet {
  id: string;
  handle: string;
  name: string;
  text: string;
  url: string;
  createdAt: string;
  likes: number;
  retweets: number;
  replies: number;
  images: string[];
  links: string[];
}

const NITTER_HOSTS = ["nitter.net", "nitter.privacydev.net", "nitter.poast.org", "nitter.space", "xcancel.com"];

function expandLinks(text: string, entities: { urls?: { url: string; expanded_url?: string }[] } | undefined): { text: string; links: string[] } {
  let out = text;
  const links: string[] = [];
  for (const u of entities?.urls ?? []) {
    if (u.expanded_url) {
      out = out.replace(u.url, u.expanded_url);
      if (!/twitter\.com|x\.com/.test(u.expanded_url)) links.push(u.expanded_url);
    }
  }
  return { text: out, links };
}

async function viaApi(handle: string, bearer: string, limit: number): Promise<Tweet[]> {
  const headers = { authorization: `Bearer ${bearer}` };
  const user = await fetchJson<{ data?: { id: string; name: string; username: string } }>(
    `https://api.twitter.com/2/users/by/username/${encodeURIComponent(handle)}`,
    { headers },
  );
  if (!user.data?.data?.id) throw new Error(`X API: تعذّر إيجاد الحساب @${handle} (${user.status})`);
  const q = new URLSearchParams({
    max_results: String(Math.min(Math.max(limit, 5), 100)),
    exclude: "replies,retweets",
    "tweet.fields": "created_at,public_metrics,entities,attachments",
    expansions: "attachments.media_keys",
    "media.fields": "url,preview_image_url,type",
  });
  const tl = await fetchJson<{
    data?: { id: string; text: string; created_at: string; public_metrics?: Record<string, number>; entities?: { urls?: { url: string; expanded_url?: string }[] }; attachments?: { media_keys?: string[] } }[];
    includes?: { media?: { media_key: string; url?: string; preview_image_url?: string }[] };
  }>(`https://api.twitter.com/2/users/${user.data.data.id}/tweets?${q}`, { headers });
  if (tl.status !== 200) throw new Error(`X API ردّ بالحالة ${tl.status}`);
  const media = new Map((tl.data?.includes?.media ?? []).map((m) => [m.media_key, m.url ?? m.preview_image_url ?? ""]));
  return (tl.data?.data ?? []).map((t) => {
    const { text, links } = expandLinks(t.text, t.entities);
    return {
      id: t.id,
      handle,
      name: user.data!.data!.name,
      text,
      url: `https://x.com/${handle}/status/${t.id}`,
      createdAt: toIso(t.created_at),
      likes: t.public_metrics?.like_count ?? 0,
      retweets: t.public_metrics?.retweet_count ?? 0,
      replies: t.public_metrics?.reply_count ?? 0,
      images: (t.attachments?.media_keys ?? []).map((k) => media.get(k) ?? "").filter(Boolean),
      links,
    };
  });
}

interface SyndicationTweet {
  id_str: string;
  full_text?: string;
  text?: string;
  created_at: string;
  favorite_count?: number;
  retweet_count?: number;
  reply_count?: number;
  entities?: { urls?: { url: string; expanded_url?: string }[]; media?: { media_url_https?: string }[] };
  user?: { name?: string; screen_name?: string };
}

async function viaSyndication(handle: string): Promise<Tweet[]> {
  const r = await fetchText(`https://syndication.twitter.com/srv/timeline-profile/screen-name/${encodeURIComponent(handle)}`, {
    timeoutMs: 20000,
  });
  if (r.status !== 200) throw new Error(`syndication ردّ بالحالة ${r.status}`);
  const m = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/.exec(r.text);
  if (!m) throw new Error("syndication: لم يُعثر على بيانات الجدول الزمني");
  const data = JSON.parse(m[1]) as { props?: { pageProps?: { timeline?: { entries?: { content?: { tweet?: SyndicationTweet } }[] } } } };
  const entries = data.props?.pageProps?.timeline?.entries ?? [];
  const out: Tweet[] = [];
  for (const e of entries) {
    const t = e.content?.tweet;
    if (!t?.id_str) continue;
    const { text, links } = expandLinks(t.full_text ?? t.text ?? "", t.entities);
    out.push({
      id: t.id_str,
      handle: t.user?.screen_name ?? handle,
      name: t.user?.name ?? handle,
      text,
      url: `https://x.com/${t.user?.screen_name ?? handle}/status/${t.id_str}`,
      createdAt: toIso(t.created_at),
      likes: t.favorite_count ?? 0,
      retweets: t.retweet_count ?? 0,
      replies: t.reply_count ?? 0,
      images: (t.entities?.media ?? []).map((mm) => mm.media_url_https ?? "").filter(Boolean),
      links,
    });
  }
  if (out.length === 0) throw new Error("syndication: لا تغريدات");
  return out;
}

async function viaNitter(handle: string): Promise<Tweet[]> {
  let lastErr = "";
  for (const host of NITTER_HOSTS) {
    try {
      const r = await fetchText(`https://${host}/${encodeURIComponent(handle)}/rss`, { timeoutMs: 12000 });
      if (r.status !== 200 || !r.text.includes("<rss")) {
        lastErr = `${host}: ${r.status}`;
        continue;
      }
      const feed = parseFeed(r.text, `https://${host}`);
      return feed.items.map((it) => {
        const id = it.url.split("/status/")[1]?.split(/[#?]/)[0] ?? it.url;
        const html = it.contentHtml || it.summaryHtml;
        const images = [...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map((mm) => mm[1].replace(/^https?:\/\/[^/]+\/pic\//, "https://pbs.twimg.com/").replace(/%2F/g, "/"));
        const links = [...html.matchAll(/href="(https?:\/\/(?!(?:[^/]*nitter|x\.com|twitter\.com))[^"]+)"/g)].map((mm) => mm[1]);
        return {
          id,
          handle,
          name: feed.title.replace(/\s*\/.*$/, "") || handle,
          text: stripHtml(html),
          url: `https://x.com/${handle}/status/${id}`,
          createdAt: it.publishedAt,
          likes: 0,
          retweets: 0,
          replies: 0,
          images,
          links,
        };
      });
    } catch (e) {
      lastErr = `${host}: ${(e as Error).message}`;
    }
  }
  throw new Error(`تعذّر الوصول إلى مرايا Nitter (${lastErr})`);
}

export async function fetchXTimeline(handle: string, bearer: string, limit = 20): Promise<{ tweets: Tweet[]; via: string }> {
  const h = handle.replace(/^@/, "").trim();
  const errors: string[] = [];
  if (bearer) {
    try {
      return { tweets: await viaApi(h, bearer, limit), via: "api" };
    } catch (e) {
      errors.push((e as Error).message);
    }
  }
  try {
    return { tweets: (await viaSyndication(h)).slice(0, limit), via: "syndication" };
  } catch (e) {
    errors.push((e as Error).message);
  }
  try {
    return { tweets: (await viaNitter(h)).slice(0, limit), via: "nitter" };
  } catch (e) {
    errors.push((e as Error).message);
  }
  throw new Error(`تعذّر جلب @${h}: ${errors.join(" | ")}`);
}
