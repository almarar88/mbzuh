/** مركز التنبيهات: المهام المتأخرة والمستحقة، أجندة اليوم، التعارضات، نتائج الروتينات، والتحديثات. */
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { Icon, type IconName } from "./icons";
import { nativeOpenExternal } from "../platform/native";
import type { AgendaItem, TaskStats, UpdateInfo } from "@shared/types";
import type { PageId } from "../App";

export interface Notice {
  id: string;
  icon: IconName;
  title: string;
  detail?: string;
  tone: "default" | "info" | "warn" | "danger" | "ok";
  page?: PageId;
  query?: string;
  url?: string;
}

export function useNotices(taskStats: TaskStats | null, conflictCount: number, page: PageId) {
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [routineNotes, setRoutineNotes] = useState<Notice[]>([]);
  const checked = useRef(false);

  useEffect(() => {
    void api.agenda.day().then(setAgenda).catch(() => undefined);
  }, [page, taskStats]);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    const t = setTimeout(() => void api.system.update().then(setUpdate).catch(() => undefined), 4000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const off = window.dynamo.on("app:routine", (r) => {
      const info = r as { id: number; name: string; ok: boolean; summary?: string };
      const note: Notice = { id: `routine-${info.id}-${Date.now()}`, icon: "clock", title: `${info.ok ? "اكتمل" : "فشل"} الروتين «${info.name}»`, detail: info.summary, tone: info.ok ? "ok" : "danger", page: "assistant" };
      setRoutineNotes((list) => [note, ...list].slice(0, 5));
    });
    return off;
  }, []);

  const notices = useMemo(() => {
    const out: Notice[] = [];
    if (update?.available) out.push({ id: "update", icon: "download", title: `تحديث متاح: الإصدار ${update.latest}`, detail: "نزّل النسخة الجديدة من صفحة الإصدارات", tone: "info", url: update.url });
    if (taskStats?.overdue) out.push({ id: "overdue", icon: "alert", title: `${taskStats.overdue} مهمة متأخرة`, tone: "danger", page: "tasks" });
    if (taskStats?.dueToday) out.push({ id: "due", icon: "tasks", title: `${taskStats.dueToday} مهمة مستحقة اليوم`, tone: "warn", page: "tasks" });
    for (const a of agenda.filter((x) => x.kind !== "task").slice(0, 4)) out.push({ id: `${a.kind}-${a.id}`, icon: a.kind === "session" ? "book" : "building", title: `${a.time ?? ""} ${a.title}`.trim(), detail: a.subtitle, tone: "info", page: a.kind === "session" ? "schedule" : "rooms" });
    if (conflictCount) out.push({ id: "conflicts", icon: "calendar", title: `${conflictCount} تعارض في جدول الدورات`, tone: "danger", page: "schedule" });
    out.push(...routineNotes);
    return out;
  }, [update, taskStats, agenda, conflictCount, routineNotes]);

  return { notices, update };
}

export function NotificationsBell({ notices, onNavigate, compact }: { notices: Notice[]; onNavigate: (p: PageId, id?: number, q?: string) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const urgent = notices.filter((n) => n.tone === "danger").length;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const tone = (t: Notice["tone"]) => (t === "danger" ? "var(--danger)" : t === "warn" ? "var(--warn)" : t === "ok" ? "var(--ok)" : t === "info" ? "var(--info)" : "var(--muted)");

  return (
    <div ref={ref} className="relative">
      <button className={`btn btn-icon ${compact ? "btn-sm" : ""}`} title="التنبيهات" onClick={() => setOpen((v) => !v)} style={{ position: "relative" }}>
        <Icon name="bell" size={compact ? 16 : 18} />
        {notices.length > 0 && (
          <span className="nav-badge" style={{ position: "absolute", top: -2, insetInlineEnd: -2, background: urgent ? "var(--danger)" : "var(--c-purple)", fontSize: 10, minWidth: 18 }}>
            {notices.length}
          </span>
        )}
      </button>
      {open && (
        <div className="panel pop notices" style={{ boxShadow: "var(--shadow)" }}>
          <div className="px-3 py-2 font-bold text-sm" style={{ borderBottom: "1px solid var(--border)" }}>
            التنبيهات
          </div>
          <div className="scroll-y" style={{ maxHeight: 360 }}>
            {notices.length === 0 ? (
              <p className="p-5 text-center text-sm" style={{ color: "var(--muted)" }}>
                لا تنبيهات — كل شيء تحت السيطرة ✓
              </p>
            ) : (
              notices.map((n) => (
                <button
                  key={n.id}
                  className="w-full text-start px-3 py-2.5 flex items-start gap-2.5"
                  style={{ background: "transparent", border: "none", cursor: "pointer", borderBottom: "1px solid color-mix(in srgb, var(--border) 60%, transparent)" }}
                  onClick={() => {
                    setOpen(false);
                    if (n.url) nativeOpenExternal(n.url);
                    else if (n.page) onNavigate(n.page, undefined, n.query);
                  }}
                >
                  <span className="mt-0.5" style={{ color: tone(n.tone) }}>
                    <Icon name={n.icon} size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold truncate" style={{ color: "var(--ink)" }}>
                      {n.title}
                    </span>
                    {n.detail && (
                      <span className="block text-[11.5px] line-clamp-2" style={{ color: "var(--muted)" }}>
                        {n.detail}
                      </span>
                    )}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
