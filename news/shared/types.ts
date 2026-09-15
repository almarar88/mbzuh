/** الأنواع المشتركة بين العملية الرئيسية وواجهة المستخدم. */

export type Category = "ai" | "tech";
export type SourceKind = "rss" | "reddit" | "x" | "gnews";
export type Lang = "ar" | "en" | "other";

export interface Source {
  id: number;
  kind: SourceKind;
  name: string;
  /** عنوان الخلاصة، أو اسم الـsubreddit، أو معرّف حساب X، أو استعلام Google News. */
  target: string;
  lang: Lang;
  enabled: number;
  /** 1 = المصدر تقني بالكامل (لا يُفلتر)، 0 = مصدر عام يُفلتر بالكلمات المفتاحية. */
  techOnly: number;
  builtin: number;
  lastFetchedAt: string | null;
  lastError: string | null;
  itemCount: number;
}

export interface Analysis {
  summary: string;
  keyPoints: string[];
  whyItMatters: string;
  entities: string[];
  sentiment: "positive" | "negative" | "neutral" | "mixed";
  confidence: "confirmed" | "reported" | "speculation";
  tags: string[];
  /** "llm" = بالذكاء الاصطناعي، "local" = تلخيص استخلاصي محلي. */
  engine: "llm" | "local";
  createdAt: string;
}

export interface Article {
  id: number;
  sourceId: number;
  sourceName: string;
  sourceKind: SourceKind;
  url: string;
  title: string;
  titleAr: string | null;
  summary: string | null;
  summaryAr: string | null;
  contentHtml: string | null;
  contentText: string | null;
  contentAr: string | null;
  lang: Lang;
  category: Category;
  tags: string[];
  imageUrl: string | null;
  images: string[];
  author: string | null;
  publishedAt: string;
  fetchedAt: string;
  score: number;
  comments: number;
  extra: Record<string, unknown>;
  translated: number;
  read: number;
  saved: number;
  detailsFetched: number;
  detailsError: string | null;
  analysis: Analysis | null;
  hash: string;
}

export interface FeedQuery {
  category?: "all" | Category;
  kind?: "all" | SourceKind;
  sourceId?: number;
  search?: string;
  savedOnly?: boolean;
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface FeedStats {
  total: number;
  today: number;
  ai: number;
  tech: number;
  unread: number;
  saved: number;
  lastRefreshAt: string | null;
  refreshing: boolean;
}

export type TranslationProvider = "auto" | "llm" | "google" | "mymemory" | "none";

export interface Settings {
  anthropicApiKey: string;
  model: string;
  effort: "low" | "medium" | "high";
  translationProvider: TranslationProvider;
  autoTranslate: boolean;
  autoFetchDetails: boolean;
  refreshMinutes: number;
  xBearerToken: string;
  useServerWebSearch: boolean;
  theme: "dark" | "light";
  maxArticleAgeDays: number;
}

export interface RefreshProgress {
  phase: "start" | "source" | "details" | "translate" | "done" | "error";
  sourceName?: string;
  done: number;
  total: number;
  added: number;
  message?: string;
}

export interface AgentToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: string;
  error?: boolean;
  durationMs?: number;
}

export interface AgentMessage {
  id: number;
  conversationId: number;
  role: "user" | "assistant";
  content: string;
  toolCalls: AgentToolCall[];
  createdAt: string;
}

export interface Conversation {
  id: number;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export type AgentEvent =
  | { type: "text"; conversationId: number; delta: string }
  | { type: "tool_start"; conversationId: number; call: AgentToolCall }
  | { type: "tool_end"; conversationId: number; call: AgentToolCall }
  | { type: "status"; conversationId: number; message: string }
  | { type: "done"; conversationId: number; message: AgentMessage }
  | { type: "error"; conversationId: number; message: string };

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  publishedAt: string | null;
}

export interface LlmStatus {
  configured: boolean;
  model: string;
  provider: "anthropic";
}
