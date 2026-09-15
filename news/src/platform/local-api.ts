/**
 * تنفيذ واجهة api داخل العملية نفسها (أندرويد/الويب): يستدعي خدمات core مباشرة
 * ويبث الأحداث عبر مستمعين محليين بدل IPC.
 */
import { App as CapApp } from "@capacitor/app";
import type { AgentEvent, RefreshProgress, Settings } from "@shared/types";
import { setPlatform } from "@core/platform";
import { setFetchImpl } from "@core/services/http";
import { aggregator } from "@core/services/aggregator";
import { addSource, deleteSource, feedStats, getArticle, getSource, listArticles, listSources, updateArticle, updateSource } from "@core/services/articles";
import { createConversation, deleteConversation, isAgentRunning, listConversations, listMessages, runAgent, stopAgent } from "@core/services/agent";
import { llmStatus } from "@core/services/llm";
import { loadSettings, saveSettings } from "@core/services/settings";
import { seedSources } from "@core/services/sources";
import { truncate } from "@core/services/text";
import type { Api } from "@/lib/api";
import { flushSqlJsDb, openSqlJsDb } from "./db-sqljs";
import { isNative, nativeFetch, openExternal, persistHooks } from "./capacitor";

type Listener<T> = (payload: T) => void;

class Emitter<T> {
  private set = new Set<Listener<T>>();
  on(fn: Listener<T>): () => void {
    this.set.add(fn);
    return () => this.set.delete(fn);
  }
  emit(p: T): void {
    for (const fn of this.set) fn(p);
  }
}

const progressEm = new Emitter<RefreshProgress>();
const agentEm = new Emitter<AgentEvent>();
const navigateEm = new Emitter<string>();
const commandEm = new Emitter<string>();
const openArticleEm = new Emitter<number>();

let refreshTimer: ReturnType<typeof setInterval> | null = null;

function scheduleRefresh(s: Settings): void {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    if (!aggregator.refreshing) void aggregator.refreshAll().catch(() => undefined);
  }, Math.max(5, s.refreshMinutes || 30) * 60 * 1000);
}

export async function createLocalApi(): Promise<Api> {
  setPlatform({
    name: isNative ? "android" : "web",
    parseHtml: (html) => new DOMParser().parseFromString(html, "text/html"),
    env: () => undefined,
  });
  setFetchImpl(nativeFetch);
  await openSqlJsDb(persistHooks, new URL("./sql-wasm.wasm", document.baseURI).toString());
  seedSources();
  aggregator.onProgress((p) => progressEm.emit(p));
  scheduleRefresh(loadSettings());
  if (isNative) {
    void CapApp.addListener("pause", () => void flushSqlJsDb());
    void CapApp.addListener("backButton", ({ canGoBack }) => {
      commandEm.emit("back");
      if (!canGoBack) return;
    });
  }
  window.addEventListener("beforeunload", () => void flushSqlJsDb());
  setTimeout(() => void aggregator.refreshAll().catch(() => undefined), 1500);

  return {
    feed: {
      list: async (q) => listArticles(q),
      get: async (id) => getArticle(id),
      stats: async () => feedStats({ lastRefreshAt: aggregator.lastRefreshAt, refreshing: aggregator.refreshing }),
      markRead: async (id, read) => updateArticle(id, { read: read ? 1 : 0 }),
      save: async (id, saved) => updateArticle(id, { saved: saved ? 1 : 0 }),
      details: (id, force) => aggregator.fetchDetails(id, force),
      translate: (id, includeContent) => aggregator.translateArticle(id, includeContent),
      analyze: (id, force) => aggregator.analyze(id, force),
      refresh: (sourceIds) => aggregator.refreshAll(sourceIds),
      related: async (id) => {
        const a = getArticle(id);
        if (!a) return [];
        const term = (a.tags[0] ?? a.title.split(" ").slice(0, 2).join(" ")).split(" ")[0];
        return listArticles({ search: term, limit: 8 }).filter((x) => x.id !== a.id).slice(0, 6);
      },
      openExternal: (url) => openExternal(url),
    },
    sources: {
      list: async () => listSources(),
      add: async (s) => addSource(s),
      update: async (id, patch) => updateSource(id, patch),
      delete: async (id) => deleteSource(id),
      test: async (id) => {
        const s = getSource(id);
        if (!s) throw new Error("المصدر غير موجود");
        const items = await aggregator.fetchSource(s, loadSettings().xBearerToken);
        return { count: items.length, sample: items.slice(0, 3).map((i) => i.title) };
      },
    },
    settings: {
      get: async () => loadSettings(),
      set: async (patch) => {
        const s = saveSettings(patch);
        scheduleRefresh(s);
        return s;
      },
    },
    agent: {
      conversations: async () => listConversations(),
      messages: async (id) => listMessages(id),
      create: async (title) => createConversation(title || "محادثة جديدة"),
      delete: async (id) => deleteConversation(id),
      send: async (conversationId, text) => {
        const conv = conversationId ? { id: conversationId } : createConversation(truncate(text.trim(), 60));
        void runAgent(conv.id, text.trim(), (e) => agentEm.emit(e)).catch(() => undefined);
        return conv.id;
      },
      stop: async (id) => stopAgent(id),
      running: async (id) => isAgentRunning(id),
      status: async () => llmStatus(),
    },
    on: {
      refreshProgress: (fn) => progressEm.on(fn),
      agentEvent: (fn) => agentEm.on(fn),
      navigate: (fn) => navigateEm.on(fn),
      command: (fn) => commandEm.on(fn),
      openArticle: (fn) => openArticleEm.on(fn),
    },
  };
}
