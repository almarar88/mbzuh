/**
 * محرّك التجميع: يجلب كل المصادر، يطبّع العناصر، يصنّفها، يزيل المكرر،
 * يخزّنها، ثم يجلب التفاصيل والصور ويترجم العناوين تلقائيًا.
 */
import { EventEmitter } from "node:events";
import type { Analysis, Article, RefreshProgress, Source } from "@shared/types";
import { nowIso } from "../db";
import { analyzeArticle } from "./analyze";
import {
  findByHash, getArticle, insertArticle, listSources, markSourceFetched, pendingDetails, pendingTranslation,
  pruneOld, titleExists, updateArticle, type NewArticle,
} from "./articles";
import { classify } from "./classify";
import { decodeGoogleNewsUrl, fetchGoogleNews } from "./gnews";
import { fetchText, mapLimit, sleep } from "./http";
import { fetchSubreddit } from "./reddit";
import { parseFeed } from "./rss";
import { loadSettings } from "./settings";
import { detectLang, firstImageFromHtml, normalizeTitle, normalizeUrl, sha1, stripHtml, truncate } from "./text";
import { translateToArabic } from "./translate";
import { extractPage, sanitizeHtml } from "./web";
import { fetchXTimeline } from "./x";

export interface RefreshSummary {
  added: number;
  sources: number;
  errors: { source: string; error: string }[];
  startedAt: string;
  finishedAt: string;
}

type Candidate = Omit<NewArticle, "hash" | "category" | "tags" | "lang" | "translated" | "titleAr" | "summaryAr"> & { lang?: string };

export class Aggregator extends EventEmitter {
  refreshing = false;
  lastRefreshAt: string | null = null;
  private detailsRunning = false;
  private translateRunning = false;

  private progress(p: RefreshProgress): void {
    this.emit("progress", p);
  }

  async refreshAll(sourceIds?: number[]): Promise<RefreshSummary> {
    if (this.refreshing) throw new Error("التحديث جارٍ بالفعل");
    this.refreshing = true;
    const startedAt = nowIso();
    const settings = loadSettings();
    const sources = listSources().filter((s) => s.enabled && (!sourceIds || sourceIds.includes(s.id)));
    const errors: RefreshSummary["errors"] = [];
    let added = 0;
    let done = 0;
    this.progress({ phase: "start", done: 0, total: sources.length, added: 0 });
    // Reddit وX يحدّان الطلبات لكل عنوان IP، لذا تُجلب مصادرهما تسلسليًا مع فاصل زمني.
    const throttled = new Set<string>(["reddit", "x"]);
    const lastCall = new Map<string, number>();
    const gate = async (kind: string): Promise<void> => {
      if (!throttled.has(kind)) return;
      const prev = lastCall.get(kind) ?? 0;
      const waitMs = Math.max(0, prev + 2000 - Date.now());
      lastCall.set(kind, Date.now() + waitMs);
      if (waitMs) await sleep(waitMs);
    };
    try {
      await mapLimit(sources, 5, async (source) => {
        try {
          await gate(source.kind);
          const candidates = await this.fetchSource(source, settings.xBearerToken);
          const n = this.store(source, candidates, settings.maxArticleAgeDays);
          added += n;
          markSourceFetched(source.id, null);
        } catch (e) {
          const msg = truncate((e as Error).message, 300);
          errors.push({ source: source.name, error: msg });
          markSourceFetched(source.id, msg);
        } finally {
          done += 1;
          this.progress({ phase: "source", sourceName: source.name, done, total: sources.length, added });
        }
      });
      pruneOld(settings.maxArticleAgeDays);
      this.lastRefreshAt = nowIso();
      this.progress({ phase: "done", done, total: sources.length, added });
    } finally {
      this.refreshing = false;
    }
    if (settings.autoTranslate) void this.translatePending();
    if (settings.autoFetchDetails) void this.fetchPendingDetails();
    return { added, sources: sources.length, errors, startedAt, finishedAt: nowIso() };
  }

