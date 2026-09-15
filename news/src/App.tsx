import { useCallback, useEffect, useState } from "react";
import type { FeedStats, RefreshProgress, Settings } from "@shared/types";
import { api } from "@/lib/api";
import { UiProvider, useToast } from "@/components/ui";
import { FeedPage } from "@/pages/Feed";
import { ArticlePage } from "@/pages/Article";
import { AgentPage } from "@/pages/Agent";
import { SourcesPage } from "@/pages/Sources";
import { SettingsPage } from "@/pages/Settings";

export type Page = "feed" | "ai" | "tech" | "social" | "saved" | "agent" | "sources" | "settings";

const NAV: { id: Page; label: string; icon: string }[] = [
  { id: "feed", label: "آخر الأخبار", icon: "🗞️" },
  { id: "ai", label: "الذكاء الاصطناعي", icon: "🤖" },
  { id: "tech", label: "التقنية", icon: "💻" },
  { id: "social", label: "Reddit و X", icon: "💬" },
  { id: "saved", label: "المحفوظات", icon: "🔖" },
  { id: "agent", label: "الوكيل الذكي", icon: "✨" },
  { id: "sources", label: "المصادر", icon: "📡" },
  { id: "settings", label: "الإعدادات", icon: "⚙️" },
];

function Shell() {
  const [page, setPage] = useState<Page>("feed");
  const [articleId, setArticleId] = useState<number | null>(null);
  const [stats, setStats] = useState<FeedStats | null>(null);
  const [progress, setProgress] = useState<RefreshProgress | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [feedVersion, setFeedVersion] = useState(0);
  const [agentPrefill, setAgentPrefill] = useState<string | null>(null);
  const { toast } = useToast();

  const loadStats = useCallback(() => {
    void api.feed.stats().then(setStats);
  }, []);

  useEffect(() => {
    void api.settings.get().then((s) => {
      setSettings(s);
      document.documentElement.dataset.theme = s.theme;
    });
    loadStats();
    const offP = api.on.refreshProgress((p) => {
      setProgress(p);
      if (p.phase === "done") {
        loadStats();
        setFeedVersion((v) => v + 1);
        toast(p.added > 0 ? `تم التحديث: ${p.added} خبر جديد` : "لا أخبار جديدة", "ok");
        setTimeout(() => setProgress((cur) => (cur?.phase === "done" ? null : cur)), 2500);
      }
      if (p.phase === "translate" || p.phase === "details") {
        if (p.done === p.total) {
          setFeedVersion((v) => v + 1);
          setTimeout(() => setProgress((cur) => (cur && cur.done === cur.total ? null : cur)), 1500);
        }
      }
    });
    const offN = api.on.navigate((p) => {
      setArticleId(null);
      setPage(p as Page);
    });
    const offC = api.on.command((c) => {
      if (c === "refresh") void refresh();
      if (c === "search") {
        setArticleId(null);
        setPage("feed");
        setTimeout(() => (document.getElementById("feed-search") as HTMLInputElement | null)?.focus(), 50);
      }
    });
    const offA = api.on.openArticle((id) => setArticleId(id));
    return () => {
      offP();
      offN();
      offC();
      offA();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh(): Promise<void> {
    try {
      setProgress({ phase: "start", done: 0, total: 0, added: 0 });
      const r = await api.feed.refresh();
      if (r.errors.length) toast(`تعذّر جلب ${r.errors.length} مصدر (انظر صفحة المصادر)`, "info");
    } catch (e) {
      toast((e as Error).message, "error");
      setProgress(null);
    }
  }

  const openArticle = (id: number): void => {
    setArticleId(id);
  };

  const go = (p: Page): void => {
    setArticleId(null);
    setPage(p);
  };

  const askAgent = (prompt: string): void => {
    setAgentPrefill(prompt);
    setArticleId(null);
    setPage("agent");
  };

  const busy = progress && progress.phase !== "done";

  return (
    <div className="flex h-full">
      <aside className="w-60 shrink-0 flex flex-col p-3 gap-1" style={{ background: "var(--panel)", borderInlineEnd: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2 px-2 py-3 mb-2">
          <div className="text-2xl">⚡</div>
          <div>
            <div className="font-bold text-base leading-tight">نبض التقنية</div>
            <div className="text-[11px]" style={{ color: "var(--muted)" }}>أخبار التقنية والذكاء الاصطناعي</div>
          </div>
        </div>
        {NAV.map((n) => (
          <div key={n.id} className={`nav-item ${page === n.id && !articleId ? "active" : ""}`} onClick={() => go(n.id)}>
            <span>{n.icon}</span>
            <span>{n.label}</span>
            {n.id === "feed" && stats && stats.unread > 0 && <span className="badge badge-muted ms-auto">{stats.unread > 999 ? "999+" : stats.unread}</span>}
            {n.id === "saved" && stats && stats.saved > 0 && <span className="badge badge-muted ms-auto">{stats.saved}</span>}
          </div>
        ))}
        <div className="mt-auto flex flex-col gap-2 px-1">
          {progress && (
            <div className="text-[11px]" style={{ color: "var(--muted)" }}>
              <div className="mb-1 truncate">
                {progress.phase === "start" && "بدء التحديث…"}
                {progress.phase === "source" && `جلب: ${progress.sourceName ?? ""} (${progress.done}/${progress.total})`}
                {progress.phase === "details" && `جلب التفاصيل والصور (${progress.done}/${progress.total})`}
                {progress.phase === "translate" && `ترجمة العناوين (${progress.done}/${progress.total})`}
                {progress.phase === "done" && `اكتمل: ${progress.added} خبر جديد`}
              </div>
              <div className="progress"><div style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 10}%` }} /></div>
            </div>
          )}
          <button className="btn btn-primary justify-center" onClick={() => void refresh()} disabled={Boolean(busy)}>
            {busy ? <span className="spinner" /> : "🔄"} تحديث الأخبار
          </button>
          {stats && (
            <div className="text-[11px] px-1" style={{ color: "var(--muted)" }}>
              {stats.total} خبر · اليوم {stats.today} · ذكاء اصطناعي {stats.ai}
            </div>
          )}
        </div>
      </aside>
      <main className="flex-1 min-w-0 overflow-hidden">
        {articleId ? (
          <ArticlePage id={articleId} onBack={() => setArticleId(null)} onOpen={openArticle} onAsk={askAgent} onChanged={loadStats} settings={settings} />
        ) : page === "agent" ? (
          <AgentPage prefill={agentPrefill} onPrefillConsumed={() => setAgentPrefill(null)} onOpenArticle={openArticle} onGoSettings={() => go("settings")} />
        ) : page === "sources" ? (
          <SourcesPage onRefreshed={() => { loadStats(); setFeedVersion((v) => v + 1); }} />
        ) : page === "settings" ? (
          <SettingsPage onSaved={(s) => { setSettings(s); document.documentElement.dataset.theme = s.theme; }} />
        ) : (
          <FeedPage key={page} mode={page} version={feedVersion} onOpen={openArticle} onChanged={loadStats} />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <UiProvider>
      <Shell />
    </UiProvider>
  );
}
