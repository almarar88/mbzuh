import type {
  AgentEvent, AgentMessage, Analysis, Article, Conversation, FeedQuery, FeedStats, LlmStatus, RefreshProgress, Settings, Source,
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

export const api = {
  feed: {
    list: (q: FeedQuery) => call<Article[]>("feed:list", q),
    get: (id: number) => call<Article | null>("feed:get", id),
    stats: () => call<FeedStats>("feed:stats"),
    markRead: (id: number, read: boolean) => call<void>("feed:markRead", id, read),
    save: (id: number, saved: boolean) => call<void>("feed:save", id, saved),
    details: (id: number, force = false) => call<Article>("feed:details", id, force),
    translate: (id: number, includeContent = false) => call<Article>("feed:translate", id, includeContent),
    analyze: (id: number, force = false) => call<Analysis>("feed:analyze", id, force),
    refresh: (sourceIds?: number[]) => call<{ added: number; sources: number; errors: { source: string; error: string }[] }>("feed:refresh", sourceIds),
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
