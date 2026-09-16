import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { Badge, Button, EmptyState, Panel, useUi } from "../components/ui";
import { Icon, type IconName } from "../components/icons";
import { BarList, SegmentedBar } from "../components/Charts";
import { uid } from "../lib/useAiChat";
import { Markdown } from "../components/Markdown";
import { formatDate, formatDateTime, todayISO } from "@shared/text";
import { PORTAL_COLORS, type PortalsState } from "@shared/portals";
import type { AgendaItem, AiBrief, AiRoutine, AiStreamEvent, Conflict, DashboardStats, Task, TaskStats } from "@shared/types";
import type { PageId } from "../App";

/** «موجز اليوم»: يجمعه المساعد من البريد والتقويم والمهام ويُحفظ لليوم. */
function BriefCard({ hasKey, onNavigate }: { hasKey: boolean; onNavigate: (page: PageId, id?: number, q?: string) => void }) {
  const { toast } = useUi();
  const [brief, setBrief] = useState<AiBrief | null>(null);
  const [live, setLive] = useState("");
  const [running, setRunning] = useState(false);
  const [open, setOpen] = useState(false);
  const jobRef = useRef<string | null>(null);

  useEffect(() => {
    void api.ai.brief().then(setBrief);
    const off = window.dynamo.on("app:ai", (raw) => {
      const ev = raw as AiStreamEvent;
      if (ev.jobId !== jobRef.current) return;
      if (ev.type === "text") setLive((t) => t + ev.text);
      if (ev.type === "done" || ev.type === "error" || ev.type === "refusal") {
        jobRef.current = null;
        setRunning(false);
        if (ev.type !== "done") toast(ev.message, "danger");
        void api.ai.brief().then(setBrief);
      }
    });
    return off;
  }, [toast]);

  const run = async () => {
    if (jobRef.current) return;
    const jobId = uid();
    jobRef.current = jobId;
    setRunning(true);
    setLive("");
    setOpen(true);
    await api.ai.briefRun(jobId);
  };

  const text = running ? live : brief?.text ?? "";
  return (
    <Panel className="mb-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="font-extrabold text-[15px] flex items-center gap-2">
            <Icon name="sparkles" size={15} style={{ color: "var(--accent)" }} /> موجز اليوم
            {brief && !running && <Badge tone="ok">{formatDateTime(brief.created_at)}</Badge>}
            {running && <span className="live-dot" style={{ background: "var(--accent)" }} />}
          </h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
            يجمعه المساعد من بريدك واجتماعاتك ومهامك: أهم الأولويات، ما يحتاج ردًا، والمتأخر.
          </p>
        </div>
        <div className="flex gap-2">
          {text && (
            <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
              {open ? "طيّ" : "عرض"}
            </Button>
          )}
          <Button size="sm" variant="primary" disabled={running || !hasKey} onClick={() => void run()} title={hasKey ? "" : "أضف مفتاح Claude API من الإعدادات"}>
            <Icon name={brief ? "refresh" : "wand"} size={13} /> {running ? "يجمع…" : brief ? "تحديث" : "جهّز موجز اليوم"}
          </Button>
        </div>
      </div>
      {open && text && (
        <div className="output-pane text-sm mt-3 p-3" style={{ background: "var(--panel-2)", borderRadius: 16, maxHeight: 360, overflow: "auto" }}>
          {running ? <span className="cursor-blink">{text}</span> : <Markdown text={text} />}
          {!running && (
            <div className="mt-3 flex gap-2 flex-wrap">
              <Button size="sm" onClick={() => onNavigate("assistant", undefined, "بناءً على موجز اليوم، رتّب لي خطة عمل لليوم بالساعات وابدأ بتنفيذ ما يمكن تنفيذه.")}>
                <Icon name="sparkles" size={13} /> حوّله إلى خطة يوم
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onNavigate("tasks")}>
                <Icon name="tasks" size={13} /> المهام
              </Button>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "صباح الخير" : "مساء الخير";
}

function useCountUp(target: number, ms = 700): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function Tile({ label, value, tone, icon, onClick }: { label: string; value: number; tone: "blue" | "purple" | "coral" | "lime" | "gold" | "dark"; icon: IconName; onClick?: () => void }) {
  const n = useCountUp(value);
  return (
    <button className={`tile tile-${tone} text-start`} onClick={onClick} style={{ border: tone === "dark" ? undefined : "none", cursor: onClick ? "pointer" : "default" }}>
      <div className="flex items-center justify-between">
        <span className="tile-value">{n}</span>
        <span style={{ opacity: 0.7 }}>
          <Icon name={icon} size={18} />
        </span>
      </div>
      <span className="tile-label">{label}</span>
    </button>
  );
}

export default function DashboardPage({ onNavigate }: { onNavigate: (page: PageId, id?: number, q?: string) => void }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [activity, setActivity] = useState<{ id: number; at: string; action: string; detail: string }[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskStats, setTaskStats] = useState<TaskStats | null>(null);
  const [adminName, setAdminName] = useState("");
  const [portals, setPortals] = useState<PortalsState | null>(null);
  const [showCourses, setShowCourses] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [routines, setRoutines] = useState<AiRoutine[]>([]);
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);

  useEffect(() => {
    void (async () => {
      const [s, c, a, t, ai, p, settings, r, ag] = await Promise.all([
        api.dashboard.stats(),
        api.conflicts.all(),
        api.dashboard.activity(),
        api.tasks.list(),
        api.ai.settings(),
        api.portal.state(),
        api.settings.all(),
        api.ai.routines(),
        api.agenda.day(),
      ]);
      setAgenda(ag);
      setStats(s);
      setConflicts(c);
      setActivity(a);
      setTasks(t.tasks);
      setTaskStats(t.stats);
      setAdminName(ai.adminName);
      setHasKey(ai.hasKey);
      setPortals(p);
      setRoutines(r);
      setShowCourses(settings.courses_open === "1" || s.courses > 0);
    })();
  }, []);

  if (!stats || !portals) {
    return (
      <div className="space-y-3">
        <div className="skeleton" style={{ height: 150, borderRadius: 26 }} />
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 104 }} />
          ))}
        </div>
      </div>
    );
  }

  const errors = conflicts.filter((c) => c.severity === "error");
  const today = todayISO();
  const open = tasks.filter((t) => t.status !== "done");
  const focus = open
    .sort((a, b) => {
      const pa = { urgent: 0, high: 1, normal: 2, low: 3 }[a.priority];
      const pb = { urgent: 0, high: 1, normal: 2, low: 3 }[b.priority];
      const da = a.due_date ?? "9999";
      const db = b.due_date ?? "9999";
      return da === db ? pa - pb : da.localeCompare(db);
    })
    .slice(0, 6);
  const featured = portals.portals.slice(0, 4);

  return (
    <div className="stagger">
      {/* البطل */}
      <div className="hero-grid mb-5">
        <div>
          <div className="hero-title">
            {greeting()}
            {adminName ? `، ${adminName.split(" ")[0]}` : ""} 👋
            <br />
            <span style={{ color: "var(--muted)", fontWeight: 700 }}>ماذا تريد أن تنجز اليوم؟</span>
          </div>
          <p className="hero-sub">
            {taskStats && taskStats.overdue > 0
              ? `لديك ${taskStats.overdue} مهمة متأخرة و${taskStats.dueToday} مستحقة اليوم.`
              : taskStats && taskStats.dueToday > 0
                ? `لديك ${taskStats.dueToday} مهمة مستحقة اليوم.`
                : errors.length > 0
                  ? `يوجد ${errors.length} تعارض في جدول الدورات يحتاج معالجة.`
                  : "كل شيء تحت السيطرة. البوابات والمساعد ومهامك في مكان واحد."}
          </p>
          <button className="search-pill mt-4" onClick={() => onNavigate("assistant")}>
            <Icon name="sparkles" size={18} style={{ color: "var(--accent)" }} />
            <span className="flex-1 text-[14px] truncate">اسأل المساعد: لخّص بريدي، ما اجتماعاتي اليوم، جهّز خطابًا…</span>
            <span className="btn btn-white btn-sm">ابدأ</span>
          </button>
          <div className="flex gap-2 flex-wrap mt-3">
            {[
              "لخّص أهم الرسائل في بريدي Outlook",
              "ما اجتماعاتي اليوم في Teams؟",
              "ما آخر التحديثات في لوحة الدورات Hub؟",
              "رتّب مهامي هذا الأسبوع",
            ].map((q) => (
              <button key={q} className="chip" onClick={() => onNavigate("assistant", undefined, q)}>
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* بطاقات البوابات المكدّسة */}
        <div className="stack">
          {featured.map((p, i) => {
            const c = PORTAL_COLORS[p.color];
            return (
              <button
                key={p.id}
                className="stack-card portal-card text-start"
                onClick={() => onNavigate("portals", undefined, p.id)}
                style={{ background: c.bg, color: c.ink, minHeight: 96, transform: `translateX(${(i % 2 ? -1 : 1) * i * 6}px) rotate(${(i % 2 ? 1 : -1) * 0.6}deg)`, zIndex: 10 - i }}
              >
                <div className="flex items-center gap-3">
                  <span className="portal-glyph" style={{ background: "rgba(255,255,255,.55)", color: c.ink }}>
                    {p.glyph}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-extrabold text-[15px] truncate">{p.name}</span>
                    <span className="block text-[12px] truncate" style={{ opacity: 0.75 }}>
                      {p.hint}
                    </span>
                  </span>
                  <span className="portal-arrow">
                    <Icon name="arrowLeft" size={16} />
                  </span>
                </div>
              </button>
            );
          })}
          <button className="btn btn-ghost btn-sm mt-3 w-full" onClick={() => onNavigate("portals")}>
            كل البوابات ({portals.portals.length}) <Icon name="arrowLeft" size={13} />
          </button>
        </div>
      </div>

      <BriefCard hasKey={hasKey} onNavigate={onNavigate} />

      {/* مؤشرات */}
      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <Tile label="مهام مفتوحة" value={taskStats ? taskStats.todo + taskStats.doing : 0} tone="blue" icon="tasks" onClick={() => onNavigate("tasks")} />
        <Tile label="قيد العمل" value={taskStats?.doing ?? 0} tone="purple" icon="clock" onClick={() => onNavigate("tasks")} />
        <Tile label="متأخرة" value={taskStats?.overdue ?? 0} tone="coral" icon="bell" onClick={() => onNavigate("tasks")} />
        <Tile label="منجزة" value={taskStats?.done ?? 0} tone="lime" icon="check" onClick={() => onNavigate("tasks")} />
        <Tile label="محاضر وملاحظات" value={stats.minutes} tone="dark" icon="minutes" onClick={() => onNavigate("minutes")} />
      </div>

      {errors.length > 0 && (
        <Panel className="mb-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h3 className="font-bold mb-1" style={{ color: "var(--danger)" }}>
                ⚠ يوجد {errors.length} تعارض في جدول الدورات
              </h3>
              <ul className="text-sm space-y-1" style={{ color: "var(--ink-2)" }}>
                {errors.slice(0, 3).map((c) => (
                  <li key={c.id}>• {c.message}</li>
                ))}
              </ul>
            </div>
            <Button onClick={() => onNavigate("schedule")}>عرض كاشف التعارض</Button>
          </div>
        </Panel>
      )}

      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        <Panel className="h-full">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-extrabold text-[15px]">تركيز اليوم</h3>
            <Button size="sm" variant="ghost" onClick={() => onNavigate("tasks")}>
              كل المهام <Icon name="arrowLeft" size={13} />
            </Button>
          </div>
          {focus.length === 0 ? (
            <EmptyState title="لا توجد مهام مفتوحة" hint="أضف مهمة أو اطلب من المساعد استخراجها من بريدك" action={<Button size="sm" onClick={() => onNavigate("tasks")}>+ مهمة</Button>} />
          ) : (
            <ul className="space-y-2">
              {focus.map((t) => {
                const overdue = t.due_date && t.due_date < today;
                const dueToday = t.due_date === today;
                return (
                  <li key={t.id} className="flex items-center gap-2 text-sm">
                    <button
                      className="btn btn-ghost btn-icon btn-sm"
                      style={{ width: 28, height: 28, border: "1px solid var(--border)" }}
                      title="إنجاز"
                      onClick={async () => {
                        await api.tasks.update(t.id, { status: "done" });
                        const r = await api.tasks.list();
                        setTasks(r.tasks);
                        setTaskStats(r.stats);
                      }}
                    >
                      <Icon name="check" size={13} />
                    </button>
                    <span className="truncate flex-1" style={{ color: "var(--ink-2)" }}>
                      {t.title}
                    </span>
                    {t.source_url && (
                      <button className="btn btn-ghost btn-sm btn-icon" style={{ width: 24, height: 24 }} title="فتح المصدر في البوابة" onClick={() => onNavigate("portals", undefined, `${t.source_portal ?? "outlook"}|${t.source_url}`)}>
                        <Icon name="external" size={12} />
                      </button>
                    )}
                    {t.priority === "urgent" && <Badge tone="danger">عاجلة</Badge>}
                    {t.priority === "high" && <Badge tone="warn">عالية</Badge>}
                    {t.due_date && (
                      <span className="text-xs tabular-nums shrink-0" style={{ color: overdue ? "var(--danger)" : dueToday ? "var(--warn)" : "var(--muted)" }}>
                        {overdue ? "متأخرة" : dueToday ? "اليوم" : formatDate(t.due_date)}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel className="h-full">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-extrabold text-[15px] flex items-center gap-2">
              <Icon name="calendar" size={15} style={{ color: "var(--c-blue)" }} /> أجندة اليوم
            </h3>
            <Button size="sm" variant="ghost" onClick={() => onNavigate("assistant", undefined, "اعرض أجندة اليوم كاملة (المهام والحصص والحجوزات والاجتماعات من التقويم) ورتّب لي اليوم بالساعات.")}>
              رتّب يومي <Icon name="sparkles" size={13} />
            </Button>
          </div>
          {agenda.filter((a) => a.kind !== "task").length === 0 ? (
            <EmptyState title="لا حصص أو حجوزات اليوم" hint="اجتماعات Teams وOutlook يجلبها المساعد في «موجز اليوم»" />
          ) : (
            <ul className="space-y-2">
              {agenda
                .filter((a) => a.kind !== "task")
                .slice(0, 7)
                .map((a) => (
                  <li key={`${a.kind}-${a.id}`} className="flex items-center gap-2 text-sm">
                    <span className="text-xs tabular-nums shrink-0" dir="ltr" style={{ color: "var(--muted)", minWidth: 84 }}>
                      {a.time}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate" style={{ color: "var(--ink-2)" }}>
                        {a.title}
                      </span>
                      <span className="block text-[11px] truncate" style={{ color: "var(--muted)" }}>
                        {a.subtitle}
                      </span>
                    </span>
                    <Badge tone={a.kind === "session" ? "info" : "default"}>{a.kind === "session" ? "حصة" : "حجز"}</Badge>
                  </li>
                ))}
            </ul>
          )}
        </Panel>

        <Panel className="h-full">
          <h3 className="font-extrabold text-[15px] mb-1 flex items-center gap-2">
            <Icon name="sparkles" size={15} style={{ color: "var(--accent)" }} /> أدوات سريعة
          </h3>
          <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
            قوالب جاهزة للمراسلات والمهام الإدارية
          </p>
          <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
            {[
              { label: "خطاب رسمي", q: "اكتب لي خطابًا رسميًا: " },
              { label: "ردّ على بريد", q: "اكتب ردًا مهنيًا على هذا البريد: " },
              { label: "محضر اجتماع", q: "نظّم هذه الملاحظات في محضر اجتماع: " },
              { label: "تعميم", q: "اكتب تعميمًا للموظفين بخصوص: " },
              { label: "ترجمة", q: "ترجم إلى الإنجليزية: " },
              { label: "خطة أسبوعية", q: "اقترح خطة عمل لهذا الأسبوع بناءً على مهامي المفتوحة" },
            ].map((x) => (
              <button key={x.label} className="chip justify-center" onClick={() => onNavigate("assistant", undefined, x.q)}>
                {x.label}
              </button>
            ))}
          </div>
          {routines.length > 0 && (
            <>
              <p className="text-xs mt-3 mb-1.5" style={{ color: "var(--muted)" }}>
                روتيناتك
              </p>
              <div className="flex gap-1.5 flex-wrap">
                {routines.slice(0, 4).map((r) => (
                  <button key={r.id} className="chip" title={r.prompt} onClick={() => onNavigate("assistant", undefined, r.prompt)}>
                    <Icon name="clock" size={12} /> {r.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </Panel>

        <Panel className="h-full">
          <h3 className="font-extrabold text-[15px] mb-3">آخر العمليات</h3>
          {activity.length === 0 ? (
            <EmptyState title="لا توجد عمليات مسجّلة بعد" />
          ) : (
            <ul className="space-y-1.5">
              {activity.slice(0, 8).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">
                    <span style={{ color: "var(--ink-2)" }}>{a.action}</span>
                    {a.detail && <span style={{ color: "var(--muted)" }}> — {a.detail}</span>}
                  </span>
                  <span className="text-xs shrink-0" style={{ color: "var(--muted)" }}>
                    {formatDateTime(a.at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* قسم الدورات (اختياري) */}
      <button className="section-title w-full" style={{ background: "none", border: "none", cursor: "pointer", justifyContent: "flex-start" }} onClick={() => setShowCourses((v) => !v)}>
        <Icon name="chevronDown" size={14} style={{ transform: showCourses ? "rotate(180deg)" : "none" }} /> إدارة الدورات — نظرة سريعة
      </button>
      {showCourses && (
        <div className="stagger">
          <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
            <Tile label="الدورات الجارية" value={stats.activeCourses} tone="dark" icon="book" onClick={() => onNavigate("courses")} />
            <Tile label="المدربون النشطون" value={stats.activeTrainers} tone="dark" icon="users" onClick={() => onNavigate("trainers")} />
            <Tile label="الطلبة" value={stats.students} tone="dark" icon="graduate" onClick={() => onNavigate("students")} />
            <Tile label="القاعات" value={stats.rooms} tone="dark" icon="building" onClick={() => onNavigate("rooms")} />
            <Tile label="التعارضات" value={errors.length} tone={errors.length ? "coral" : "dark"} icon="calendar" onClick={() => onNavigate("schedule")} />
          </div>
          <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            <BarList title="الدورات حسب اللغة" hint="الدورات الجارية والمخطّطة" data={stats.byLanguage.map((r) => ({ label: r.label, value: r.count }))} />
            <SegmentedBar title="حالة الدورات" data={stats.byStatus.map((r) => ({ label: r.label, value: r.count }))} />
            <Panel>
              <h3 className="font-bold text-sm mb-3">القادم خلال أسبوع</h3>
              {stats.upcoming.length === 0 ? (
                <EmptyState title="لا توجد مواعيد قريبة" />
              ) : (
                <ul className="space-y-2">
                  {stats.upcoming.map((u) => (
                    <li key={`${u.kind}-${u.id}`} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate" style={{ color: "var(--ink-2)" }}>
                        {u.title}
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        <Badge>{u.kind}</Badge>
                        <span className="text-xs tabular-nums" style={{ color: "var(--muted)" }}>
                          {formatDate(u.date)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
