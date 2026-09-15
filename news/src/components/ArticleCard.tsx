import type { Article } from "@shared/types";
import { num, timeAgo } from "@/lib/format";
import { CategoryBadge, KindIcon } from "./ui";

export function ArticleCard({ a, onOpen, onSave }: { a: Article; onOpen: (id: number) => void; onSave: (id: number, saved: boolean) => void }) {
  const title = a.titleAr || a.title;
  const summary = a.summaryAr || a.summary || "";
  const original = a.titleAr && a.titleAr !== a.title ? a.title : null;
  return (
    <article className="card" onClick={() => onOpen(a.id)} style={{ opacity: a.read ? 0.78 : 1 }}>
      {a.imageUrl ? (
        <img className="card-img" src={a.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
      ) : (
        <div className="card-img-placeholder">{a.category === "ai" ? "🤖" : "💻"}</div>
      )}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
          <CategoryBadge category={a.category} />
          <span className="inline-flex items-center gap-1"><KindIcon kind={a.sourceKind} /> {a.sourceName}</span>
          <span className="ms-auto">{timeAgo(a.publishedAt)}</span>
        </div>
        <h3 className="font-semibold text-[15px] leading-relaxed line-2" dir="auto">{title}</h3>
        {original && <div className="text-xs line-2" dir="ltr" style={{ color: "var(--muted)", textAlign: "left" }}>{original}</div>}
        {summary && <p className="text-[13px] line-3" dir="auto" style={{ color: "var(--ink-2)" }}>{summary}</p>}
        <div className="flex items-center gap-2 mt-auto pt-1 text-xs" style={{ color: "var(--muted)" }}>
          {a.sourceKind === "reddit" && <span>▲ {num(a.score)} · 💬 {num(a.comments)}</span>}
          {a.sourceKind === "x" && a.score > 0 && <span>♥ {num(a.score)}</span>}
          {a.tags.slice(0, 2).map((t) => (
            <span key={t} className="badge badge-muted">{t}</span>
          ))}
          <button
            className="btn btn-ghost btn-sm ms-auto"
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
