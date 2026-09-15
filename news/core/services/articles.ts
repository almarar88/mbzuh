/** مستودع المقالات والمصادر (استعلامات SQLite). */
import type { Analysis, Article, FeedQuery, FeedStats, Source } from "@shared/types";
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

export function listArticles(q: FeedQuery): Article[] {
  const where: string[] = [];
  const params: unknown[] = [];
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
  const sql = `SELECT ${LIST_COLUMNS} FROM articles a JOIN sources s ON s.id = a.source_id ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY a.published_at DESC LIMIT ? OFFSET ?`;
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
