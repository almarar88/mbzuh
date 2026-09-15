import { useEffect, useRef, useState } from "react";
import type { Article, FeedQuery, FeedSort, Settings, SourceKind, Trend } from "@shared/types";
import { api } from "@/lib/api";
import { ArticleCard } from "@/components/ArticleCard";
import { Empty, Spinner, useToast } from "@/components/ui";
import type { Page } from "@/App";

const PAGE_SIZE = 48;

const TITLES: Record<string, { title: string; hint: string }> = {
  feed: { title: "آخر الأخبار", hint: "كل ما هو جديد في التقنية وAI من كل المصادر" },
  ai: { title: "أخبار AI", hint: "النماذج، الشركات، الأبحاث، والأدوات" },
  tech: { title: "التقنية", hint: "الأجهزة، البرمجيات، الشركات، والأمن السيبراني" },
  social: { title: "Reddit و X", hint: "ما يتداوله المجتمع التقني الآن" },
  saved: { title: "المحفوظات", hint: "الأخبار التي حفظتها للرجوع إليها" },
};

const SORTS: { id: FeedSort; label: string }[] = [
  { id: "newest", label: "الأحدث" },
  { id: "trending", label: "🔥 الرائج" },
  { id: "popular", label: "الأكثر تفاعلًا" },
];

