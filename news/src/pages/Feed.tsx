import { useEffect, useRef, useState } from "react";
import type { Article, FeedQuery, SourceKind } from "@shared/types";
import { api } from "@/lib/api";
import { ArticleCard } from "@/components/ArticleCard";
import { Empty, Spinner, useToast } from "@/components/ui";
import type { Page } from "@/App";

const PAGE_SIZE = 48;

const TITLES: Record<string, { title: string; hint: string }> = {
  feed: { title: "آخر الأخبار", hint: "كل ما هو جديد في التقنية والذكاء الاصطناعي من كل المصادر" },
  ai: { title: "الذكاء الاصطناعي", hint: "النماذج، الشركات، الأبحاث، والأدوات" },
  tech: { title: "التقنية", hint: "الأجهزة، البرمجيات، الشركات، والأمن السيبراني" },
  social: { title: "Reddit و X", hint: "ما يتداوله المجتمع التقني الآن" },
  saved: { title: "المحفوظات", hint: "الأخبار التي حفظتها للرجوع إليها" },
};

export function FeedPage({ mode, version, onOpen, onChanged }: { mode: Page; version: number; onOpen: (id: number) => void; onChanged: () => void }) {
  const [items, setItems] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<"all" | SourceKind>("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cat, setCat] = useState<"all" | "ai" | "tech">("all");
  const { toast } = useToast();
  const scroller = useRef<HTMLDivElement>(null);

  function buildQuery(offset: number): FeedQuery {
    const q: FeedQuery = { limit: PAGE_SIZE, offset, search, unreadOnly };
    if (mode === "ai") q.category = "ai";
    else if (mode === "tech") q.category = "tech";
    else q.category = cat;
    if (mode === "saved") q.savedOnly = true;
    if (mode === "social") q.kind = kind === "all" || kind === "rss" || kind === "gnews" ? "reddit" : kind;
    else q.kind = kind;
    return q;
  }

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
  }, [mode, version, search, kind, unreadOnly, cat]);

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

  const t = TITLES[mode] ?? TITLES.feed;
  const socialKinds: { id: "all" | SourceKind; label: string }[] =
    mode === "social"
      ? [{ id: "reddit", label: "👽 Reddit" }, { id: "x", label: "𝕏 تويتر" }]
      : [{ id: "all", label: "كل المصادر" }, { id: "rss", label: "📡 مواقع" }, { id: "gnews", label: "🗞️ أخبار Google" }, { id: "reddit", label: "👽 Reddit" }, { id: "x", label: "𝕏 تويتر" }];

  return (
    <div className="h-full flex flex-col">
      <header className="px-6 pt-5 pb-3 flex flex-col gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-xl font-bold">{t.title}</h1>
            <div className="text-xs" style={{ color: "var(--muted)" }}>{t.hint}</div>
          </div>
          <div className="ms-auto w-80">
            <input id="feed-search" className="input" placeholder="🔍 ابحث في الأخبار (عربي أو إنجليزي)…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(mode === "feed" || mode === "saved" || mode === "social") && (
            <>
              {(["all", "ai", "tech"] as const).map((c) => (
                <button key={c} className={`chip ${cat === c ? "active" : ""}`} onClick={() => setCat(c)}>
                  {c === "all" ? "الكل" : c === "ai" ? "🤖 ذكاء اصطناعي" : "💻 تقنية"}
                </button>
              ))}
              <span className="mx-1" style={{ color: "var(--border)" }}>|</span>
            </>
          )}
          {socialKinds.map((k) => (
            <button key={k.id} className={`chip ${(mode === "social" ? (kind === "x" ? "x" : "reddit") : kind) === k.id ? "active" : ""}`} onClick={() => setKind(k.id)}>
              {k.label}
            </button>
          ))}
          <span className="mx-1" style={{ color: "var(--border)" }}>|</span>
          <button className={`chip ${unreadOnly ? "active" : ""}`} onClick={() => setUnreadOnly((v) => !v)}>غير المقروء فقط</button>
          <span className="ms-auto text-xs" style={{ color: "var(--muted)" }}>{items.length} خبر</span>
        </div>
      </header>
      <div ref={scroller} className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="py-20 text-center"><Spinner label="جارٍ التحميل…" /></div>
        ) : items.length === 0 ? (
          <Empty title={search ? "لا نتائج مطابقة" : mode === "saved" ? "لا محفوظات بعد" : "لا أخبار بعد"} hint={search ? "جرّب كلمات أخرى، أو اسأل الوكيل الذكي ليبحث في الويب." : "اضغط «تحديث الأخبار» لجلب أحدث الأخبار من المصادر."} />
        ) : (
          <>
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
              {items.map((a) => (
                <ArticleCard key={a.id} a={a} onOpen={onOpen} onSave={save} />
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
