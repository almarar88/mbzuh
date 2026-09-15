import { useEffect, useState } from "react";
import type { AnalyticsData } from "@shared/types";
import { api } from "@/lib/api";
import { KindIcon, Spinner } from "@/components/ui";

const KIND_LABEL: Record<string, string> = { rss: "مواقع", reddit: "Reddit", x: "X", gnews: "أخبار Google" };

export function AnalyticsPage({ onOpenTag }: { onOpenTag: (tag: string) => void }) {
  const [d, setD] = useState<AnalyticsData | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);

  useEffect(() => {
    void api.feed.analytics().then(setD);
  }, []);

  if (!d) return <div className="p-10"><Spinner label="جارٍ الحساب…" /></div>;

  const max = Math.max(1, ...d.days.map((x) => x.total));
  const delta = d.prevWeekTotal ? Math.round(((d.weekTotal - d.prevWeekTotal) / d.prevWeekTotal) * 100) : null;
  const todayIdx = d.days.length - 1;
  const maxSource = Math.max(1, ...d.topSources.map((s) => s.count));

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto page-pad flex flex-col gap-4">
        <div>
          <h1 className="text-2xl">تحليلات الأسبوع</h1>
          <div className="text-xs muted">ماذا جمع التطبيق خلال آخر 7 أيام، ومن أين، وعن ماذا</div>
        </div>

        <div className="two-col">
          <div className="panel p-5">
            <div className="flex items-start gap-2">
              <div>
                <div className="text-4xl leading-none">{d.weekTotal}<span className="text-sm muted ms-1">خبر</span></div>
                <div className="text-xs muted mt-2">هذا الأسبوع</div>
              </div>
              <span className="ms-auto btn btn-round" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>✦</span>
            </div>
            {delta !== null && (
              <div className="mt-3 text-xs flex items-center gap-2">
                <span className="muted">{delta >= 0 ? "أكثر من الأسبوع الماضي" : "أقل من الأسبوع الماضي"}</span>
                <span className="badge" style={{ background: "var(--dark)", color: "var(--dark-ink)" }}>{delta >= 0 ? "+" : ""}{delta}%</span>
              </div>
            )}
          </div>
          <div className="panel-dark p-5">
            <div className="text-4xl leading-none">{Math.round(d.aiShare * 100)}%<span className="text-sm ms-1" style={{ color: "var(--dark-muted)" }}>AI</span></div>
            <div className="text-xs mt-2" style={{ color: "var(--dark-muted)" }}>نسبة أخبار AI من مجمل الأسبوع</div>
            <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: "var(--dark-3)" }}>
              <div className="h-full rounded-full" style={{ width: `${Math.round(d.aiShare * 100)}%`, background: "var(--accent)" }} />
            </div>
          </div>
        </div>

        <div className="panel p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="font-semibold">الأخبار يوميًا</div>
            <span className="ms-auto" />
            <button className={`chip ${!table ? "active" : ""}`} onClick={() => setTable(false)}>رسم</button>
            <button className={`chip ${table ? "active" : ""}`} onClick={() => setTable(true)}>جدول</button>
          </div>
          {table ? (
            <table className="w-full text-sm">
              <thead><tr className="muted text-xs"><th className="text-start py-1">اليوم</th><th className="text-start py-1">الأخبار</th><th className="text-start py-1">AI</th></tr></thead>
              <tbody>{d.days.map((x) => <tr key={x.date} style={{ borderTop: "1px solid var(--border)" }}><td className="py-1.5">{x.label} <span className="muted text-xs">{x.date.slice(5)}</span></td><td>{x.total}</td><td>{x.ai}</td></tr>)}</tbody>
            </table>
          ) : (
            <div className="chart" role="img" aria-label="عدد الأخبار لكل يوم خلال آخر 7 أيام">
              <div className="chart-bars">
                {d.days.map((x, i) => {
                  const h = Math.max(4, Math.round((x.total / max) * 100));
                  const active = i === todayIdx || hover === i;
                  return (
                    <div key={x.date} className="chart-col" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onTouchStart={() => setHover(i)}>
                      {(hover === i || (hover === null && i === todayIdx)) && (
                        <div className="chart-tip">{x.total} خبر · {x.ai} AI</div>
                      )}
                      <div className="chart-bar-wrap">
                        <div className={`chart-bar ${active ? "active" : ""}`} style={{ height: `${h}%` }} />
                      </div>
                      <div className={`chart-label ${i === todayIdx ? "active" : ""}`}>{x.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="two-col">
          <div className="panel p-5">
            <div className="font-semibold mb-3">أهم المصادر ({d.topSources.length})</div>
            <div className="flex flex-col gap-2.5">
              {d.topSources.map((s) => (
                <div key={s.name} className="flex items-center gap-3 text-sm">
                  <span className="btn btn-round btn-sm" style={{ background: "var(--panel-2)" }}><KindIcon kind={s.kind} /></span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2"><span className="truncate">{s.name}</span><span className="ms-auto muted text-xs">{s.count}</span></div>
                    <div className="h-1.5 rounded-full mt-1" style={{ background: "var(--panel-2)" }}><div className="h-full rounded-full" style={{ width: `${(s.count / maxSource) * 100}%`, background: "var(--dark)" }} /></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="panel p-5">
              <div className="font-semibold mb-3">المواضيع الأكثر تداولًا</div>
              <div className="flex gap-2 flex-wrap">
                {d.topTags.map((t) => (
                  <button key={t.tag} className="chip" onClick={() => onOpenTag(t.tag)}>{t.tag} <span className="muted">{t.count}</span></button>
                ))}
                {d.topTags.length === 0 && <span className="muted text-sm">لا بيانات بعد</span>}
              </div>
            </div>
            <div className="panel p-5">
              <div className="font-semibold mb-3">حسب نوع المصدر</div>
              <div className="flex flex-col gap-2 text-sm">
                {d.bySourceKind.map((k) => (
                  <div key={k.kind} className="flex items-center gap-2"><KindIcon kind={k.kind} /> {KIND_LABEL[k.kind] ?? k.kind}<span className="ms-auto muted">{k.count}</span></div>
                ))}
              </div>
            </div>
            <div className="panel p-5 text-sm flex flex-col gap-1.5">
              <div className="flex"><span>مقروء</span><span className="ms-auto muted">{d.readCount}</span></div>
              <div className="flex"><span>محفوظ</span><span className="ms-auto muted">{d.savedCount}</span></div>
              <div className="flex"><span>مترجم إلى العربية</span><span className="ms-auto muted">{d.translatedCount}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
