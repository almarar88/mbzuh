import type {
  AgentEvent, AgentMessage, Analysis, AnalyticsData, Article, Conversation, FeedQuery, FeedStats, LlmStatus, RefreshProgress, RefreshSummary, Settings, Source, Trend,
} from "@shared/types";

interface Bridge {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  on(channel: string, listener: (...args: unknown[]) => void): () => void;
}

declare global {
  interface Window {
    techpulse: Bridge;
  }
}

const bridge = (): Bridge => window.techpulse;
const call = <T>(channel: string, ...args: unknown[]): Promise<T> => bridge().invoke(channel, ...args) as Promise<T>;

/** تنفيذ IPC لـ Electron. أندرويد/الويب يستبدلانه بتنفيذ محلي عبر initApi. */
const ipcApi = {
  feed: {
    list: (q: FeedQuery) => call<Article[]>("feed:list", q),
    get: (id: number) => call<Article | null>("feed:get", id),
    stats: () => call<FeedStats>("feed:stats"),
    markRead: (id: number, read: boolean) => call<void>("feed:markRead", id, read),
    save: (id: number, saved: boolean) => call<void>("feed:save", id, saved),
    details: (id: number, force = false) => call<Article>("feed:details", id, force),
    translate: (id: number, includeContent = false) => call<Article>("feed:translate", id, includeContent),
    analyze: (id: number, force = false) => call<Analysis>("feed:analyze", id, force),
    refresh: (sourceIds?: number[]) => call<RefreshSummary>("feed:refresh", sourceIds),
    trending: () => call<Trend[]>("feed:trending"),
    analytics: () => call<AnalyticsData>("feed:analytics"),
    markAllRead: (category?: string) => call<number>("feed:markAllRead", category),
    exportSaved: () => call<string>("feed:exportSaved"),
    related: (id: number) => call<Article[]>("feed:related", id),
    openExternal: (url: string) => call<void>("feed:openExternal", url),
  },
  sources: {
    list: () => call<Source[]>("sources:list"),
    add: (s: { kind: string; name: string; target: string; lang: string; techOnly: boolean }) => call<Source>("sources:add", s),
    update: (id: number, patch: Record<string, unknown>) => call<void>("sources:update", id, patch),
    delete: (id: number) => call<void>("sources:delete", id),
    test: (id: number) => call<{ count: number; sample: string[] }>("sources:test", id),
  },
  settings: {
    get: () => call<Settings>("settings:get"),
    set: (patch: Partial<Settings>) => call<Settings>("settings:set", patch),
  },
  agent: {
    conversations: () => call<Conversation[]>("agent:conversations"),
    messages: (id: number) => call<AgentMessage[]>("agent:messages", id),
    create: (title?: string) => call<Conversation>("agent:new", title),
    delete: (id: number) => call<void>("agent:delete", id),
    send: (conversationId: number | null, text: string) => call<number>("agent:send", conversationId, text),
    stop: (id: number) => call<void>("agent:stop", id),
    running: (id: number) => call<boolean>("agent:running", id),
    status: () => call<LlmStatus>("agent:status"),
  },
  on: {
    refreshProgress: (fn: (p: RefreshProgress) => void) => bridge().on("app:refresh-progress", (p) => fn(p as RefreshProgress)),
    agentEvent: (fn: (e: AgentEvent) => void) => bridge().on("app:agent-event", (e) => fn(e as AgentEvent)),
    navigate: (fn: (page: string) => void) => bridge().on("app:navigate", (p) => fn(String(p))),
    command: (fn: (cmd: string) => void) => bridge().on("app:command", (c) => fn(String(c))),
    openArticle: (fn: (id: number) => void) => bridge().on("app:open-article", (id) => fn(Number(id))),
  },
};

export type Api = typeof ipcApi;

/** الواجهة الفعلية المستخدمة في المكوّنات؛ تُملأ في initApi قبل أول تصيير. */
export const api: Api = { ...ipcApi };

export const isElectron = (): boolean => typeof window !== "undefined" && Boolean(window.techpulse);

/** مشاركة نص/رابط: نظام المشاركة على أندرويد، وإلا الحافظة. */
export async function shareText(title: string, text: string, url?: string): Promise<"shared" | "copied"> {
  if (!isElectron()) {
    try {
      const { Share } = await import("@capacitor/share");
      const { Capacitor } = await import("@capacitor/core");
      if (Capacitor.isNativePlatform()) {
        await Share.share({ title, text, url, dialogTitle: "مشاركة" });
        return "shared";
      }
    } catch {
      /* نعود إلى الحافظة */
    }
  }
  await navigator.clipboard.writeText(url ? `${text}\n${url}` : text);
  return "copied";
}

export async function initApi(): Promise<void> {
  if (isElectron()) return;
  const { createLocalApi } = await import("@/platform/local-api");
  const local = await createLocalApi();
  Object.assign(api, local);
}

/** حالة إذن التنبيهات وطلبه (أندرويد)، واختبار تنبيه. */
export const notifications = {
  async status(): Promise<"granted" | "denied" | "prompt" | "unsupported"> {
    if (isElectron()) return "granted";
    try {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform()) return "unsupported";
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      const p = await LocalNotifications.checkPermissions();
      return p.display === "granted" ? "granted" : p.display === "denied" ? "denied" : "prompt";
    } catch {
      return "unsupported";
    }
  },
  async request(): Promise<boolean> {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      const p = await LocalNotifications.requestPermissions();
      return p.display === "granted";
    } catch {
      return false;
    }
  },
  async test(): Promise<void> {
    if (isElectron()) {
      new Notification("نبض التقنية", { body: "هكذا ستصلك تنبيهات الأخبار الجديدة ✦" });
      return;
    }
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    await LocalNotifications.schedule({ notifications: [{ id: 424242, title: "نبض التقنية", body: "هكذا ستصلك تنبيهات الأخبار الجديدة ✦", smallIcon: "ic_launcher_foreground" }] });
  },
  async widgetCount(): Promise<number | null> {
    if (isElectron()) return null;
    try {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform()) return null;
      const { TechPulseNative } = await import("@/platform/native");
      return (await TechPulseNative.widgetCount()).count;
    } catch {
      return null;
    }
  },
  async runBackgroundNow(): Promise<void> {
    const { TechPulseNative } = await import("@/platform/native");
    await TechPulseNative.runOnceNow();
  },
};