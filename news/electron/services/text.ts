/** أدوات نصية: كشف اللغة، تنظيف HTML، تجزئة، تطبيع الروابط. */
import { createHash } from "node:crypto";
import type { Lang } from "@shared/types";

export function detectLang(text: string): Lang {
  const sample = (text || "").slice(0, 2000);
  const arabic = (sample.match(/[؀-ۿ]/g) ?? []).length;
  const latin = (sample.match(/[A-Za-z]/g) ?? []).length;
  if (arabic === 0 && latin === 0) return "other";
  if (arabic > latin * 0.6) return "ar";
  if (latin > 0) return "en";
  return "other";
}

export function isArabic(text: string): boolean {
  return detectLang(text) === "ar";
}

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", mdash: "—", ndash: "–",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", copy: "©", laquo: "«", raquo: "»",
};

export function decodeEntities(s: string): string {
  return (s || "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n: string) => ENTITIES[n.toLowerCase()] ?? m);
}

export function stripHtml(html: string): string {
  return decodeEntities(
    (html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6]|blockquote|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\r\f\v]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

export function firstImageFromHtml(html: string, base?: string): string | null {
  const m = /<img[^>]+src=["']([^"']+)["']/i.exec(html || "");
  if (!m) return null;
  return absolutize(m[1], base);
}

export function absolutize(url: string, base?: string): string | null {
  try {
    if (!url) return null;
    if (url.startsWith("data:")) return null;
    return new URL(url, base).toString();
  } catch {
    return null;
  }
}

/** يزيل معاملات التتبع ويطبّع الرابط للمقارنة. */
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    const drop = [/^utm_/i, /^fbclid$/i, /^gclid$/i, /^ref$/i, /^source$/i, /^mc_/i, /^igshid$/i, /^_hs/i];
    for (const key of [...u.searchParams.keys()]) {
      if (drop.some((re) => re.test(key))) u.searchParams.delete(key);
    }
    u.hash = "";
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    let s = u.toString();
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s;
  } catch {
    return url.trim();
  }
}

export function sha1(s: string): string {
  return createHash("sha1").update(s).digest("hex");
}

export function normalizeTitle(t: string): string {
  return (t || "")
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncate(s: string, n: number): string {
  if (!s) return "";
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

export function toIso(d: unknown): string {
  if (!d) return new Date().toISOString();
  if (typeof d === "number") return new Date(d < 1e12 ? d * 1000 : d).toISOString();
  const t = Date.parse(String(d));
  return Number.isNaN(t) ? new Date().toISOString() : new Date(t).toISOString();
}

/** يقسّم نصًا طويلًا إلى مقاطع لا تتجاوز حدًا معينًا مع احترام الفقرات والجمل. */
export function chunkText(text: string, max: number): string[] {
  const out: string[] = [];
  let buf = "";
  for (const para of text.split(/\n{2,}/)) {
    if (para.length > max) {
      for (const sentence of para.split(/(?<=[.!?؟۔])\s+/)) {
        if ((buf + " " + sentence).length > max && buf) {
          out.push(buf.trim());
          buf = "";
        }
        buf += (buf ? " " : "") + sentence;
      }
      buf += "\n\n";
      continue;
    }
    if ((buf + "\n\n" + para).length > max && buf) {
      out.push(buf.trim());
      buf = "";
    }
    buf += (buf ? "\n\n" : "") + para;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}
