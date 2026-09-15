/**
 * جلب صفحة مقال واستخلاص المحتوى القابل للقراءة (Readability) مع الصور
 * والبيانات الوصفية، وتعقيم HTML قبل عرضه في الواجهة.
 */
import { Readability } from "@mozilla/readability";
import { getPlatform } from "../platform";
import { fetchText } from "./http";
import { absolutize, cleanText, decodeEntities, stripHtml, toIso } from "./text";

export interface PageExtract {
  url: string;
  title: string;
  byline: string | null;
  siteName: string | null;
  excerpt: string;
  contentHtml: string;
  contentText: string;
  imageUrl: string | null;
  images: string[];
  publishedAt: string | null;
  lang: string | null;
}

const ALLOWED_TAGS = new Set([
  "p", "br", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "pre", "code",
  "strong", "b", "em", "i", "u", "s", "a", "img", "figure", "figcaption", "table", "thead", "tbody",
  "tr", "td", "th", "hr", "span", "div", "section", "article", "sup", "sub", "small", "mark", "cite", "video", "source",
]);
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title"]),
  img: new Set(["src", "alt", "title", "width", "height"]),
  video: new Set(["src", "poster", "controls"]),
  source: new Set(["src", "type"]),
  td: new Set(["colspan", "rowspan"]),
  th: new Set(["colspan", "rowspan"]),
};

interface DomLike {
  nodeType: number;
  tagName?: string;
  childNodes: DomLike[];
  attributes?: { name: string; value: string }[];
  getAttribute(n: string): string | null;
  setAttribute(n: string, v: string): void;
  removeAttribute(n: string): void;
  replaceWith(...n: DomLike[]): void;
  remove(): void;
  textContent: string | null;
  ownerDocument: { createTextNode(s: string): DomLike; createElement(t: string): DomLike };
  innerHTML?: string;
  outerHTML?: string;
  parentNode?: DomLike | null;
  querySelectorAll?(sel: string): DomLike[];
}

function sanitizeNode(node: DomLike, base: string, images: string[]): void {
  for (const child of [...node.childNodes]) {
    if (child.nodeType === 8) {
      child.remove();
      continue;
    }
    if (child.nodeType !== 1) continue;
    const tag = (child.tagName ?? "").toLowerCase();
    if (["script", "style", "iframe", "object", "embed", "form", "input", "button", "noscript", "svg", "canvas", "link", "meta"].includes(tag)) {
      child.remove();
      continue;
    }
    if (!ALLOWED_TAGS.has(tag)) {
      // عنصر غير مسموح: نستبدله بحاوية محايدة تحتفظ بمحتواه ثم نعقّمها
      const replacement = child.ownerDocument.createElement("div");
      replacement.innerHTML = child.innerHTML ?? "";
      child.replaceWith(replacement);
      sanitizeNode(replacement, base, images);
      continue;
    }
    for (const attr of [...(child.attributes ?? [])]) {
      const name = attr.name.toLowerCase();
      const allowed = ALLOWED_ATTRS[tag];
      if (name.startsWith("on") || !allowed || !allowed.has(name)) {
        child.removeAttribute(attr.name);
        continue;
      }
      if (name === "href" || name === "src" || name === "poster") {
        const abs = absolutize(attr.value, base);
        if (!abs || !/^https?:/.test(abs)) child.removeAttribute(attr.name);
        else child.setAttribute(attr.name, abs);
      }
    }
    if (tag === "img") {
      const srcset = child.getAttribute("srcset");
      let src = child.getAttribute("src") ?? child.getAttribute("data-src");
      if (!src && srcset) src = srcset.split(",")[0]?.trim().split(" ")[0] ?? null;
      const abs = src ? absolutize(src, base) : null;
      if (!abs || !/^https?:/.test(abs)) {
        child.remove();
        continue;
      }
      child.setAttribute("src", abs);
      child.setAttribute("loading", "lazy");
      child.setAttribute("referrerpolicy", "no-referrer");
      if (!images.includes(abs)) images.push(abs);
    }
    if (tag === "a") {
      child.setAttribute("target", "_blank");
      child.setAttribute("rel", "noopener noreferrer");
    }
    sanitizeNode(child, base, images);
  }
}

export function sanitizeHtml(html: string, base: string): { html: string; images: string[] } {
  const document = getPlatform().parseHtml(`<!doctype html><html><head><base href="${base.replace(/"/g, "&quot;")}"></head><body><div id="root">${html}</div></body></html>`);
  const root = document.getElementById("root") as unknown as DomLike;
  const images: string[] = [];
  sanitizeNode(root, base, images);
  return { html: root.innerHTML ?? "", images };
}

interface LdArticle {
  headline?: string;
  articleBody?: string;
  image?: string | string[] | { url?: string } | { url?: string }[];
  datePublished?: string;
  author?: { name?: string } | { name?: string }[] | string;
  description?: string;
}

/** يقرأ بيانات NewsArticle/Article من JSON-LD (مفيد للمواقع التي تُصيّر المحتوى بجافاسكربت). */
function jsonLdArticle(document: Document): LdArticle | null {
  for (const s of Array.from(document.querySelectorAll('script[type="application/ld+json"]'))) {
    try {
      const data = JSON.parse(s.textContent ?? "") as unknown;
      const queue: unknown[] = Array.isArray(data) ? [...data] : [data];
      while (queue.length) {
        const item = queue.shift();
        if (!item || typeof item !== "object") continue;
        const o = item as Record<string, unknown>;
        if (Array.isArray(o["@graph"])) queue.push(...(o["@graph"] as unknown[]));
        const type = String(o["@type"] ?? "");
        if (/Article|BlogPosting|NewsArticle/i.test(type) && typeof o.articleBody === "string" && o.articleBody.length > 100) return o as LdArticle;
      }
    } catch {
      /* JSON غير صالح */
    }
  }
  return null;
}

