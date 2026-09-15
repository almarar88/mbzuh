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
