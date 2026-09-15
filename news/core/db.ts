/**
 * واجهة قاعدة البيانات المشتركة بين المنصات.
 * Electron يزوّدها بـ node:sqlite، وأندرويد/الويب بـ sql.js (WASM).
 */

export interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

export interface Stmt {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  run(...params: any[]): RunResult;
  get(...params: any[]): any;
  all(...params: any[]): any[];
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

export interface Db {
  exec(sql: string): void;
  prepare(sql: string): Stmt;
  transaction<T>(fn: () => T): T;
  close(): void;
}

let db: Db | null = null;

export function setDb(instance: Db | null): void {
  db = instance;
}

export function getDb(): Db {
  if (!db) throw new Error("قاعدة البيانات غير مهيأة");
  return db;
}

export function hasDb(): boolean {
  return db !== null;
}

/** ينفّذ المخطط ويضبط رقم الإصدار — يُستدعى بعد setDb. */
export function initSchema(): void {
  getDb().exec(SCHEMA_SQL);
  getDb().prepare("INSERT OR IGNORE INTO meta(key, value) VALUES ('schema_version', ?)").run(String(SCHEMA_VERSION));
}

export function getSetting(key: string, fallback = ""): string {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row ? row.value : fallback;
}

export function setSetting(key: string, value: string): void {
  getDb()
    .prepare("INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, value);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export const SCHEMA_VERSION = 1;

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  target TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'en',
  enabled INTEGER NOT NULL DEFAULT 1,
  tech_only INTEGER NOT NULL DEFAULT 1,
  builtin INTEGER NOT NULL DEFAULT 0,
  last_fetched_at TEXT,
  last_error TEXT,
  UNIQUE(kind, target)
);

CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  hash TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  title_ar TEXT,
  summary TEXT,
  summary_ar TEXT,
  content_html TEXT,
  content_text TEXT,
  content_ar TEXT,
  lang TEXT NOT NULL DEFAULT 'en',
  category TEXT NOT NULL DEFAULT 'tech',
  tags TEXT NOT NULL DEFAULT '[]',
  image_url TEXT,
  images TEXT NOT NULL DEFAULT '[]',
  author TEXT,
  published_at TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  extra TEXT NOT NULL DEFAULT '{}',
  translated INTEGER NOT NULL DEFAULT 0,
  read INTEGER NOT NULL DEFAULT 0,
  saved INTEGER NOT NULL DEFAULT 0,
  details_fetched INTEGER NOT NULL DEFAULT 0,
  details_error TEXT,
  analysis TEXT
);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_source ON articles(source_id);
CREATE INDEX IF NOT EXISTS idx_articles_saved ON articles(saved);
CREATE INDEX IF NOT EXISTS idx_articles_details ON articles(details_fetched);

CREATE TABLE IF NOT EXISTS translations (
  hash TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  provider TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tool_calls TEXT NOT NULL DEFAULT '[]',
  api_content TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
`;
