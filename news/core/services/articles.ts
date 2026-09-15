/** مستودع المقالات والمصادر (استعلامات SQLite). */
import type { Analysis, AnalyticsData, Article, FeedQuery, FeedStats, Source, SourceKind, Trend } from "@shared/types";
import { loadSettings } from "./settings";
import { getDb, nowIso } from "../db";

function parseJson<T>(s: unknown, fallback: T): T {
  if (typeof s !== "string" || !s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function rowToArticle(r: any): Article {
  return {
    id: r.id,
    sourceId: r.source_id,
    sourceName: r.source_name ?? "",
    sourceKind: r.source_kind ?? "rss",
    url: r.url,
    title: r.title,
    titleAr: r.title_ar ?? null,
    summary: r.summary ?? null,
    summaryAr: r.summary_ar ?? null,
    contentHtml: r.content_html ?? null,
    contentText: r.content_text ?? null,
    contentAr: r.content_ar ?? null,
    lang: r.lang,
    category: r.category,
    tags: parseJson<string[]>(r.tags, []),
    imageUrl: r.image_url ?? null,
    images: parseJson<string[]>(r.images, []),
    author: r.author ?? null,
    publishedAt: r.published_at,
    fetchedAt: r.fetched_at,
    score: r.score ?? 0,
    comments: r.comments ?? 0,
    extra: parseJson<Record<string, unknown>>(r.extra, {}),
    translated: r.translated ?? 0,
    read: r.read ?? 0,
    saved: r.saved ?? 0,
    detailsFetched: r.details_fetched ?? 0,
    detailsError: r.details_error ?? null,
    analysis: parseJson<Analysis | null>(r.analysis, null),
    hash: r.hash,
  };
}

export function rowToSource(r: any): Source {
  return {
    id: r.id,
    kind: r.kind,
    name: r.name,
    target: r.target,
    lang: r.lang,
    enabled: r.enabled,
    techOnly: r.tech_only,
    builtin: r.builtin,
    lastFetchedAt: r.last_fetched_at ?? null,
    lastError: r.last_error ?? null,
    itemCount: r.item_count ?? 0,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const SELECT = `SELECT a.*, s.name AS source_name, s.kind AS source_kind FROM articles a JOIN sources s ON s.id = a.source_id`;
const LIST_COLUMNS = `a.id, a.source_id, a.url, a.hash, a.title, a.title_ar, a.summary, a.summary_ar, a.lang, a.category, a.tags, a.image_url, a.images, a.author, a.published_at, a.fetched_at, a.score, a.comments, a.extra, a.translated, a.read, a.saved, a.details_fetched, a.details_error, s.name AS source_name, s.kind AS source_kind`;

function keywordClause(words: string[], negate: boolean): { sql: string; params: unknown[] } | null {
  const ws = words.map((w) => w.trim()).filter(Boolean).slice(0, 30);
  if (!ws.length) return null;
  const parts = ws.map(() => "(a.title LIKE ? OR a.title_ar LIKE ? OR a.summary LIKE ? OR a.summary_ar LIKE ? OR a.tags LIKE ?)");
  const params = ws.flatMap((w) => Array(5).fill(`%${w}%`));
  return { sql: `${negate ? "NOT " : ""}(${parts.join(" OR ")})`, params };
}

export function listArticles(q: FeedQuery): Article[] {
  const where: string[] = [];
  const params: unknown[] = [];
  const settings = loadSettings();
  const muted = keywordClause(settings.mutedKeywords, true);
  if (muted && !q.savedOnly) {
    where.push(muted.sql);
    params.push(...muted.params);
  }
  if (q.interestsOnly) {
    const inter = keywordClause(settings.interests, false);
    if (inter) {
      where.push(inter.sql);
      params.push(...inter.params);
    } else {
      where.push("0");
    }
  }
  if (q.arabicOnly) where.push("a.lang = 'ar'");
  if (q.tag) {
    where.push("a.tags LIKE ?");
    params.push(`%${JSON.stringify(q.tag).slice(1, -1)}%`);
  }
  if (q.category && q.category !== "all") {
    where.push("a.category = ?");
    params.push(q.category);
  }
  if (q.kind && q.kind !== "all") {
    where.push("s.kind = ?");
    params.push(q.kind);
  }
  if (q.sourceId) {
    where.push("a.source_id = ?");
    params.push(q.sourceId);
  }
  if (q.savedOnly) where.push("a.saved = 1");
  if (q.unreadOnly) where.push("a.read = 0");
  if (q.search && q.search.trim()) {
    const terms = q.search.trim().split(/\s+/).slice(0, 6);
    for (const t of terms) {
      where.push("(a.title LIKE ? OR a.title_ar LIKE ? OR a.summary LIKE ? OR a.summary_ar LIKE ? OR a.tags LIKE ? OR a.content_text LIKE ?)");
      const like = `%${t}%`;
      params.push(like, like, like, like, like, like);
    }
  }
  const order =
    q.sort === "popular"
      ? "a.score DESC, a.comments DESC, a.published_at DESC"
      : q.sort === "trending"
        ? "(a.score * 0.02 + a.comments * 0.05 + (CASE WHEN a.category = 'ai' THEN 1 ELSE 0 END) + (length(a.tags) / 40.0) - (julianday('now') - julianday(a.published_at)) * 2) DESC"
        : "a.published_at DESC";
  const sql = `SELECT ${LIST_COLUMNS} FROM articles a JOIN sources s ON s.id = a.source_id ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY ${order} LIMIT ? OFFSET ?`;
  params.push(Math.min(q.limit ?? 60, 300), q.offset ?? 0);
  return getDb().prepare(sql).all(...params).map(rowToArticle);
}

export function getArticle(id: number): Article | null {
  const row = getDb().prepare(`${SELECT} WHERE a.id = ?`).get(id);
  return row ? rowToArticle(row) : null;
}

export function findByHash(hash: string): number | null {
  const row = getDb().prepare("SELECT id FROM articles WHERE hash = ?").get(hash) as { id: number } | undefined;
  return row?.id ?? null;
}

export function titleExists(normTitle: string, sinceIso: string): boolean {
  const row = getDb().prepare("SELECT 1 FROM articles WHERE extra LIKE ? AND published_at >= ? LIMIT 1").get(`%"nt":${JSON.stringify(normTitle)}%`, sinceIso);
  return Boolean(row);
}

export interface NewArticle {
  sourceId: number;
  url: string;
  hash: string;
  title: string;
  titleAr: string | null;
  summary: string | null;
  summaryAr: string | null;
  contentHtml: string | null;
  contentText: string | null;
  lang: string;
  category: string;
  tags: string[];
  imageUrl: string | null;
  images: string[];
  author: string | null;
  publishedAt: string;
  score: number;
  comments: number;
  extra: Record<string, unknown>;
  translated: number;
  detailsFetched: number;
}

export function insertArticle(a: NewArticle): number {
  const res = getDb()
    .prepare(
      `INSERT OR IGNORE INTO articles(source_id, url, hash, title, title_ar, summary, summary_ar, content_html, content_text, lang, category, tags, image_url, images, author, published_at, fetched_at, score, comments, extra, translated, details_fetched)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      a.sourceId, a.url, a.hash, a.title, a.titleAr, a.summary, a.summaryAr, a.contentHtml, a.contentText, a.lang, a.category,
      JSON.stringify(a.tags), a.imageUrl, JSON.stringify(a.images), a.author, a.publishedAt, nowIso(), a.score, a.comments,
      JSON.stringify(a.extra), a.translated, a.detailsFetched,
    );
  return res.lastInsertRowid;
}

export function updateArticle(id: number, patch: Partial<Record<string, unknown>>): void {
  const keys = Object.keys(patch);
  if (!keys.length) return;
  const sets = keys.map((k) => `${k} = ?`).join(", ");
  const values = keys.map((k) => {
    const v = patch[k];
    return v !== null && typeof v === "object" ? JSON.stringify(v) : v;
  });
  getDb().prepare(`UPDATE articles SET ${sets} WHERE id = ?`).run(...values, id);
}

export function pendingDetails(limit: number): Article[] {
  return getDb()
    .prepare(`${SELECT} WHERE a.details_fetched = 0 AND a.details_error IS NULL ORDER BY a.published_at DESC LIMIT ?`)
    .all(limit)
    .map(rowToArticle);
}

export function pendingTranslation(limit: number): Article[] {
  return getDb()
    .prepare(`${SELECT} WHERE a.translated = 0 AND a.lang != 'ar' ORDER BY a.published_at DESC LIMIT ?`)
    .all(limit)
    .map(rowToArticle);
}

export function pruneOld(days: number): number {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  return getDb().prepare("DELETE FROM articles WHERE saved = 0 AND published_at < ?").run(cutoff).changes;
}

export function feedStats(extra: { lastRefreshAt: string | null; refreshing: boolean }): FeedStats {
  const db = getDb();
  const one = (sql: string, ...p: unknown[]): number => Number((db.prepare(sql).get(...p) as { n: number }).n);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return {
    total: one("SELECT COUNT(*) n FROM articles"),
    today: one("SELECT COUNT(*) n FROM articles WHERE published_at >= ?", today.toISOString()),
    ai: one("SELECT COUNT(*) n FROM articles WHERE category = 'ai'"),
    tech: one("SELECT COUNT(*) n FROM articles WHERE category = 'tech'"),
    unread: one("SELECT COUNT(*) n FROM articles WHERE read = 0"),
    saved: one("SELECT COUNT(*) n FROM articles WHERE saved = 1"),
    ...extra,
  };
}

export function listSources(): Source[] {
  return getDb()
    .prepare(
      `SELECT s.*, (SELECT COUNT(*) FROM articles a WHERE a.source_id = s.id) AS item_count FROM sources s ORDER BY s.kind, s.lang DESC, s.name`,
    )
    .all()
    .map(rowToSource);
}

export function getSource(id: number): Source | null {
  const r = getDb().prepare("SELECT s.*, 0 AS item_count FROM sources s WHERE id = ?").get(id);
  return r ? rowToSource(r) : null;
}

export function addSource(s: { kind: string; name: string; target: string; lang: string; techOnly: boolean }): Source {
  const res = getDb()
    .prepare("INSERT INTO sources(kind, name, target, lang, enabled, tech_only, builtin) VALUES (?, ?, ?, ?, 1, ?, 0)")
    .run(s.kind, s.name.trim(), s.target.trim(), s.lang, s.techOnly ? 1 : 0);
  return getSource(res.lastInsertRowid) as Source;
}

export function updateSource(id: number, patch: { name?: string; enabled?: boolean; techOnly?: boolean; lang?: string; target?: string }): void {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (patch.name !== undefined) (sets.push("name = ?"), params.push(patch.name));
  if (patch.enabled !== undefined) (sets.push("enabled = ?"), params.push(patch.enabled ? 1 : 0));
  if (patch.techOnly !== undefined) (sets.push("tech_only = ?"), params.push(patch.techOnly ? 1 : 0));
  if (patch.lang !== undefined) (sets.push("lang = ?"), params.push(patch.lang));
  if (patch.target !== undefined) (sets.push("target = ?"), params.push(patch.target));
  if (!sets.length) return;
  getDb().prepare(`UPDATE sources SET ${sets.join(", ")} WHERE id = ?`).run(...params, id);
}

export function deleteSource(id: number): void {
  getDb().prepare("DELETE FROM sources WHERE id = ?").run(id);
}

export function markSourceFetched(id: number, error: string | null): void {
  getDb().prepare("UPDATE sources SET last_fetched_at = ?, last_error = ? WHERE id = ?").run(nowIso(), error, id);
}

export function markAllRead(category?: string): number {
  if (category && category !== "all") return getDb().prepare("UPDATE articles SET read = 1 WHERE read = 0 AND category = ?").run(category).changes;
  return getDb().prepare("UPDATE articles SET read = 1 WHERE read = 0").run().changes;
}

/** الوسوم الأكثر تكرارًا خلال آخر N ساعة. */
export function trendingTags(hours = 48, limit = 10): Trend[] {
  const since = new Date(Date.now() - hours * 3600000).toISOString();
  const rows = getDb().prepare("SELECT tags FROM articles WHERE published_at >= ?").all(since) as { tags: string }[];
  const counts = new Map<string, number>();
  for (const r of rows) {
    for (const t of parseJson<string[]>(r.tags, [])) {
      if (t === "تقنية عامة" || t === "شركات التقنية" || t === "برمجيات وتطبيقات") continue;
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function analytics(): AnalyticsData {
  const db = getDb();
  const days: AnalyticsData["days"] = [];
  const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const next = new Date(d.getTime() + 86400000);
    const row = db
      .prepare("SELECT COUNT(*) n, SUM(CASE WHEN category = 'ai' THEN 1 ELSE 0 END) ai FROM articles WHERE published_at >= ? AND published_at < ?")
      .get(d.toISOString(), next.toISOString()) as { n: number; ai: number | null };
    days.push({ date: d.toISOString().slice(0, 10), label: i === 0 ? "اليوم" : dayNames[d.getDay()], total: Number(row.n), ai: Number(row.ai ?? 0) });
  }
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - 6);
  const prevStart = new Date(weekStart.getTime() - 7 * 86400000);
  const one = (sql: string, ...p: unknown[]): number => Number((db.prepare(sql).get(...p) as { n: number | null }).n ?? 0);
  const weekTotal = one("SELECT COUNT(*) n FROM articles WHERE published_at >= ?", weekStart.toISOString());
  const prevWeekTotal = one("SELECT COUNT(*) n FROM articles WHERE published_at >= ? AND published_at < ?", prevStart.toISOString(), weekStart.toISOString());
  const aiWeek = one("SELECT COUNT(*) n FROM articles WHERE published_at >= ? AND category = 'ai'", weekStart.toISOString());
  const topSources = (db
    .prepare("SELECT s.name, s.kind, COUNT(*) count FROM articles a JOIN sources s ON s.id = a.source_id WHERE a.published_at >= ? GROUP BY s.id ORDER BY count DESC LIMIT 8")
    .all(weekStart.toISOString()) as { name: string; kind: SourceKind; count: number }[]).map((r) => ({ name: r.name, kind: r.kind, count: Number(r.count) }));
  const bySourceKind = (db
    .prepare("SELECT s.kind, COUNT(*) count FROM articles a JOIN sources s ON s.id = a.source_id WHERE a.published_at >= ? GROUP BY s.kind ORDER BY count DESC")
    .all(weekStart.toISOString()) as { kind: SourceKind; count: number }[]).map((r) => ({ kind: r.kind, count: Number(r.count) }));
  return {
    days,
    weekTotal,
    prevWeekTotal,
    aiShare: weekTotal ? aiWeek / weekTotal : 0,
    topSources,
    topTags: trendingTags(7 * 24, 10),
    readCount: one("SELECT COUNT(*) n FROM articles WHERE read = 1"),
    savedCount: one("SELECT COUNT(*) n FROM articles WHERE saved = 1"),
    translatedCount: one("SELECT COUNT(*) n FROM articles WHERE translated = 1 AND lang != 'ar'"),
    bySourceKind,
  };
}

/** يصدّر المحفوظات بصيغة Markdown. */
export function exportSavedMarkdown(): string {
  const items = listArticles({ savedOnly: true, limit: 300 });
  const lines = [`# محفوظات نبض التقنية — ${new Date().toLocaleDateString("ar-SA")}`, ""];
  for (const a of items) {
    lines.push(`## ${a.titleAr || a.title}`);
    if (a.titleAr && a.titleAr !== a.title) lines.push(`_${a.title}_`);
    lines.push(`- المصدر: ${a.sourceName} · ${a.publishedAt.slice(0, 10)} · ${a.category === "ai" ? "AI" : "تقنية"}`);
    lines.push(`- الرابط: ${a.url}`);
    const sum = a.summaryAr || a.summary;
    if (sum) lines.push("", sum);
    if (a.analysis?.summary) lines.push("", `**التحليل:** ${a.analysis.summary}`);
    lines.push("");
  }
  return lines.join("\n");
}

/** هل يطابق الخبر أحد الاهتمامات؟ */
export function matchesInterests(a: { title: string; titleAr?: string | null; summary?: string | null; tags: string[] }, interests: string[]): string | null {
  const hay = `${a.title} ${a.titleAr ?? ""} ${a.summary ?? ""} ${a.tags.join(" ")}`.toLowerCase();
  for (const w of interests) {
    const k = w.trim().toLowerCase();
    if (k && hay.includes(k)) return w;
  }
  return null;
}