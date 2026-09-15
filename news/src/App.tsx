import { useCallback, useEffect, useState } from "react";
import type { FeedStats, RefreshProgress, Settings } from "@shared/types";
import { api } from "@/lib/api";
import logo from "@/assets/logo.svg";
import { UiProvider, useToast } from "@/components/ui";
import { FeedPage } from "@/pages/Feed";
import { ArticlePage } from "@/pages/Article";
import { AgentPage } from "@/pages/Agent";
import { SourcesPage } from "@/pages/Sources";
import { SettingsPage } from "@/pages/Settings";
import { AnalyticsPage } from "@/pages/Analytics";
import { Onboarding } from "@/components/Onboarding";

export type Page = "feed" | "ai" | "tech" | "social" | "saved" | "agent" | "analytics" | "sources" | "settings";

const PRIMARY_TABS: Page[] = ["feed", "ai", "agent", "saved"];

const NAV: { id: Page; label: string; icon: string }[] = [
  { id: "feed", label: "آخر الأخبار", icon: "🗞️" },
  { id: "ai", label: "AI", icon: "✦" },
  { id: "tech", label: "التقنية", icon: "💻" },
  { id: "social", label: "Reddit و X", icon: "💬" },
  { id: "saved", label: "المحفوظات", icon: "🔖" },
  { id: "agent", label: "الوكيل الذكي", icon: "✨" },
  { id: "analytics", label: "تحليلات", icon: "📊" },
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
  const [feedTag, setFeedTag] = useState<string | null>(null);
  const { toast } = useToast();

  const applyPrefs = (s: Settings): void => {
    const dark = s.theme === "dark" || (s.theme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.style.fontSize = `${Math.round((s.fontScale || 1) * 100)}%`;
  };

  const loadStats = useCallback(() => {
    void api.feed.stats().then(setStats);
  }, []);

  useEffect(() => {
    void api.settings.get().then((s) => {
      setSettings(s);
      applyPrefs(s);
    });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onMq = (): void => void api.settings.get().then(applyPrefs);
    mq.addEventListener("change", onMq);
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
      if (c === "back") {
        setArticleId((cur) => (cur ? null : cur));
        setMoreOpen(false);
      }
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
      mq.removeEventListener("change", onMq);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh(): Promise<void> {
    try {
      setProgress({ phase: "start", done: 0, total: 0, added: 0 });
      const r = await api.feed.refresh();
      if (r.interestHits?.length) toast(`⭐ ${r.interestHits.length} خبر جديد يطابق اهتماماتك: ${r.interestHits[0].title.slice(0, 50)}…`, "ok");
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
    if (p !== "feed") setFeedTag(null);
    setPage(p);
  };

  const askAgent = (prompt: string): void => {
    setAgentPrefill(prompt);
    setArticleId(null);
    setPage("agent");
  };

  const busy = progress && progress.phase !== "done";
  const [moreOpen, setMoreOpen] = useState(false);
  const current = NAV.find((n) => n.id === page);
  const progressLabel = progress
    ? progress.phase === "start"
      ? "بدء التحديث…"
      : progress.phase === "source"
        ? `جلب: ${progress.sourceName ?? ""} (${progress.done}/${progress.total})`
        : progress.phase === "details"
          ? `جلب التفاصيل والصور (${progress.done}/${progress.total})`
          : progress.phase === "translate"
            ? `ترجمة العناوين (${progress.done}/${progress.total})`
            : `اكتمل: ${progress.added} خبر جديد`
    : null;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="flex items-center gap-3 px-2 py-2 mb-3">
          <img src={logo} alt="" className="avatar" />
          <div>
            <div className="font-semibold text-[15px] leading-tight">نبض التقنية</div>
            <div className="text-[11px]" style={{ color: "var(--dark-muted)" }}>تابع وحلّل أخبار التقنية</div>
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
        <div className="mt-auto flex flex-col gap-3">
          {stats && (
            <div className="stat-tile">
              <div className="flex items-center gap-2">
                <div className="big">{stats.today}<small>خبر اليوم</small></div>
                <span className="ms-auto text-lg" style={{ color: "var(--accent)" }}>✦</span>
              </div>
              <div className="text-[11px] mt-2" style={{ color: "var(--dark-muted)" }}>
                {stats.total} خبر محفوظ · {stats.ai} AI
                {stats.lastRefreshAt && <> · حُدّث {new Date(stats.lastRefreshAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}</>}
              </div>
              {progress && (
                <div className="text-[11px] mt-2" style={{ color: "var(--dark-muted)" }}>
                  <div className="mb-1 truncate">{progressLabel}</div>
                  <div className="progress"><div style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 10}%` }} /></div>
                </div>
              )}
            </div>
          )}
          <button className="btn btn-accent" onClick={() => void refresh()} disabled={Boolean(busy)}>
            {busy ? <span className="spinner" /> : "🔄"} تحديث الأخبار
          </button>
        </div>
      </aside>
      <div className="main-area">
        {/* شريط علوي للهواتف */}
        <div className="topbar">
          {articleId ? (
            <button className="btn btn-ghost btn-sm btn-round" onClick={() => setArticleId(null)} title="رجوع">→</button>
          ) : (
            <img src={logo} alt="" className="avatar" style={{ width: 38, height: 38 }} />
          )}
          <div className="min-w-0">
            <div className="font-semibold text-[16px] leading-tight truncate">{articleId ? "الخبر" : (current?.label ?? "نبض التقنية")}</div>
            <div className="text-[11px] truncate" style={{ color: "var(--dark-muted)" }}>{progress ? progressLabel : stats ? `${stats.today} خبر اليوم · ${stats.unread} غير مقروء` : "تابع وحلّل أخبار التقنية"}</div>
          </div>
          <span className="ms-auto" />
          <button className="btn btn-round" style={{ background: busy ? "var(--dark-2)" : "var(--accent)", color: "#fff" }} onClick={() => void refresh()} disabled={Boolean(busy)} title="تحديث الأخبار">{busy ? <span className="spinner" /> : "🔄"}</button>
        </div>
        {progress && <div className="progress hide-wide" style={{ borderRadius: 0, margin: "0 16px" }}><div style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 10}%` }} /></div>}
      <main className="flex-1 min-w-0 overflow-hidden relative">
        {articleId ? (
          <ArticlePage id={articleId} onBack={() => setArticleId(null)} onOpen={openArticle} onAsk={askAgent} onChanged={loadStats} settings={settings} />
        ) : page === "agent" ? (
          <AgentPage prefill={agentPrefill} onPrefillConsumed={() => setAgentPrefill(null)} onOpenArticle={openArticle} onGoSettings={() => go("settings")} />
        ) : page === "sources" ? (
          <SourcesPage onRefreshed={() => { loadStats(); setFeedVersion((v) => v + 1); }} />
        ) : page === "settings" ? (
          <SettingsPage onSaved={(s) => { setSettings(s); applyPrefs(s); setFeedVersion((v) => v + 1); }} />
        ) : page === "analytics" ? (
          <AnalyticsPage onOpenTag={(tag) => { setFeedTag(tag); go("feed"); }} />
        ) : (
          <FeedPage key={page + (feedTag ?? "")} mode={page} version={feedVersion} settings={settings} initialTag={feedTag} onOpen={openArticle} onChanged={loadStats} onAsk={askAgent} onRefresh={refresh} />
        )}
        {settings && !settings.onboarded && (
          <Onboarding onDone={(patch) => void api.settings.set(patch).then((s) => { setSettings(s); applyPrefs(s); setFeedVersion((v) => v + 1); })} />
        )}
        {moreOpen && (
          <div className="absolute inset-0 z-40 hide-wide" style={{ background: "rgb(0 0 0 / .5)" }} onClick={() => setMoreOpen(false)}>
            <div className="absolute bottom-0 inset-x-0 panel sheet p-3 flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
              {NAV.filter((n) => !PRIMARY_TABS.includes(n.id)).map((n) => (
                <div key={n.id} className={`nav-item ${page === n.id && !articleId ? "active" : ""}`} onClick={() => { go(n.id); setMoreOpen(false); }}>
                  <span>{n.icon}</span><span>{n.label}</span>
                </div>
              ))}
              {stats && <div className="text-[11px] px-3 pt-2" style={{ color: "var(--muted)" }}>{stats.total} خبر · اليوم {stats.today} · AI {stats.ai}</div>}
            </div>
          </div>
        )}
      </main>
        {/* شريط سفلي للهواتف (وFold مطويًا) */}
        <nav className="bottom-nav">
          {PRIMARY_TABS.map((id) => {
            const n = NAV.find((x) => x.id === id)!;
            return (
              <div key={id} className={`tab ${page === id && !articleId && !moreOpen ? "active" : ""}`} onClick={() => { go(id); setMoreOpen(false); }}>
                <span className="ico">{n.icon}</span>
                <span>{n.label}</span>
              </div>
            );
          })}
          <div className={`tab ${moreOpen || (!PRIMARY_TABS.includes(page) && !articleId) ? "active" : ""}`} onClick={() => setMoreOpen((v) => !v)}>
            <span className="ico">☰</span>
            <span>المزيد</span>
          </div>
        </nav>
      </div>
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
