import { useEffect, useState } from "react";
import type { Analysis, Article, Settings } from "@shared/types";
import { api } from "@/lib/api";
import { fullDate, host, num } from "@/lib/format";
import { CategoryBadge, Empty, KindIcon, Lightbox, Spinner, useToast } from "@/components/ui";

const SENTIMENT: Record<Analysis["sentiment"], string> = { positive: "إيجابي", negative: "سلبي", neutral: "محايد", mixed: "متباين" };
const CONFIDENCE: Record<Analysis["confidence"], { label: string; color: string }> = {
  confirmed: { label: "مؤكد رسميًا", color: "var(--ok)" },
  reported: { label: "منقول عن مصادر", color: "var(--warn)" },
  speculation: { label: "تخمين / شائعة", color: "var(--danger)" },
};

export function ArticlePage({ id, onBack, onOpen, onAsk, onChanged, settings }: {
  id: number;
  onBack: () => void;
  onOpen: (id: number) => void;
  onAsk: (prompt: string) => void;
  onChanged: () => void;
  settings: Settings | null;
}) {
  const [a, setA] = useState<Article | null>(null);
  const [related, setRelated] = useState<Article[]>([]);
  const [view, setView] = useState<"ar" | "orig">("ar");
  const [busy, setBusy] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    let alive = true;
    setA(null);
    setView("ar");
    void (async () => {
      const first = await api.feed.get(id);
      if (!alive || !first) return;
      setA(first);
      void api.feed.markRead(id, true).then(onChanged);
      void api.feed.related(id).then((r) => alive && setRelated(r));
      let cur = first;
      if (!cur.detailsFetched) {
        setBusy("جلب التفاصيل والصور من المصدر…");
        cur = await api.feed.details(id);
        if (!alive) return;
        setA(cur);
      }
      if (settings?.autoTranslate !== false && cur.lang !== "ar" && (!cur.titleAr || (cur.contentText && !cur.contentAr))) {
        setBusy("ترجمة المحتوى إلى العربية…");
        try {
          cur = await api.feed.translate(id, true);
          if (alive) setA(cur);
        } catch (e) {
          if (alive) toast((e as Error).message, "error");
        }
      }
      if (alive) setBusy(null);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function run(label: string, fn: () => Promise<Article | void>): Promise<void> {
    setBusy(label);
    try {
      const r = await fn();
      if (r) setA(r);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  async function analyze(force: boolean): Promise<void> {
    await run("تحليل الخبر…", async () => {
      const analysis = await api.feed.analyze(id, force);
      setA((cur) => (cur ? { ...cur, analysis } : cur));
    });
  }

  if (!a) return <div className="p-10"><Spinner label="جارٍ الفتح…" /></div>;

  const isAr = a.lang === "ar";
  const title = view === "ar" ? a.titleAr || a.title : a.title;
  const showOriginal = !isAr && view === "orig";
  const html = showOriginal ? a.contentHtml : a.contentAr || (isAr ? a.contentHtml : null);
  const summary = view === "ar" ? a.summaryAr || a.summary : a.summary;
  const hero = a.imageUrl ?? a.images[0] ?? null;
  const gallery = a.images.filter((i) => i !== hero);
  const analysis = a.analysis;
  const extra = a.extra as { subreddit?: string; permalink?: string; handle?: string; publisher?: string; links?: string[]; retweets?: number };

  return (
    <div className="h-full overflow-y-auto">
      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
      <div className="max-w-5xl mx-auto page-pad">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <button className="btn btn-ghost hide-narrow" onClick={onBack}>→ رجوع</button>
          <span className="ms-auto" />
          {!isAr && (
            <div className="flex gap-1">
              <button className={`chip ${view === "ar" ? "active" : ""}`} onClick={() => setView("ar")}>العربية</button>
              <button className={`chip ${view === "orig" ? "active" : ""}`} onClick={() => setView("orig")}>النص الأصلي</button>
            </div>
          )}
          <button className="btn" onClick={() => void run("إعادة جلب التفاصيل…", () => api.feed.details(id, true))} disabled={Boolean(busy)}>🔄 إعادة الجلب</button>
          {!isAr && (
            <button className="btn" onClick={() => void run("ترجمة المحتوى…", () => api.feed.translate(id, true))} disabled={Boolean(busy)}>🌐 ترجمة كاملة</button>
          )}
          <button
            className="btn"
            onClick={() => {
              void api.feed.save(id, !a.saved);
              setA({ ...a, saved: a.saved ? 0 : 1 });
              onChanged();
            }}
          >
            {a.saved ? "🔖 محفوظ" : "🏷️ حفظ"}
          </button>
          <button className="btn btn-primary" onClick={() => void api.feed.openExternal(a.url)}>فتح المصدر ↗</button>
        </div>

        {busy && (
          <div className="mb-3 text-sm flex items-center gap-2" style={{ color: "var(--muted)" }}><span className="spinner" /> {busy}</div>
        )}

        <div className="flex items-center gap-2 text-xs mb-3 flex-wrap" style={{ color: "var(--muted)" }}>
          <CategoryBadge category={a.category} />
          <span className="inline-flex items-center gap-1"><KindIcon kind={a.sourceKind} /> {a.sourceName}</span>
          {extra.publisher && <span>· {extra.publisher}</span>}
          <span>· {host(a.url)}</span>
          <span>· {fullDate(a.publishedAt)}</span>
          {a.author && <span>· {a.author}</span>}
          {a.sourceKind === "reddit" && <span>· ▲ {num(a.score)} · 💬 {num(a.comments)} تعليق</span>}
          {a.sourceKind === "x" && <span>· ♥ {num(a.score)} · 🔁 {num(extra.retweets ?? 0)}</span>}
        </div>

        <h1 className="article-title text-2xl md:text-3xl font-bold leading-snug mb-2" dir="auto">{title}</h1>
        {!isAr && view === "ar" && a.titleAr && a.titleAr !== a.title && (
          <div className="text-sm mb-3" dir="ltr" style={{ color: "var(--muted)", textAlign: "left" }}>{a.title}</div>
        )}
        {a.tags.length > 0 && (
          <div className="flex gap-1 flex-wrap mb-4">
            {a.tags.map((t) => <span key={t} className="badge badge-muted">{t}</span>)}
          </div>
        )}

        {hero && (
          <img src={hero} alt="" className="hero-img w-full rounded-2xl mb-5 cursor-zoom-in" style={{ objectFit: "cover", border: "1px solid var(--border)" }} referrerPolicy="no-referrer" onClick={() => setLightbox(hero)} onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
        )}

        <div className="article-grid">
          <div className="min-w-0">
            {summary && !html && (
              <p className="prose mb-4" dir="auto" style={{ color: "var(--ink-2)" }}>{summary}</p>
            )}
            {summary && html && (
              <p className="mb-4 text-[15px] leading-relaxed panel p-4" dir="auto" style={{ color: "var(--ink-2)" }}>{summary}</p>
            )}
            {html ? (
              <div className={`prose ${showOriginal && a.lang !== "ar" ? "ltr" : ""}`} dir={showOriginal ? "ltr" : "auto"} dangerouslySetInnerHTML={{ __html: html }} onClick={(e) => {
                const t = e.target as HTMLElement;
                if (t.tagName === "A") {
                  e.preventDefault();
                  const href = (t as HTMLAnchorElement).href;
                  if (href) void api.feed.openExternal(href);
                }
                if (t.tagName === "IMG") setLightbox((t as HTMLImageElement).src);
              }} />
            ) : a.contentText ? (
              <div className={`prose ${!isAr && view === "orig" ? "ltr" : ""}`} dir="auto">
                {a.contentText.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
              </div>
            ) : !busy ? (
              <div className="panel p-5 text-sm" style={{ color: "var(--muted)" }}>
                {a.detailsError ? `تعذّر جلب النص الكامل: ${a.detailsError}` : "لا يتوفر نص كامل لهذا الخبر."}
                <div className="mt-2 flex gap-2">
                  <button className="btn btn-sm" onClick={() => void api.feed.openExternal(a.url)}>اقرأ في الموقع الأصلي ↗</button>
                  <button className="btn btn-sm" onClick={() => onAsk(`اقرأ هذا الرابط ولخّصه لي بالعربية مع أهم النقاط: ${a.url}`)}>اطلب من الوكيل قراءته ✨</button>
                </div>
              </div>
            ) : null}
            {!isAr && view === "ar" && html && !a.contentAr && a.contentHtml && (
              <div className="text-xs mt-2" style={{ color: "var(--muted)" }}>يُعرض النص الأصلي لأن الترجمة الكاملة غير متاحة بعد.</div>
            )}
            {extra.links && extra.links.length > 0 && (
              <div className="mt-4 panel p-3 text-sm">
                <div className="font-semibold mb-1">روابط في المنشور</div>
                {extra.links.map((l) => (
                  <div key={l}><a href={l} className="underline" style={{ color: "var(--accent-2)" }} onClick={(e) => { e.preventDefault(); void api.feed.openExternal(l); }}>{l}</a></div>
                ))}
              </div>
            )}
            {gallery.length > 0 && (
              <div className="mt-6">
                <div className="font-semibold mb-2">الصور ({gallery.length})</div>
                <div className="gallery">
                  {gallery.map((img) => <img key={img} src={img} alt="" referrerPolicy="no-referrer" loading="lazy" onClick={() => setLightbox(img)} onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />)}
                </div>
              </div>
            )}
          </div>

          <aside className="flex flex-col gap-4">
            <div className="panel p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="font-bold">✨ تحليل الوكيل</div>
                <span className="ms-auto" />
                {analysis && <span className="badge badge-muted">{analysis.engine === "llm" ? "بالذكاء الاصطناعي" : "تلخيص محلي"}</span>}
              </div>
              {!analysis ? (
                <div className="text-sm" style={{ color: "var(--muted)" }}>
                  <p className="mb-3">احصل على ملخص عربي، النقاط الرئيسية، ولماذا يهم هذا الخبر.</p>
                  <button className="btn btn-primary w-full justify-center" onClick={() => void analyze(false)} disabled={Boolean(busy)}>حلّل الخبر</button>
                  {!settings?.anthropicApiKey && <p className="mt-2 text-[11px]">بلا مفتاح API يُستخدم تلخيص استخلاصي محلي. أضف مفتاح Anthropic من الإعدادات لتحليل أعمق.</p>}
                </div>
              ) : (
                <div className="text-sm flex flex-col gap-3">
                  <div className="flex gap-2 flex-wrap text-[11px]">
                    <span className="badge" style={{ background: "var(--panel-2)", color: CONFIDENCE[analysis.confidence].color }}>● {CONFIDENCE[analysis.confidence].label}</span>
                    <span className="badge badge-muted">النبرة: {SENTIMENT[analysis.sentiment]}</span>
                  </div>
                  {analysis.summary && <p className="leading-relaxed" dir="auto">{analysis.summary}</p>}
                  {analysis.keyPoints.length > 0 && (
                    <div>
                      <div className="font-semibold mb-1">النقاط الرئيسية</div>
                      <ul className="list-disc ps-5 flex flex-col gap-1" dir="auto">
                        {analysis.keyPoints.map((k, i) => <li key={i}>{k}</li>)}
                      </ul>
                    </div>
                  )}
                  {analysis.whyItMatters && (
                    <div>
                      <div className="font-semibold mb-1">لماذا يهم؟</div>
                      <p dir="auto">{analysis.whyItMatters}</p>
                    </div>
                  )}
                  {analysis.entities.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {analysis.entities.map((e) => <span key={e} className="badge badge-muted">{e}</span>)}
                    </div>
                  )}
                  <button className="btn btn-sm" onClick={() => void analyze(true)} disabled={Boolean(busy)}>إعادة التحليل</button>
                </div>
              )}
              <button className="btn w-full justify-center mt-3" onClick={() => onAsk(`حلّل هذا الخبر بالتفصيل (المعرّف #${a.id}): «${a.titleAr || a.title}». ابحث عن تغطيات أخرى وردود الفعل على Reddit وX، وقارن المصادر، وبيّن ما هو مؤكد وما هو تخمين.`)}>
                اسأل الوكيل عن هذا الخبر ✨
              </button>
            </div>

            {extra.permalink && (
              <div className="panel p-4 text-sm">
                <div className="font-semibold mb-1">👽 r/{extra.subreddit}</div>
                <button className="btn btn-sm" onClick={() => void api.feed.openExternal(extra.permalink!)}>فتح النقاش على Reddit ↗</button>
              </div>
            )}

            {related.length > 0 && (
              <div className="panel p-4">
                <div className="font-bold mb-2">أخبار ذات صلة</div>
                <div className="flex flex-col gap-2">
                  {related.map((r) => (
                    <div key={r.id} className="text-sm cursor-pointer hover:underline line-2" dir="auto" onClick={() => onOpen(r.id)}>
                      <span style={{ color: "var(--muted)" }}>{r.sourceName} · </span>{r.titleAr || r.title}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
        {!a.contentText && !a.summary && !busy && <Empty title="لا محتوى" />}
      </div>
    </div>
  );
}
