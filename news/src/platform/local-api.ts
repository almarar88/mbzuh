/**
 * تنفيذ واجهة api داخل العملية نفسها (أندرويد/الويب): يستدعي خدمات core مباشرة
 * ويبث الأحداث عبر مستمعين محليين بدل IPC.
 */
import { App as CapApp } from "@capacitor/app";
import type { AgentEvent, RefreshProgress, Settings } from "@shared/types";
import { setPlatform } from "@core/platform";
import { setFetchImpl } from "@core/services/http";
import { aggregator } from "@core/services/aggregator";
import { addSource, analytics, deleteSource, exportSavedMarkdown, feedStats, findIdByUrl, getArticle, getSource, listArticles, listSources, markAllRead, trendingTags, updateArticle, updateSource } from "@core/services/articles";
import { gnewsSearchUrl } from "@core/services/gnews";
import { TechPulseNative } from "./native";
import { LocalNotifications } from "@capacitor/local-notifications";
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
let appActive = true;
let syncTimer: ReturnType<typeof setTimeout> | null = null;

/** يزوّد الكود الأصلي بعناصر الويدجت (عناوين مترجمة) وإعدادات عامل الخلفية. */
async function syncNative(): Promise<void> {
  if (!isNative) return;
  try {
    const s = loadSettings();
    const latest = listArticles({ limit: 20, sort: "newest" });
    const items = latest.map((a) => ({
      id: a.id,
      title: a.titleAr || a.title,
      url: a.url,
      source: a.sourceName,
      category: a.category,
      publishedAt: a.publishedAt,
      image: a.imageUrl ?? "",
    }));
    const sources = listSources()
      .filter((x) => x.enabled && (x.kind === "rss" || x.kind === "gnews"))
      .map((x) => ({ name: x.name, url: x.kind === "gnews" ? gnewsSearchUrl(x.target, x.lang === "en" ? "en" : "ar") : x.target, techOnly: Boolean(x.techOnly), lang: x.lang }));
    const seenUrls = listArticles({ limit: 300, sort: "newest" }).map((a) => a.url);
    await TechPulseNative.sync({
      items,
      settings: { notifyNew: s.notifyNew, notifyInterestsOnly: s.notifyInterestsOnly, interests: s.interests, muted: s.mutedKeywords, sources },
      seenUrls,
    });
  } catch (e) {
    console.warn("native sync failed", e);
  }
}

function scheduleSync(): void {
  if (!isNative) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => void syncNative(), 1200);
}

async function configureBackground(s: Settings): Promise<void> {
  if (!isNative) return;
  try {
    await TechPulseNative.configureBackground({ enabled: s.backgroundRefresh && s.notifyNew, minutes: Math.max(15, s.refreshMinutes || 30) });
  } catch (e) {
    console.warn("background config failed", e);
  }
}

/** يفتح خبرًا من رابط داخلي techpulse://article/ID أو techpulse://open?url=… */
async function handleDeepLink(url: string): Promise<void> {
  try {
    const u = new URL(url);
    if (u.protocol !== "techpulse:") return;
    if (u.host === "article") {
      const id = Number(u.pathname.replace(/\//g, ""));
      if (id) openArticleEm.emit(id);
      return;
    }
    if (u.host === "open") {
      const target = u.searchParams.get("url") ?? "";
      let id = findIdByUrl(target);
      if (!id) {
        await refreshAndNotify();
        id = findIdByUrl(target);
      }
      if (id) openArticleEm.emit(id);
      else if (target) await openExternal(target);
      return;
    }
    navigateEm.emit("feed");
  } catch {
    /* رابط غير صالح */
  }
}
let lastRefreshAt = 0;

/** تنبيه محلي بالأخبار الجديدة عندما يكون التطبيق في الخلفية. */
async function notifyNewArticles(summary: { added: number; interestHits: { id: number; title: string }[] }): Promise<void> {
  if (!isNative || appActive || !loadSettings().notifyNew) return;
  if (summary.added === 0) return;
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted") {
      const req = await LocalNotifications.requestPermissions();
      if (req.display !== "granted") return;
    }
    const hit = summary.interestHits[0];
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Date.now() / 1000) % 2147483647,
          title: hit ? `خبر يهمّك: ${hit.title.slice(0, 60)}` : `نبض التقنية: ${summary.added} خبر جديد`,
          body: hit ? `و${summary.added - 1} خبر آخر جديد` : "افتح التطبيق لقراءة أحدث أخبار التقنية وAI",
          extra: hit ? { articleId: hit.id } : {},
          smallIcon: "ic_launcher_foreground",
        },
      ],
    });
  } catch {
    /* التنبيهات غير متاحة */
  }
}

async function refreshAndNotify(): Promise<void> {
  if (aggregator.refreshing) return;
  try {
    const s = await aggregator.refreshAll();
    lastRefreshAt = Date.now();
    void notifyNewArticles(s);
    scheduleSync();
  } catch {
    /* تجاهل */
  }
}

function scheduleRefresh(s: Settings): void {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => void refreshAndNotify(), Math.max(5, s.refreshMinutes || 30) * 60 * 1000);
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
  aggregator.onProgress((p) => {
    progressEm.emit(p);
    if ((p.phase === "translate" || p.phase === "details") && p.done === p.total) scheduleSync();
  });
  scheduleRefresh(loadSettings());
  void configureBackground(loadSettings());
  scheduleSync();
  if (isNative) {
    void CapApp.addListener("pause", () => {
      appActive = false;
      void flushSqlJsDb();
    });
    void CapApp.addListener("resume", () => {
      appActive = true;
      // تحديث عند العودة إن مضى أكثر من 15 دقيقة
      if (Date.now() - lastRefreshAt > 15 * 60 * 1000) void refreshAndNotify();
    });
    void CapApp.addListener("appUrlOpen", ({ url }) => void handleDeepLink(url));
    void CapApp.getLaunchUrl().then((r) => {
      if (r?.url) setTimeout(() => void handleDeepLink(r.url), 800);
    });
    void LocalNotifications.addListener("localNotificationActionPerformed", (ev) => {
      const id = Number((ev.notification.extra as { articleId?: number } | undefined)?.articleId);
      if (id) openArticleEm.emit(id);
    });
    void CapApp.addListener("backButton", ({ canGoBack }) => {
      commandEm.emit("back");
      if (!canGoBack) return;
    });
  }
  window.addEventListener("beforeunload", () => void flushSqlJsDb());
  setTimeout(() => void refreshAndNotify(), 1500);

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
      refresh: async (sourceIds) => {
        const s = await aggregator.refreshAll(sourceIds);
        lastRefreshAt = Date.now();
        scheduleSync();
        return s;
      },
      trending: async () => trendingTags(48, 10),
      analytics: async () => analytics(),
      markAllRead: async (category) => markAllRead(category),
      exportSaved: async () => exportSavedMarkdown(),
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
        void configureBackground(s);
        scheduleSync();
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
