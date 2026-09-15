import type { Article } from "@shared/types";
import { num, readingTime, timeAgo } from "@/lib/format";
import { KindIcon } from "./ui";

function interestMatch(a: Article, interests: string[]): string | null {
  const hay = `${a.title} ${a.titleAr ?? ""} ${a.summary ?? ""} ${a.tags.join(" ")}`.toLowerCase();
  return interests.find((w) => w.trim() && hay.includes(w.trim().toLowerCase())) ?? null;
}

export function ArticleCard({ a, onOpen, onSave, showImage = true, compact = false, interests = [] }: {
  a: Article;
  onOpen: (id: number) => void;
  onSave: (id: number, saved: boolean) => void;
  showImage?: boolean;
  compact?: boolean;
  interests?: string[];
}) {
  const title = a.titleAr || a.title;
  const summary = a.summaryAr || a.summary || "";
  const original = a.titleAr && a.titleAr !== a.title ? a.title : null;
  const hit = interests.length ? interestMatch(a, interests) : null;
  const mins = readingTime(a.contentText || summary);

  if (compact) {
    return (
      <article className="card card-compact" onClick={() => onOpen(a.id)} style={{ opacity: a.read ? 0.82 : 1 }}>
        {showImage && a.imageUrl && <img className="card-thumb" src={a.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />}
        <div className="min-w-0 flex-1 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-[11px] muted">
            <span className={`badge ${a.category === "ai" ? "badge-ai" : "badge-tech"}`}>{a.category === "ai" ? "AI" : "تقنية"}</span>
            <span className="truncate"><KindIcon kind={a.sourceKind} /> {a.sourceName}</span>
            <span>· {timeAgo(a.publishedAt)}</span>
            {hit && <span className="badge" style={{ background: "var(--accent)", color: "#fff" }}>⭐ {hit}</span>}
          </div>
          <h3 className="font-semibold text-[14.5px] leading-relaxed line-2" dir="auto">{title}</h3>
        </div>
        <button className="btn btn-ghost btn-sm btn-round" onClick={(e) => { e.stopPropagation(); onSave(a.id, !a.saved); }}>{a.saved ? "🔖" : "🏷️"}</button>
      </article>
    );
  }

  return (
    <article className="card" onClick={() => onOpen(a.id)} style={{ opacity: a.read ? 0.82 : 1 }}>
      <div className="card-media" style={showImage ? undefined : { aspectRatio: "auto", minHeight: 52 }}>
        {showImage && a.imageUrl ? (
          <img className="card-img" src={a.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
        ) : showImage ? (
          <div className="card-img-placeholder">{a.category === "ai" ? "✦" : "💻"}</div>
        ) : (
          <div style={{ height: 52 }} />
        )}
        <div className="card-overlay-top">
          <span className="pill-glass">{a.category === "ai" ? "✦ AI" : "💻 تقنية"}</span>
          <span className="pill-glass">🕒 {timeAgo(a.publishedAt)}</span>
          {hit && <span className="pill-glass" style={{ background: "var(--accent)" }}>⭐ {hit}</span>}
        </div>
        <button className="fab" title="فتح الخبر" onClick={(e) => { e.stopPropagation(); onOpen(a.id); }}>↗</button>
      </div>
      <div className="card-body">
        <div className="flex items-center gap-2 text-xs muted">
          <span className="inline-flex items-center gap-1 truncate"><KindIcon kind={a.sourceKind} /> {a.sourceName}</span>
          {a.sourceKind === "reddit" && <span>· ▲ {num(a.score)} · 💬 {num(a.comments)}</span>}
          {a.sourceKind === "x" && a.score > 0 && <span>· ♥ {num(a.score)}</span>}
          {mins > 0 && <span className="ms-auto whitespace-nowrap">📖 {mins} د</span>}
        </div>
        <h3 className="font-semibold text-[15.5px] leading-relaxed line-2" dir="auto">{title}</h3>
        {original && <div className="text-xs line-2 muted" dir="ltr" style={{ textAlign: "left" }}>{original}</div>}
        {summary && <p className="text-[13px] line-3" dir="auto" style={{ color: "var(--ink-2)" }}>{summary}</p>}
        <div className="flex items-center gap-1.5 mt-auto pt-1 text-xs">
          {a.tags.slice(0, 2).map((t) => (
            <span key={t} className="badge badge-muted">{t}</span>
          ))}
          <button
            className="btn btn-ghost btn-sm btn-round ms-auto"
            title={a.saved ? "إزالة من المحفوظات" : "حفظ"}
            onClick={(e) => {
              e.stopPropagation();
              onSave(a.id, !a.saved);
            }}
          >
            {a.saved ? "🔖" : "🏷️"}
          </button>
        </div>
      </div>
    </article>
  );
}