export function FeedPage({ mode, version, settings, initialTag, onOpen, onChanged, onAsk, onRefresh }: {
  mode: Page;
  version: number;
  settings: Settings | null;
  initialTag?: string | null;
  onOpen: (id: number) => void;
  onChanged: () => void;
  onAsk: (prompt: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const [items, setItems] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<"all" | SourceKind>("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [arabicOnly, setArabicOnly] = useState(false);
  const [interestsOnly, setInterestsOnly] = useState(false);
  const [sort, setSort] = useState<FeedSort>("newest");
  const [tag, setTag] = useState<string | null>(initialTag ?? null);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [cat, setCat] = useState<"all" | "ai" | "tech">("all");
  const [pull, setPull] = useState(0);
  const { toast } = useToast();
  const scroller = useRef<HTMLDivElement>(null);
  const touchY = useRef<number | null>(null);

  function buildQuery(offset: number): FeedQuery {
    const q: FeedQuery = { limit: PAGE_SIZE, offset, search, unreadOnly, arabicOnly, interestsOnly, sort, tag: tag ?? undefined };
    if (mode === "ai") q.category = "ai";
    else if (mode === "tech") q.category = "tech";
    else q.category = cat;
    if (mode === "saved") q.savedOnly = true;
    if (mode === "social") q.kind = kind === "all" || kind === "rss" || kind === "gnews" ? "reddit" : kind;
    else q.kind = kind;
    return q;
  }

  useEffect(() => {
    void api.feed.trending().then(setTrends);
  }, [version]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const t = setTimeout(() => {
      void api.feed.list(buildQuery(0)).then((list) => {
        if (!alive) return;
        setItems(list);
        setHasMore(list.length === PAGE_SIZE);
        setLoading(false);
      });
    }, search ? 250 : 0);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, version, search, kind, unreadOnly, arabicOnly, interestsOnly, sort, tag, cat]);

  async function loadMore(): Promise<void> {
    const more = await api.feed.list(buildQuery(items.length));
    setItems((s) => [...s, ...more]);
    setHasMore(more.length === PAGE_SIZE);
  }

  async function save(id: number, saved: boolean): Promise<void> {
    await api.feed.save(id, saved);
    setItems((s) => s.map((a) => (a.id === id ? { ...a, saved: saved ? 1 : 0 } : a)));
    toast(saved ? "حُفظ الخبر" : "أُزيل من المحفوظات", "ok");
    onChanged();
  }

  async function markAll(): Promise<void> {
    const n = await api.feed.markAllRead(mode === "ai" ? "ai" : mode === "tech" ? "tech" : cat);
    toast(`عُلّم ${n} خبر كمقروء`, "ok");
    setItems((s) => s.map((a) => ({ ...a, read: 1 })));
    onChanged();
  }

  // سحب للتحديث على اللمس
  function onTouchStart(e: React.TouchEvent): void {
    if ((scroller.current?.scrollTop ?? 1) <= 0) touchY.current = e.touches[0].clientY;
  }
  function onTouchMove(e: React.TouchEvent): void {
    if (touchY.current === null) return;
    const dy = e.touches[0].clientY - touchY.current;
    setPull(dy > 0 ? Math.min(dy, 120) : 0);
  }
  async function onTouchEnd(): Promise<void> {
    const p = pull;
    touchY.current = null;
    setPull(0);
    if (p > 70) await onRefresh();
  }

  const t = TITLES[mode] ?? TITLES.feed;
  const socialKinds: { id: "all" | SourceKind; label: string }[] =
    mode === "social"
      ? [{ id: "reddit", label: "👽 Reddit" }, { id: "x", label: "𝕏 تويتر" }]
      : [{ id: "all", label: "كل المصادر" }, { id: "rss", label: "📡 مواقع" }, { id: "gnews", label: "🗞️ أخبار Google" }, { id: "reddit", label: "👽 Reddit" }, { id: "x", label: "𝕏 تويتر" }];
  const hasInterests = (settings?.interests?.length ?? 0) > 0;

  return (
    <div className="h-full flex flex-col">
      <header className="page-pad pt-5 pb-3 flex flex-col gap-3">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="hide-narrow">
            <h1 className="text-2xl">{t.title}</h1>
            <div className="text-xs muted">{t.hint}</div>
          </div>
          <div className="ms-auto w-80 max-w-full flex-1 md:flex-none">
            <input id="feed-search" className="input" placeholder="🔍 ابحث في الأخبار (عربي أو إنجليزي)…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="filters-row">
          {(mode === "feed" || mode === "saved" || mode === "social") && (
            <>
              {(["all", "ai", "tech"] as const).map((c) => (
                <button key={c} className={`chip ${cat === c ? "active" : ""}`} onClick={() => setCat(c)}>
                  {c === "all" ? "الكل" : c === "ai" ? "✦ AI" : "💻 تقنية"}
                </button>
              ))}
              <span className="mx-1 hide-narrow" style={{ color: "var(--border)" }}>|</span>
            </>
          )}
          {socialKinds.map((k) => (
            <button key={k.id} className={`chip ${(mode === "social" ? (kind === "x" ? "x" : "reddit") : kind) === k.id ? "active" : ""}`} onClick={() => setKind(k.id)}>
              {k.label}
            </button>
          ))}
          <span className="mx-1 hide-narrow" style={{ color: "var(--border)" }}>|</span>
          {SORTS.map((s) => (
            <button key={s.id} className={`chip ${sort === s.id ? "active" : ""}`} onClick={() => setSort(s.id)}>{s.label}</button>
          ))}
          <span className="mx-1 hide-narrow" style={{ color: "var(--border)" }}>|</span>
          <button className={`chip ${unreadOnly ? "active" : ""}`} onClick={() => setUnreadOnly((v) => !v)}>غير المقروء</button>
          <button className={`chip ${arabicOnly ? "active" : ""}`} onClick={() => setArabicOnly((v) => !v)}>عربي أصلي</button>
          {hasInterests && <button className={`chip ${interestsOnly ? "active" : ""}`} onClick={() => setInterestsOnly((v) => !v)}>⭐ اهتماماتي</button>}
          <button className="chip" onClick={() => void markAll()} title="تعليم الكل كمقروء">✓ قرأت الكل</button>
          <span className="ms-auto text-xs muted hide-narrow">{items.length} خبر</span>
        </div>
        {(trends.length > 0 || tag) && (
          <div className="filters-row">
            <span className="text-xs muted whitespace-nowrap">🔥 الأكثر تداولًا:</span>
            {tag && <button className="chip active" onClick={() => setTag(null)}>{tag} ✕</button>}
            {trends.filter((x) => x.tag !== tag).slice(0, 8).map((x) => (
              <button key={x.tag} className="chip" onClick={() => setTag(x.tag)}>{x.tag} <span className="muted">{x.count}</span></button>
            ))}
          </div>
        )}
      </header>
      <div ref={scroller} className="flex-1 overflow-y-auto page-pad pt-0" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={() => void onTouchEnd()}>
        {pull > 0 && (
          <div className="text-center text-xs muted py-2" style={{ height: pull / 2 }}>{pull > 70 ? "أفلت للتحديث ↻" : "اسحب للتحديث ↓"}</div>
        )}
        {loading ? (
          <div className="py-20 text-center"><Spinner label="جارٍ التحميل…" /></div>
        ) : items.length === 0 ? (
          <div>
            <Empty title={search ? "لا نتائج مطابقة" : interestsOnly ? "لا أخبار تطابق اهتماماتك بعد" : mode === "saved" ? "لا محفوظات بعد" : "لا أخبار بعد"} hint={search ? "جرّب كلمات أخرى، أو اطلب من الوكيل البحث في الويب." : "اضغط «تحديث الأخبار» لجلب أحدث الأخبار من المصادر."} />
            {search && (
              <div className="text-center -mt-10">
                <button className="btn btn-accent" onClick={() => onAsk(`ابحث في الويب وReddit وX عن آخر الأخبار حول: ${search}، ولخّص أهم ما وجدت بالعربية مع المصادر.`)}>✨ ابحث في الويب عبر الوكيل</button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className={`feed-grid ${settings?.compactView ? "compact" : ""}`}>
              {items.map((a) => (
                <ArticleCard key={a.id} a={a} onOpen={onOpen} onSave={save} showImage={settings?.showImages !== false} compact={Boolean(settings?.compactView)} interests={settings?.interests ?? []} />
              ))}
            </div>
            {hasMore && (
              <div className="text-center py-6">
                <button className="btn" onClick={() => void loadMore()}>عرض المزيد</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
