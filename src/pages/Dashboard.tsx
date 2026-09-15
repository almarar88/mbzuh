import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Badge, Button, EmptyState, Panel } from "../components/ui";
import { Icon, type IconName } from "../components/icons";
import { BarList, Meter, SegmentedBar } from "../components/Charts";
import { formatDate, formatDateTime, todayISO } from "@shared/text";
import type { Conflict, DashboardStats, Task, TaskStats } from "@shared/types";
import type { PageId } from "../App";

const SHORTCUTS: { label: string; desc: string; page: PageId; icon: IconName; accent?: boolean }[] = [
  { label: "نظام الجامعة الموحّد", desc: "افتح لوحة UMS بمظهر حديث", page: "ums", icon: "globe", accent: true },
  { label: "المساعد الذكي", desc: "خطابات، بريد، تلخيص، مهام", page: "assistant", icon: "sparkles", accent: true },
  { label: "لوحة المهام", desc: "ما عليك إنجازه اليوم", page: "tasks", icon: "tasks" },
  { label: "مولّد التقارير", desc: "PDF / Excel جاهز للإدارة", page: "reports", icon: "chart" },
];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "صباح الخير";
  if (h < 17) return "مساء الخير";
  return "مساء الخير";
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

function StatCard({ label, value, hint, tone, icon }: { label: string; value: number; hint?: string; tone?: "danger" | "ok"; icon: IconName }) {
  const n = useCountUp(value);
  const color = tone === "danger" ? "var(--danger)" : tone === "ok" ? "var(--ok)" : "var(--ink)";
  return (
    <Panel className="stat-card panel-hover min-w-0">
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs truncate" style={{ color: "var(--muted)" }}>
          {label}
        </div>
        <span style={{ color: "var(--accent)", opacity: 0.8 }}>
          <Icon name={icon} size={16} />
        </span>
      </div>
      <div className="text-[26px] font-extrabold tabular-nums leading-tight" style={{ color }}>
        {n}
      </div>
      {hint && (
        <div className="text-xs mt-1 truncate" style={{ color: "var(--muted)" }}>
          {hint}
        </div>
      )}
    </Panel>
  );
}