function ldImage(img: LdArticle["image"]): string | null {
  if (!img) return null;
  if (typeof img === "string") return img;
  if (Array.isArray(img)) return ldImage(img[0] as LdArticle["image"]);
  return typeof img.url === "string" ? img.url : null;
}

function ldAuthor(a: LdArticle["author"]): string | null {
  if (!a) return null;
  if (typeof a === "string") return a;
  if (Array.isArray(a)) return a.map((x) => x?.name).filter(Boolean).join("، ") || null;
  return a.name ?? null;
}

function textToHtml(text: string): string {
  return text
    .split(/\n{2,}|\r\n\r\n|(?<=[.!?؟])\s{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`)
    .join("");
}

function meta(document: Document, names: string[]): string | null {
  for (const n of names) {
    const el = document.querySelector(`meta[property="${n}"], meta[name="${n}"]`);
    const c = el?.getAttribute("content");
    if (c) return decodeEntities(c.trim());
  }
  return null;
}

export async function extractPage(url: string): Promise<PageExtract> {
  const r = await fetchText(url, { timeoutMs: 25000, maxBytes: 4 * 1024 * 1024 });
  if (r.status >= 400) throw new Error(`الموقع ردّ بالحالة ${r.status}`);
  if (!/html|xml/i.test(r.contentType) && !/^\s*</.test(r.text)) throw new Error("الصفحة ليست HTML");
  return extractFromHtml(r.text, r.url || url);
}

export function extractFromHtml(html: string, finalUrl: string): PageExtract {
  // نحقن <base> كي يحوّل Readability والمتصفح الروابط النسبية إلى مطلقة
  const baseTag = `<base href="${finalUrl.replace(/"/g, "&quot;")}">`;
  const withBase = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + baseTag) : baseTag + html;
  const docAny = getPlatform().parseHtml(withBase);
  try {
    Object.defineProperty(docAny, "baseURI", { value: finalUrl, configurable: true });
  } catch {
    /* المتصفح لا يسمح بذلك؛ يكفي وسم base */
  }
  const ogImage = meta(docAny, ["og:image", "og:image:url", "twitter:image", "twitter:image:src"]);
  const description = meta(docAny, ["og:description", "description", "twitter:description"]);
  const published = meta(docAny, ["article:published_time", "og:updated_time", "date", "pubdate", "datePublished", "sailthru.date"]) ?? docAny.querySelector("time[datetime]")?.getAttribute("datetime") ?? null;
  const siteName = meta(docAny, ["og:site_name", "application-name"]);
  const lang = docAny.documentElement?.getAttribute("lang") ?? null;
  const ogTitle = meta(docAny, ["og:title", "twitter:title"]);

  let article: { title?: string | null; byline?: string | null; content?: string | null; textContent?: string | null; excerpt?: string | null; siteName?: string | null } | null = null;
  try {
    article = new Readability(docAny, { charThreshold: 200 }).parse();
  } catch {
    article = null;
  }
  let rawHtml = article?.content ?? "";
  let contentText = article?.textContent?.trim() || stripHtml(rawHtml);
  let ldByline: string | null = null;
  let ldDate: string | null = null;
  let ldImg: string | null = null;
  if (contentText.length < 400) {
    // بديل 1: JSON-LD articleBody
    const ld = jsonLdArticle(docAny);
    if (ld?.articleBody && ld.articleBody.length > contentText.length) {
      rawHtml = textToHtml(ld.articleBody);
      contentText = ld.articleBody.trim();
      ldByline = ldAuthor(ld.author);
      ldDate = ld.datePublished ?? null;
      ldImg = ldImage(ld.image);
    }
  }
  if (contentText.length < 400) {
    // بديل 2: أكبر حاوية <article> أو حاوية محتوى شائعة
    const candidates = Array.from(docAny.querySelectorAll('article, [itemprop="articleBody"], .article-body, .entry-content, .post-content, .article-content, .content-article, main'));
    let best: { html: string; text: string } | null = null;
    for (const el of candidates) {
      const html = (el as HTMLElement).innerHTML ?? "";
      const text = stripHtml(html);
      if (text.length > (best?.text.length ?? 0)) best = { html, text };
    }
    if (best && best.text.length > contentText.length) {
      rawHtml = best.html;
      contentText = best.text;
    }
  }
  const { html: contentHtml, images } = sanitizeHtml(rawHtml, finalUrl);
  // النص يُشتق من HTML المعقَّم كي تكون الفقرات نظيفة (Readability يترك فراغات وأسطرًا كثيرة)
  contentText = cleanText(stripHtml(contentHtml) || contentText);
  const absOg = ogImage ? absolutize(ogImage, finalUrl) : ldImg ? absolutize(ldImg, finalUrl) : null;
  const allImages = absOg && !images.includes(absOg) ? [absOg, ...images] : images;
  return {
    url: finalUrl,
    title: (article?.title || ogTitle || docAny.title || "").trim(),
    byline: article?.byline?.trim() || ldByline || meta(docAny, ["author", "article:author"]) || null,
    siteName: article?.siteName || siteName || null,
    excerpt: (article?.excerpt || description || "").trim(),
    contentHtml,
    contentText,
    imageUrl: absOg ?? images[0] ?? null,
    images: allImages.slice(0, 12),
    publishedAt: published || ldDate ? toIso(published ?? ldDate) : null,
    lang,
  };
}
