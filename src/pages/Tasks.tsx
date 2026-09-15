/** لوحة مهام الإداري: Kanban بسحب وإفلات، أولويات، استحقاق، وتفكيك الأهداف بالذكاء الاصطناعي. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { Badge, Button, EmptyState, Field, Input, Modal, PageHeader, Select, Textarea, useUi } from "../components/ui";
import { Icon } from "../components/icons";
import { formatDate, todayISO } from "@shared/text";
import type { ExtractedTask, Task, TaskPriority, TaskStats, TaskStatus } from "@shared/types";
import type { PageId } from "../App";

const COLUMNS: { id: TaskStatus; label: string; hint: string }[] = [
  { id: "todo", label: "للتنفيذ", hint: "ما لم يبدأ بعد" },
  { id: "doing", label: "قيد العمل", hint: "ما تعمل عليه الآن" },
  { id: "done", label: "منجز", hint: "ما أُنهي" },
];

const PRIORITY: Record<TaskPriority, { label: string; color: string }> = {
  low: { label: "منخفضة", color: "var(--series-neutral)" },
  normal: { label: "عادية", color: "var(--info)" },
  high: { label: "عالية", color: "var(--warn)" },
  urgent: { label: "عاجلة", color: "var(--danger)" },
};

type Draft = Partial<Task> & { title: string };

const emptyDraft = (): Draft => ({ title: "", description: "", priority: "normal", status: "todo", due_date: "", tags: "" });

export default function TasksPage({ newTaskSignal, onNavigate }: { newTaskSignal: number; onNavigate: (p: PageId, id?: number, q?: string) => void }) {
  const { toast, confirm } = useUi();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [filter, setFilter] = useState("");
  const [dragId, setDragId] = useState<number | null>(null);
  const [over, setOver] = useState<TaskStatus | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiGoal, setAiGoal] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiTasks, setAiTasks] = useState<(ExtractedTask & { keep: boolean })[] | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await api.tasks.list();
    setTasks(res.tasks);
    setStats(res.stats);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (newTaskSignal > 0) setDraft(emptyDraft());
  }, [newTaskSignal]);

  const today = todayISO();
  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? tasks.filter((t) => `${t.title} ${t.description ?? ""} ${t.tags ?? ""}`.toLowerCase().includes(q)) : tasks;
  }, [tasks, filter]);

  const byStatus = (s: TaskStatus) => visible.filter((t) => t.status === s);

  const save = async () => {
    if (!draft?.title.trim()) {
      toast("عنوان المهمة مطلوب", "danger");
      return;
    }
    if (draft.id) await api.tasks.update(draft.id, draft);
    else await api.tasks.create(draft);
    setDraft(null);
    toast(draft.id ? "تم تحديث المهمة" : "أُضيفت المهمة", "ok");
    await load();
  };

  const move = async (task: Task, status: TaskStatus, beforeId?: number) => {
    const column = tasks.filter((t) => t.status === status && t.id !== task.id).map((t) => t.id);
    const idx = beforeId ? column.indexOf(beforeId) : -1;
    if (idx >= 0) column.splice(idx, 0, task.id);
    else column.push(task.id);
    // تحديث متفائل
    setTasks((list) => list.map((t) => (t.id === task.id ? { ...t, status } : t)));
    await api.tasks.reorder(status, column);
    if (status === "done" && task.status !== "done") toast("أحسنت — مهمة منجزة ✓", "ok");
    await load();
  };

  const runAi = async () => {
    if (!aiGoal.trim()) return;
    setAiBusy(true);
    setAiError(null);
    setAiTasks(null);
    const res = await api.ai.extractTasks(aiGoal, "goal");
    setAiBusy(false);
    if (!res.ok) {
      setAiError(res.message ?? "تعذّر التوليد");
      return;
    }
    setAiTasks(res.tasks.map((t) => ({ ...t, keep: true })));
  };

  const addAiTasks = async () => {
    const rows = (aiTasks ?? []).filter((t) => t.keep);
    if (rows.length === 0) return;
    await api.tasks.bulkCreate(
      rows.map((t) => ({ title: t.title, description: t.description, priority: t.priority, due_date: t.due_date, tags: t.tags.join("، "), source: "ai" })),
    );
    toast(`أُضيفت ${rows.length} مهمة`, "ok");
    setAiOpen(false);
    setAiTasks(null);
    setAiGoal("");
    await load();
  };

  return (
    <div>
      <PageHeader
        title="لوحة المهام"
        subtitle="اسحب المهام بين الأعمدة، وحوّل أي هدف كبير إلى خطوات بالذكاء الاصطناعي"
        actions={
          <>
            <Input placeholder="تصفية…" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 200 }} />
            <Button onClick={() => setAiOpen(true)}>
              <Icon name="wand" size={15} /> تفكيك هدف بالذكاء الاصطناعي
            </Button>
            <Button variant="primary" onClick={() => setDraft(emptyDraft())}>
              <Icon name="plus" size={15} /> مهمة جديدة
            </Button>
          </>
        }
      />

      {stats && (
        <div className="grid gap-3 mb-4 stagger" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
          <MiniStat label="للتنفيذ" value={stats.todo} />
          <MiniStat label="قيد العمل" value={stats.doing} tone="var(--info)" />
          <MiniStat label="منجز" value={stats.done} tone="var(--ok)" />
          <MiniStat label="مستحقة اليوم" value={stats.dueToday} tone={stats.dueToday ? "var(--warn)" : undefined} />
          <MiniStat label="متأخرة" value={stats.overdue} tone={stats.overdue ? "var(--danger)" : undefined} />
        </div>
      )}

      <div className="kanban-grid">
        {COLUMNS.map((col) => {
          const items = byStatus(col.id);
          return (
            <div
              key={col.id}
              className={`panel kanban-col p-3 ${over === col.id ? "over" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                if (over !== col.id) setOver(col.id);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={async (e) => {
                e.preventDefault();
                setOver(null);
                const id = Number(e.dataTransfer.getData("text/task"));
                const task = tasks.find((t) => t.id === id);
                setDragId(null);
                if (task) await move(task, col.id);
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-bold flex items-center gap-2">
                    {col.label}
                    <span className="badge" style={{ fontSize: 11 }}>
                      {items.length}
                    </span>
                  </div>
                  <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                    {col.hint}
                  </div>
                </div>
                {col.id !== "done" && (
                  <Button size="sm" variant="ghost" className="btn-icon" onClick={() => setDraft({ ...emptyDraft(), status: col.id })} title="إضافة هنا">
                    <Icon name="plus" size={15} />
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                {items.length === 0 && (
                  <div className="text-center text-xs py-8" style={{ color: "var(--muted)", border: "1px dashed var(--border)", borderRadius: 12 }}>
                    {col.id === "done" ? "لا شيء منجز بعد" : "أفلت مهمة هنا"}
                  </div>
                )}
                {items.map((t) => {
                  const overdue = t.status !== "done" && t.due_date && t.due_date < today;
                  const dueToday = t.status !== "done" && t.due_date === today;
                  return (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/task", String(t.id));
                        e.dataTransfer.effectAllowed = "move";
                        setDragId(t.id);
                      }}
                      onDragEnd={() => setDragId(null)}
                      onDrop={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setOver(null);
                        const id = Number(e.dataTransfer.getData("text/task"));
                        const task = tasks.find((x) => x.id === id);
                        setDragId(null);
                        if (task && task.id !== t.id) await move(task, col.id, t.id);
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      className={`panel task-card p-3 flex gap-2 ${dragId === t.id ? "dragging" : ""} ${t.status === "done" ? "done" : ""}`}
                      onDoubleClick={() => setDraft({ ...t, title: t.title })}
                      style={{ background: "var(--panel-2)" }}
                    >
                      <span className="priority-bar" style={{ background: PRIORITY[t.priority].color }} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="task-title font-semibold text-[13.5px] leading-snug">{t.title}</div>
                          <button
                            className="btn btn-ghost btn-sm btn-icon shrink-0"
                            style={{ width: 26, height: 26, padding: 4 }}
                            title={t.status === "done" ? "إعادة فتح" : "إنجاز"}
                            onClick={() => void move(t, t.status === "done" ? "todo" : "done")}
                          >
                            <Icon name={t.status === "done" ? "refresh" : "check"} size={14} />
                          </button>
                        </div>
                        {t.description && (
                          <p className="text-xs mt-1 line-clamp-2" style={{ color: "var(--muted)" }}>
                            {t.description}
                          </p>
                        )}
                        <div className="flex items-center gap-1.5 flex-wrap mt-2">
                          <Badge tone={t.priority === "urgent" ? "danger" : t.priority === "high" ? "warn" : "default"}>{PRIORITY[t.priority].label}</Badge>
                          {t.due_date && (
                            <span className={`badge ${overdue ? "badge-danger" : dueToday ? "badge-warn" : ""}`} style={{ fontSize: 11 }}>
                              <Icon name="calendar" size={11} /> {overdue ? "متأخرة · " : dueToday ? "اليوم · " : ""}
                              {formatDate(t.due_date)}
                            </span>
                          )}
                          {(t.tags ?? "")
                            .split("،")
                            .map((x) => x.trim())
                            .filter(Boolean)
                            .slice(0, 3)
                            .map((tag) => (
                              <span key={tag} className="badge" style={{ fontSize: 11 }}>
                                #{tag}
                              </span>
                            ))}
                          {t.source === "ai" && (
                            <span className="badge badge-accent" style={{ fontSize: 11 }} title="أُنشئت بواسطة المساعد الذكي">
                              <Icon name="sparkles" size={11} />
                            </span>
                          )}
                          {t.source_url && (
                            <button
                              className="badge badge-info"
                              style={{ fontSize: 11, cursor: "pointer", border: "none" }}
                              title={t.source_url}
                              onClick={(e) => {
                                e.stopPropagation();
                                onNavigate("portals", undefined, `${t.source_portal ?? "outlook"}|${t.source_url}`);
                              }}
                            >
                              <Icon name="external" size={11} /> المصدر
                            </button>
                          )}
                          <button
                            className="badge"
                            style={{ fontSize: 11, cursor: "pointer", border: "none" }}
                            title="اطلب من المساعد العمل على هذه المهمة"
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigate("assistant", undefined, `ساعدني في إنجاز هذه المهمة (رقم ${t.id}): «${t.title}»${t.description ? ` — ${t.description}` : ""}${t.due_date ? ` — الاستحقاق ${t.due_date}` : ""}. اقترح الخطوات، ونفّذ ما يمكن تنفيذه عبر البوابات، وحدّث حالة المهمة عند الانتهاء.`);
                            }}
                          >
                            <Icon name="sparkles" size={11} /> المساعد
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs mt-3" style={{ color: "var(--muted)" }}>
        نقرة مزدوجة على مهمة للتعديل · Ctrl+Shift+T لمهمة جديدة · يمكن أيضًا تكليف{" "}
        <button className="link" onClick={() => onNavigate("assistant")}>
          المساعد الذكي
        </button>{" "}
        بإضافة المهام أثناء المحادثة.
      </p>

      <Modal
        open={!!draft}
        title={draft?.id ? "تعديل المهمة" : "مهمة جديدة"}
        onClose={() => setDraft(null)}
        width={560}
        footer={
          <>
            {draft?.id && (
              <Button
                variant="danger"
                onClick={async () => {
                  if (!(await confirm(`حذف المهمة «${draft.title}»؟`))) return;
                  await api.tasks.remove(draft.id!);
                  setDraft(null);
                  await load();
                }}
              >
                حذف
              </Button>
            )}
            <span className="flex-1" />
            <Button onClick={() => setDraft(null)}>إلغاء</Button>
            <Button variant="primary" onClick={() => void save()}>
              حفظ
            </Button>
          </>
        }
      >
        {draft && (
          <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <Field label="العنوان *" className="col-span-2">
              <Input autoFocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} onKeyDown={(e) => e.key === "Enter" && void save()} />
            </Field>
            <Field label="التفاصيل" className="col-span-2">
              <Textarea value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} style={{ minHeight: 70 }} />
            </Field>
            <Field label="الأولوية">
              <Select value={draft.priority ?? "normal"} onChange={(e) => setDraft({ ...draft, priority: e.target.value as TaskPriority })}>
                {(Object.keys(PRIORITY) as TaskPriority[]).map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY[p].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="الحالة">
              <Select value={draft.status ?? "todo"} onChange={(e) => setDraft({ ...draft, status: e.target.value as TaskStatus })}>
                {COLUMNS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="تاريخ الاستحقاق">
              <Input type="date" value={draft.due_date ?? ""} onChange={(e) => setDraft({ ...draft, due_date: e.target.value })} />
            </Field>
            <Field label="وسوم (مفصولة بـ ،)">
              <Input value={draft.tags ?? ""} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} placeholder="قاعات، اعتماد" />
            </Field>
          </div>
        )}
      </Modal>

      <Modal
        open={aiOpen}
        title="تفكيك هدف إلى مهام"
        onClose={() => setAiOpen(false)}
        width={680}
        footer={
          <>
            <Button onClick={() => setAiOpen(false)}>إغلاق</Button>
            {aiTasks ? (
              <Button variant="primary" onClick={() => void addAiTasks()} disabled={!aiTasks.some((t) => t.keep)}>
                إضافة {aiTasks.filter((t) => t.keep).length} مهمة
              </Button>
            ) : (
              <Button variant="primary" onClick={() => void runAi()} disabled={aiBusy || !aiGoal.trim()}>
                <Icon name="wand" size={15} /> {aiBusy ? "جارٍ التحليل…" : "توليد المهام"}
              </Button>
            )}
          </>
        }
      >
        <Field label="اكتب الهدف أو المشروع" hint="مثال: تنظيم ملتقى اللغات في نهاية الفصل بمشاركة 4 جهات خارجية">
          <Textarea value={aiGoal} onChange={(e) => setAiGoal(e.target.value)} style={{ minHeight: 90 }} disabled={aiBusy} />
        </Field>
        {aiError && (
          <p className="text-sm mt-2" style={{ color: "var(--danger)" }}>
            {aiError}
          </p>
        )}
        {aiBusy && (
          <div className="mt-3 space-y-2">
            <div className="skeleton" style={{ height: 40 }} />
            <div className="skeleton" style={{ height: 40, width: "85%" }} />
            <div className="skeleton" style={{ height: 40, width: "70%" }} />
          </div>
        )}
        {aiTasks && (
          <div className="mt-3 space-y-2 stagger">
            {aiTasks.length === 0 && <EmptyState title="لم يُقترح أي مهام" />}
            {aiTasks.map((t, i) => (
              <label key={i} className="panel p-3 flex gap-3 items-start cursor-pointer" style={{ opacity: t.keep ? 1 : 0.5 }}>
                <input type="checkbox" checked={t.keep} onChange={(e) => setAiTasks(aiTasks.map((x, k) => (k === i ? { ...x, keep: e.target.checked } : x)))} className="mt-1" />
                <span className="priority-bar" style={{ background: PRIORITY[t.priority].color }} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-sm">{t.title}</span>
                  {t.description && (
                    <span className="block text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                      {t.description}
                    </span>
                  )}
                  <span className="flex gap-1.5 mt-1.5 flex-wrap">
                    <Badge>{PRIORITY[t.priority].label}</Badge>
                    {t.due_date && <Badge>{formatDate(t.due_date)}</Badge>}
                    {t.tags.map((tag) => (
                      <Badge key={tag}>#{tag}</Badge>
                    ))}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="panel stat-card p-3">
      <div className="text-xs" style={{ color: "var(--muted)" }}>
        {label}
      </div>
      <div className="text-2xl font-extrabold tabular-nums" style={{ color: tone ?? "var(--ink)" }}>
        {value}
      </div>
    </div>
  );
}