  async fetchSource(source: Source, xBearer: string): Promise<Candidate[]> {
    switch (source.kind) {
      case "rss": {
        const r = await fetchText(source.target, { timeoutMs: 25000 });
        if (r.status >= 400) throw new Error(`الخلاصة ردّت بالحالة ${r.status}`);
        const feed = parseFeed(r.text, source.target);
        return feed.items.slice(0, 40).map((it) => {
          const html = it.contentHtml || it.summaryHtml;
          const text = stripHtml(html);
          const long = it.contentHtml && stripHtml(it.contentHtml).length > 600;
          return {
            sourceId: source.id,
            url: it.url,
            title: it.title,
            summary: truncate(stripHtml(it.summaryHtml) || text, 600) || null,
            contentHtml: long ? sanitizeHtml(it.contentHtml, it.url).html : null,
            contentText: long ? text : null,
            imageUrl: it.imageUrl ?? firstImageFromHtml(html, it.url),
            images: it.imageUrl ? [it.imageUrl] : [],
            author: it.author,
            publishedAt: it.publishedAt,
            score: 0,
            comments: 0,
            extra: { categories: it.categories.slice(0, 8) },
            detailsFetched: 0,
          };
        });
      }
      case "gnews": {
        const items = await fetchGoogleNews(source.target, source.lang === "en" ? "en" : "ar");
        return items.slice(0, 40).map((it) => ({
          sourceId: source.id,
          url: it.url,
          title: it.title,
          summary: truncate(stripHtml(it.summaryHtml).replace(/\s*Google News\s*$/i, ""), 400) || null,
          contentHtml: null,
          contentText: null,
          imageUrl: it.imageUrl,
          images: [],
          author: it.author,
          publishedAt: it.publishedAt,
          score: 0,
          comments: 0,
          extra: { publisher: it.author, gnews: true },
          detailsFetched: 0,
        }));
      }
      case "reddit": {
        const posts = await fetchSubreddit(source.target, "hot", 30);
        return posts.map((p) => ({
          sourceId: source.id,
          url: p.url,
          title: p.title,
          summary: truncate(p.selftext, 600) || null,
          contentHtml: p.isSelf && p.selftextHtml ? sanitizeHtml(p.selftextHtml, p.permalink).html : null,
          contentText: p.isSelf ? p.selftext : null,
          imageUrl: p.imageUrl,
          images: p.imageUrl ? [p.imageUrl] : [],
          author: p.author ? `u/${p.author}` : null,
          publishedAt: p.createdAt,
          score: p.ups,
          comments: p.numComments,
          extra: { subreddit: p.subreddit, permalink: p.permalink, isSelf: p.isSelf, domain: p.domain, flair: p.flair },
          detailsFetched: p.isSelf ? 1 : 0,
        }));
      }
      case "x": {
        const { tweets, via } = await fetchXTimeline(source.target, xBearer, 20);
        return tweets.map((t) => ({
          sourceId: source.id,
          url: t.url,
          title: truncate(t.text.replace(/\s+/g, " "), 180),
          summary: t.text,
          contentHtml: null,
          contentText: t.text,
          imageUrl: t.images[0] ?? null,
          images: t.images,
          author: `@${t.handle}`,
          publishedAt: t.createdAt,
          score: t.likes,
          comments: t.replies,
          extra: { handle: t.handle, name: t.name, links: t.links, retweets: t.retweets, via, externalUrl: t.links[0] ?? null },
          detailsFetched: t.links.length ? 0 : 1,
        }));
      }
      default:
        throw new Error(`نوع مصدر غير مدعوم: ${source.kind}`);
    }
  }

  /** يصنّف ويزيل المكرر ويخزّن، ويعيد عدد المقالات الجديدة. */
  private store(source: Source, candidates: Candidate[], maxAgeDays: number): number {
    const cutoff = Date.now() - maxAgeDays * 86400000;
    const dedupeSince = new Date(Date.now() - 3 * 86400000).toISOString();
    let added = 0;
    for (const c of candidates) {
      if (!c.title || !c.url) continue;
      if (Date.parse(c.publishedAt) < cutoff) continue;
      const body = c.contentText || c.summary || "";
      const cls = classify(c.title, body);
      if (!source.techOnly && !cls.isTech) continue;
      const hash = sha1(normalizeUrl(c.url));
      if (findByHash(hash)) continue;
      const nt = normalizeTitle(c.title);
      if (nt.length > 20 && titleExists(nt, dedupeSince)) continue;
      const lang = detectLang(c.title + " " + body);
      const id = insertArticle({
        ...c,
        hash,
        lang: lang === "other" ? source.lang : lang,
        category: cls.category,
        tags: cls.tags,
        titleAr: lang === "ar" ? c.title : null,
        summaryAr: lang === "ar" ? c.summary : null,
        translated: lang === "ar" ? 1 : 0,
        extra: { ...c.extra, nt },
      });
      if (id) added += 1;
    }
    return added;
  }

