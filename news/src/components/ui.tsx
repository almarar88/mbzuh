import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

interface ToastCtx {
  toast: (msg: string, kind?: "info" | "error" | "ok") => void;
}
const Ctx = createContext<ToastCtx>({ toast: () => undefined });

export function useToast(): ToastCtx {
  return useContext(Ctx);
}

export function UiProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string; kind: string }[]>([]);
  const toast = useCallback((msg: string, kind: "info" | "error" | "ok" = "info") => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, msg, kind }]);
    setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), kind === "error" ? 7000 : 3500);
  }, []);
  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-5 start-5 z-50 flex flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} className="toast" style={{ borderColor: t.kind === "error" ? "var(--danger)" : t.kind === "ok" ? "var(--ok)" : "var(--border)" }}>
            {t.msg}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <span className={`toggle ${on ? "on" : ""}`} onClick={() => onChange(!on)} role="switch" aria-checked={on} />
      {label && <span className="text-sm">{label}</span>}
    </label>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm" style={{ color: "var(--muted)" }}>
      <span className="spinner" />
      {label}
    </span>
  );
}

export function Empty({ icon = "📰", title, hint }: { icon?: string; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center" style={{ color: "var(--muted)" }}>
      <div className="text-5xl mb-3">{icon}</div>
      <div className="text-base font-semibold" style={{ color: "var(--ink-2)" }}>{title}</div>
      {hint && <div className="text-sm mt-1 max-w-md">{hint}</div>}
    </div>
  );
}

export function Lightbox({ src, onClose }: { src: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!src) return;
    const h = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [src, onClose]);
  if (!src) return null;
  return (
    <div className="lightbox" onClick={onClose}>
      <img src={src} alt="" referrerPolicy="no-referrer" />
    </div>
  );
}

export function CategoryBadge({ category }: { category: "ai" | "tech" }) {
  return <span className={`badge ${category === "ai" ? "badge-ai" : "badge-tech"}`}>{category === "ai" ? "🤖 ذكاء اصطناعي" : "💻 تقنية"}</span>;
}

export function KindIcon({ kind }: { kind: string }) {
  const map: Record<string, string> = { rss: "📡", reddit: "👽", x: "𝕏", gnews: "🗞️" };
  return <span title={kind}>{map[kind] ?? "📰"}</span>;
}