export default function DashboardPage({ onNavigate }: { onNavigate: (page: PageId, id?: number, q?: string) => void }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [activity, setActivity] = useState<{ id: number; at: string; action: string; detail: string }[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskStats, setTaskStats] = useState<TaskStats | null>(null);
  const [adminName, setAdminName] = useState("");

  useEffect(() => {
    void (async () => {
      const [s, c, a, t, ai] = await Promise.all([
        api.dashboard.stats(),
        api.conflicts.all(),
        api.dashboard.activity(),
        api.tasks.list(),
        api.ai.settings(),
      ]);
      setStats(s);
      setConflicts(c);
      setActivity(a);
      setTasks(t.tasks);
      setTaskStats(t.stats);
      setAdminName(ai.adminName);
    })();
  }, []);

  if (!stats) {
    return (
      <div className="space-y-3">
        <div className="skeleton" style={{ height: 120, borderRadius: 22 }} />
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(6, 1fr)" }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 92 }} />
          ))}
        </div>
      </div>
    );
  }

  const errors = conflicts.filter((c) => c.severity === "error");
  const warnings = conflicts.filter((c) => c.severity === "warning");
  const today = todayISO();
  const focus = tasks
    .filter((t) => t.status !== "done")
    .sort((a, b) => {
      const pa = { urgent: 0, high: 1, normal: 2, low: 3 }[a.priority];
      const pb = { urgent: 0, high: 1, normal: 2, low: 3 }[b.priority];
      const da = a.due_date ?? "9999";
      const db = b.due_date ?? "9999";
      return da === db ? pa - pb : da.localeCompare(db);
    })
    .slice(0, 6);

  return (
    <div className="stagger">
      <div className="hero mb-4">
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="hero-title">
              {greeting()}
              {adminName ? `، ${adminName.split(" ")[0]}` : ""} 👋
            </div>
            <div className="hero-sub">
              {taskStats && taskStats.overdue > 0
                ? `لديك ${taskStats.overdue} مهمة متأخرة و${taskStats.dueToday} مستحقة اليوم.`
                : taskStats && taskStats.dueToday > 0
                  ? `لديك ${taskStats.dueToday} مهمة مستحقة اليوم — وفّقك الله.`
                  : errors.length > 0
                    ? `يوجد ${errors.length} تعارض في الجدول يحتاج معالجة.`
                    : "كل شيء تحت السيطرة. اختر من أين تبدأ."}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {SHORTCUTS.map((s) => (
              <button
                key={s.page}
                onClick={() => onNavigate(s.page)}
                className="text-start rounded-2xl px-4 py-3 flex items-center gap-3"
                style={{
                  background: s.accent ? "rgba(201,162,74,0.16)" : "rgba(255,255,255,0.07)",
                  border: `1px solid ${s.accent ? "rgba(201,162,74,0.5)" : "rgba(255,255,255,0.14)"}`,
                  color: "#f5f7fb",
                  cursor: "pointer",
                  minWidth: 190,
                  transition: "transform .14s, background .14s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}
              >
                <span
                  className="inline-flex items-center justify-center shrink-0"
                  style={{ width: 36, height: 36, borderRadius: 12, background: "rgba(255,255,255,0.1)", color: s.accent ? "#f1dfae" : "#fff" }}
                >
                  <Icon name={s.icon} size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block font-bold text-sm">{s.label}</span>
                  <span className="block text-[11.5px] opacity-75 truncate">{s.desc}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {errors.length > 0 && (
        <Panel className="mb-4" padded>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h3 className="font-bold mb-1" style={{ color: "var(--danger)" }}>
                ⚠ يوجد {errors.length} تعارض يحتاج معالجة
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

      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <StatCard label="الدورات الجارية" value={stats.activeCourses} hint={`${stats.plannedCourses} دورة مخطّطة`} icon="book" />
        <StatCard label="المدربون النشطون" value={stats.activeTrainers} hint={`من أصل ${stats.trainers}`} icon="users" />
        <StatCard label="الطلبة المسجلون" value={stats.students} hint={`${stats.enrollments} تسجيل`} icon="graduate" />
        <StatCard label="القاعات" value={stats.rooms} hint={`${stats.bookingsThisWeek} حجز هذا الأسبوع`} icon="building" />
        <StatCard label="المهام المفتوحة" value={taskStats ? taskStats.todo + taskStats.doing : 0} hint={`${taskStats?.done ?? 0} منجزة`} icon="tasks" />
        <StatCard label="التعارضات" value={errors.length} tone={errors.length ? "danger" : "ok"} hint={`${warnings.length} تنبيه`} icon="calendar" />
      </div>

      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "minmax(300px, 1.2fr) minmax(280px, 1fr) minmax(280px, 1fr)" }}>
        <Panel className="h-full">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm">تركيز اليوم</h3>
            <Button size="sm" variant="ghost" onClick={() => onNavigate("tasks")}>
              كل المهام <Icon name="arrowLeft" size={13} />
            </Button>
          </div>
          {focus.length === 0 ? (
            <EmptyState
              title="لا توجد مهام مفتوحة"
              hint="أضف مهمة أو اطلب من المساعد تفكيك هدف"
              action={
                <Button size="sm" onClick={() => onNavigate("tasks")}>
                  + مهمة
                </Button>
              }
            />
          ) : (
            <ul className="space-y-2">
              {focus.map((t) => {
                const overdue = t.due_date && t.due_date < today;
                const dueToday = t.due_date === today;
                return (
                  <li key={t.id} className="flex items-center gap-2 text-sm">
                    <button
                      className="btn btn-ghost btn-icon"
                      style={{ width: 26, height: 26, padding: 3, borderRadius: 8, border: "1px solid var(--border)" }}
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

        <Panel className="h-full">
          <h3 className="font-bold text-sm mb-1 flex items-center gap-2">
            <Icon name="sparkles" size={15} style={{ color: "var(--accent)" }} /> اسأل المساعد
          </h3>
          <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
            اختصارات جاهزة تُرسل مباشرة إلى المحادثة
          </p>
          <div className="flex flex-col gap-2">
            {[
              "لخّص وضع الدورات والتعارضات اليوم",
              "ما المهام المتأخرة وما ترتيب معالجتها؟",
              "اكتب تعميمًا بمواعيد بداية الدورات القادمة",
              "اقترح خطة عمل لهذا الأسبوع",
            ].map((q) => (
              <button key={q} className="chip justify-start" onClick={() => onNavigate("assistant", undefined, q)}>
                <Icon name="send" size={12} /> {q}
              </button>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <BarList title="الدورات حسب اللغة" hint="الدورات الجارية والمخطّطة" data={stats.byLanguage.map((r) => ({ label: r.label, value: r.count }))} />
        <BarList title="الطلبة حسب المستوى" hint="عدد التسجيلات في كل مستوى" data={stats.byLevel.map((r) => ({ label: r.label, value: r.count }))} />
        <SegmentedBar title="حالة الدورات" data={stats.byStatus.map((r) => ({ label: r.label, value: r.count }))} />
      </div>

      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <Meter label="متوسط نسبة الحضور" value={stats.attendanceRate} hint="محسوبة من كل سجلات الحضور المدخلة أو المستوردة" />
        <BarList title="إشغال القاعات" hint="مجموع الساعات الأسبوعية لكل قاعة" data={stats.roomUtilisation.map((r) => ({ label: r.room, value: r.hours }))} unit=" س" />
        <Panel>
          <h3 className="font-bold text-sm mb-3">آخر العمليات</h3>
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
    </div>
  );
}