  /** يجلب تفاصيل المقال (النص الكامل والصور) من صفحته الأصلية. */
  async fetchDetails(articleId: number, force = false): Promise<Article> {
    const a = getArticle(articleId);
    if (!a) throw new Error("المقال غير موجود");
    if (a.detailsFetched && !force) return a;
    let url = a.url;
    try {
      if (a.extra.gnews) {
        url = await decodeGoogleNewsUrl(a.url);
        if (url !== a.url) updateArticle(articleId, { url });
      } else if (a.sourceKind === "x" && typeof a.extra.externalUrl === "string") {
        url = a.extra.externalUrl;
      }
      if (/news\.google\.com\/rss\/articles/.test(url)) throw new Error("تعذّر فكّ رابط Google News");
      const page = await extractPage(url);
      const contentOk = page.contentText.length > (a.contentText?.length ?? 0) * 0.8 && page.contentText.length > 200;
      const images = [...new Set([...(page.images ?? []), ...a.images])].slice(0, 12);
      const patch: Record<string, unknown> = {
        details_fetched: 1,
        details_error: null,
        images,
        image_url: a.imageUrl ?? page.imageUrl ?? images[0] ?? null,
      };
      if (contentOk) {
        patch.content_html = page.contentHtml;
        patch.content_text = page.contentText;
        patch.content_ar = null;
        const lang = detectLang(page.contentText);
        if (lang !== "other") patch.lang = lang;
        if (lang === "ar") patch.content_ar = page.contentHtml;
      }
      if (!a.summary && page.excerpt) patch.summary = truncate(page.excerpt, 600);
      if (!a.author && page.byline) patch.author = truncate(page.byline, 120);
      if (a.sourceKind !== "x" && page.title && page.title.length > 8 && !a.extra.gnews && a.title.length < 20) patch.title = page.title;
      const cls = classify(a.title, page.contentText);
      if (cls.tags.length > a.tags.length) patch.tags = cls.tags;
      if (a.category === "tech" && cls.category === "ai") patch.category = "ai";
      updateArticle(articleId, patch);
    } catch (e) {
      updateArticle(articleId, { details_error: truncate((e as Error).message, 300) });
    }
    return getArticle(articleId) as Article;
  }

  async fetchPendingDetails(limit = 40): Promise<void> {
    if (this.detailsRunning) return;
    this.detailsRunning = true;
    try {
      const pending = pendingDetails(limit);
      let done = 0;
      await mapLimit(pending, 4, async (a) => {
        await this.fetchDetails(a.id);
        done += 1;
        this.progress({ phase: "details", done, total: pending.length, added: 0, sourceName: a.sourceName });
      });
    } finally {
      this.detailsRunning = false;
    }
  }

  /** يترجم العنوان والملخص (وإن طُلب: المحتوى الكامل). */
  async translateArticle(articleId: number, includeContent = false): Promise<Article> {
    const a = getArticle(articleId);
    if (!a) throw new Error("المقال غير موجود");
    const patch: Record<string, unknown> = {};
    if (!a.titleAr) patch.title_ar = (await translateToArabic(a.title)).text;
    if (!a.summaryAr && a.summary) patch.summary_ar = (await translateToArabic(truncate(a.summary, 1200))).text;
    if (includeContent && !a.contentAr && a.contentText) {
      const provider = loadSettings().translationProvider;
      const text = truncate(a.contentText, provider === "llm" ? 30000 : 16000);
      const t = await translateToArabic(text);
      patch.content_ar = t.text
        .split(/\n{2,}/)
        .map((p) => `<p>${p.replace(/</g, "&lt;").replace(/\n/g, "<br/>")}</p>`)
        .join("");
    }
    patch.translated = 1;
    updateArticle(articleId, patch);
    return getArticle(articleId) as Article;
  }

  async translatePending(limit = 80): Promise<void> {
    if (this.translateRunning) return;
    this.translateRunning = true;
    try {
      const pending = pendingTranslation(limit);
      let done = 0;
      await mapLimit(pending, 2, async (a) => {
        try {
          await this.translateArticle(a.id, false);
        } catch {
          updateArticle(a.id, { translated: 2 });
        }
        done += 1;
        if (done % 5 === 0 || done === pending.length) this.progress({ phase: "translate", done, total: pending.length, added: 0 });
      });
    } finally {
      this.translateRunning = false;
    }
  }

  async analyze(articleId: number, force = false): Promise<Analysis> {
    let a = getArticle(articleId);
    if (!a) throw new Error("المقال غير موجود");
    if (a.analysis && !force && (a.analysis.engine === "llm" || !loadSettings().anthropicApiKey)) return a.analysis;
    if (!a.detailsFetched) a = await this.fetchDetails(articleId);
    const analysis = await analyzeArticle(a);
    updateArticle(articleId, { analysis });
    return analysis;
  }
}

export const aggregator = new Aggregator();
