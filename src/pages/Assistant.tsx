/**
 * المساعد الذكي: محادثة تعتمد أدوات تقرأ بيانات التطبيق والبوابات، وأدوات مهام جاهزة
 * (خطابات، بريد، تلخيص، ترجمة، تدقيق، محاضر، خطة أسبوعية…)، وروتينات محفوظة
 * تُنفَّذ يدويًا أو في وقت محدد.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { Badge, Button, EmptyState, Field, Input, Modal, Select, TabBar, Textarea, Toggle, useUi } from "../components/ui";
import { Icon } from "../components/icons";
import { ChatThread } from "../components/ChatThread";
import { uid, useAiChat } from "../lib/useAiChat";
import { formatDateTime } from "@shared/text";
import type { AiRoutine, AiSettings, AiStreamEvent, AiTemplateId } from "@shared/types";
import type { PageId } from "../App";

const SUGGESTIONS = [
  "افتح بريد Outlook ولخّص أهم الرسائل غير المقروءة، وحوّل ما فيها من طلبات إلى مهام.",
  "ما اجتماعاتي اليوم وغدًا في Teams؟",
  "افتح لوحة الدورات Hub واعرض لي آخر الدورات وحالتها.",
  "ابحث في SharePoint عن سياسة الإجازات ولخّصها لي.",
  "ما رصيد إجازاتي في OneHub؟",
  "اكتب مذكرة داخلية لطلب اعتماد قاعة إضافية بسبب ارتفاع أعداد المسجلين.",
  "اقترح خطة لهذا الأسبوع بناءً على مهامي المفتوحة.",
];

const TOOL_CARDS: { id: AiTemplateId; label: string; desc: string; icon: string }[] = [
  { id: "letter", label: "خطاب / مذكرة رسمية", desc: "من نقاط مختصرة إلى خطاب جامعي مكتمل الصيغة", icon: "📜" },
  { id: "email", label: "بريد إلكتروني", desc: "صياغة أو ردّ مهني بالعربية أو الإنجليزية", icon: "✉️" },
  { id: "minutes", label: "تنظيم محضر اجتماع", desc: "ملاحظات خام ← محضر بقرارات ومهام", icon: "📝" },
  { id: "summary", label: "تلخيص", desc: "ملخص تنفيذي ونقاط وإجراءات مطلوبة", icon: "🧾" },
  { id: "translate", label: "ترجمة رسمية", desc: "عربي ⇄ إنجليزي مع الحفاظ على المصطلحات", icon: "🌐" },
  { id: "proofread", label: "تدقيق لغوي", desc: "تصحيح إملائي ونحوي وأسلوبي", icon: "✅" },
  { id: "weekly_plan", label: "خطة أسبوعية", desc: "ترتيب الأولويات وتوزيعها على الأيام", icon: "🗓️" },
  { id: "report_narrative", label: "تقرير من أرقام", desc: "تحويل الإحصاءات إلى تقرير سردي للإدارة", icon: "📊" },
  { id: "announcement", label: "تعميم / إعلان", desc: "إعلان واضح للموظفين أو الطلبة", icon: "📣" },
];

const ROUTINE_PRESETS: { name: string; prompt: string; time: string }[] = [
  { name: "موجز الصباح", time: "08:00", prompt: "افتح Outlook واقرأ الرسائل غير المقروءة، ثم تقويم اليوم، ثم مهامي المفتوحة، واكتب موجزًا قصيرًا بأهم 3 أولويات واجتماعات اليوم وما يحتاج ردًا." },
  { name: "بريد ← مهام", time: "13:00", prompt: "اقرأ الرسائل غير المقروءة في Outlook خلال آخر 24 ساعة، واستخرج كل طلب أو موعد نهائي كمهمة في لوحة المهام مع رابط الرسالة، دون تكرار مهام موجودة." },
  { name: "اجتماعات الغد", time: "17:00", prompt: "افتح تقويم Outlook على يوم الغد واعرض الاجتماعات بأوقاتها، وأنشئ مهمة تحضير لكل اجتماع يحتاج إعدادًا." },
  { name: "متابعة الدورات", time: "10:00", prompt: "افتح لوحة الدورات Hub واستخرج الدورات الحالية وحالتها وأعداد المسجلين، ونبّهني إلى أي دورة متأخرة أو تحتاج إجراءً كمهمة." },
];

function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

type Navigate = (page: PageId, id?: number, q?: string) => void;

export default function AssistantPage({ onNavigate, initialPrompt }: { onNavigate: Navigate; initialPrompt?: string }) {
  const [tab, setTab] = useState<"chat" | "tools" | "routines">("chat");
  const [settings, setSettings] = useState<AiSettings | null>(null);

  useEffect(() => {
    void api.ai.settings().then(setSettings);
  }, []);

  return (
    <div className="h-full flex flex-col" style={{ minHeight: "calc(100vh - 48px)" }}>
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h1 className="text-xl font-extrabold flex items-center gap-2">
            <span className="tool-icon" style={{ width: 34, height: 34, fontSize: 16, marginBottom: 0 }}>
              <Icon name="sparkles" size={18} />
            </span>
            المساعد الذكي
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            مساعد تنفيذي يقرأ بياناتك وبواباتك، يُنشئ المهام ويصوغ المراسلات، ويتذكّر ما يهمك — مدعوم بـClaude.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {settings && (
            <span className={`badge ${settings.hasKey ? "badge-ok" : "badge-warn"}`}>
              {settings.hasKey ? `متصل · ${settings.model}` : "لم يُضبط مفتاح API"}
            </span>
          )}
          {settings?.computerAvailable && (
            <button
              className={`chip ${settings.computerControl ? "on" : ""}`}
              style={settings.computerControl ? { background: "var(--c-purple)", color: "var(--c-purple-ink)", borderColor: "transparent" } : undefined}
              title="السماح للمساعد بفتح البرامج والتحكم بالشاشة (البوابات متاحة دائمًا)"
              onClick={async () => setSettings(await api.ai.setPrefs({ computerControl: !settings.computerControl }))}
            >
              <Icon name="monitor" size={14} /> التحكم بالكمبيوتر {settings.computerControl ? "مفعّل" : "متوقف"}
            </button>
          )}
          {settings && (
            <button
              className="chip"
              style={settings.webSearch ? { background: "var(--c-lime)", color: "var(--c-lime-ink)", borderColor: "transparent" } : undefined}
              title="البحث في الإنترنت"
              onClick={async () => setSettings(await api.ai.setPrefs({ webSearch: !settings.webSearch }))}
            >
              <Icon name="globe" size={14} /> الإنترنت {settings.webSearch ? "مفعّل" : "متوقف"}
            </button>
          )}
          <Button size="sm" onClick={() => onNavigate("settings")}>
            <Icon name="settings" size={14} /> الإعدادات
          </Button>
        </div>
      </div>

      {settings && !settings.hasKey && (
        <div className="panel p-4 mb-3 flex items-center justify-between gap-3 flex-wrap pop">
          <div>
            <div className="font-bold">فعّل المساعد بخطوة واحدة</div>
            <div className="text-sm" style={{ color: "var(--muted)" }}>
              أضف مفتاح Claude API من الإعدادات. يُحفظ المفتاح مشفّرًا على هذا الجهاز فقط.
            </div>
          </div>
          <Button variant="primary" onClick={() => onNavigate("settings")}>
            إضافة المفتاح
          </Button>
        </div>
      )}

      <TabBar
        tabs={[
          { id: "chat", label: "المحادثة" },
          { id: "tools", label: "أدوات المهام" },
          { id: "routines", label: "الروتينات" },
        ]}
        active={tab}
        onChange={(id) => setTab(id as "chat" | "tools" | "routines")}
      />

      {tab === "chat" ? (
        <ChatPane key={initialPrompt ?? "chat"} initialPrompt={initialPrompt} onNavigate={onNavigate} />
      ) : tab === "tools" ? (
        <ToolsPane onNavigate={onNavigate} />
      ) : (
        <RoutinesPane onNavigate={onNavigate} />
      )}
    </div>
  );
}

/* ------------------------------ المحادثة ------------------------------ */

function ChatPane({ initialPrompt, onNavigate }: { initialPrompt?: string; onNavigate: Navigate }) {
  const { confirm } = useUi();
  const [chatId, setChatId] = useState(() => uid());
  const chat = useAiChat({ chatId });
  const [chats, setChats] = useState<{ id: string; title: string; updated_at: string }[]>([]);
  const [input, setInput] = useState(initialPrompt ?? "");
  const [showHistory, setShowHistory] = useState(false);
  const sentInitial = useRef(false);

  const loadChats = useCallback(async () => setChats(await api.ai.chats()), []);
  useEffect(() => {
    void loadChats();
  }, [loadChats, chat.version]);

  useEffect(() => {
    if (initialPrompt && !sentInitial.current) {
      sentInitial.current = true;
      setInput("");
      void chat.send(initialPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  const send = (text: string) => {
    if (!text.trim() || chat.running) return;
    setInput("");
    void chat.send(text);
  };

  const newChat = () => {
    if (chat.running) return;
    setChatId(uid());
    chat.setMessages([]);
    setInput("");
  };

  const openChat = async (id: string) => {
    if (chat.running) return;
    setChatId(id);
    await chat.load(id);
    setShowHistory(false);
  };

  const running = chat.running;

  return (
    <div className="flex-1 min-h-0 grid gap-3 two-col-history" style={{ gridTemplateColumns: showHistory ? "260px 1fr" : "1fr" }}>
      {showHistory && (
        <div className="panel p-3 flex flex-col min-h-0 rise">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-sm">المحادثات السابقة</span>
            <Button size="sm" variant="ghost" onClick={newChat}>
              <Icon name="plus" size={14} /> جديدة
            </Button>
          </div>
          <div className="scroll-y flex-1 space-y-1">
            {chats.length === 0 && (
              <p className="text-xs text-center py-6" style={{ color: "var(--muted)" }}>
                لا توجد محادثات محفوظة بعد
              </p>
            )}
            {chats.map((c) => (
              <div key={c.id} className="flex items-center gap-1">
                <button className="nav-item flex-1 text-[13px]" style={{ padding: "7px 9px" }} onClick={() => void openChat(c.id)}>
                  <span className="truncate">{c.id.startsWith("portal-") ? `🌐 ${c.title}` : c.title}</span>
                </button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="btn-icon"
                  style={{ width: 28, height: 28 }}
                  onClick={async () => {
                    if (!(await confirm("حذف هذه المحادثة؟"))) return;
                    await api.ai.deleteChat(c.id);
                    if (c.id === chatId) newChat();
                    await loadChats();
                  }}
                >
                  <Icon name="trash" size={13} />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="panel flex flex-col min-h-0" style={{ minHeight: 480 }}>
        <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowHistory((v) => !v)}>
              <Icon name="clock" size={14} /> السجل
            </Button>
            <Button size="sm" variant="ghost" onClick={newChat} disabled={running}>
              <Icon name="plus" size={14} /> محادثة جديدة
            </Button>
          </div>
          <span className="text-xs flex items-center gap-2" style={{ color: "var(--muted)" }}>
            {running ? (
              <>
                <span className="live-dot" style={{ background: "var(--accent)" }} /> يعمل…
              </>
            ) : (
              "يقرأ بيانات التطبيق والبوابات عند الحاجة عبر أدوات آمنة"
            )}
          </span>
        </div>

        <ChatThread
          messages={chat.messages}
          running={running}
          onDecide={(m, r, ok) => void chat.decide(m, r, ok)}
          empty={
            <div className="my-auto text-center stagger">
              <div className="tool-icon mx-auto float" style={{ width: 64, height: 64, fontSize: 30, borderRadius: 20 }}>
                <Icon name="sparkles" size={30} />
              </div>
              <h3 className="font-extrabold text-lg mt-2">بم أساعدك اليوم؟</h3>
              <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
                اسألني عن بياناتك أو بريدك أو اجتماعاتك، أو اطلب مسودة، أو كلّفني بإضافة مهمة.
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-2xl mx-auto">
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="chip" onClick={() => send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          }
        />

        <div className="p-3 assistant-composer" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex gap-2 items-end">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="اكتب طلبك… (Enter للإرسال، Shift+Enter لسطر جديد)"
              style={{ minHeight: 54, maxHeight: 200 }}
              rows={2}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
            />
            {running ? (
              <Button variant="danger" onClick={() => void chat.cancel()} style={{ height: 54 }}>
                <Icon name="stop" size={16} /> إيقاف
              </Button>
            ) : (
              <Button variant="primary" onClick={() => send(input)} disabled={!input.trim()} style={{ height: 54 }}>
                <Icon name="send" size={16} /> إرسال
              </Button>
            )}
          </div>
          <div className="flex items-center justify-between mt-2 text-[11px] flex-wrap gap-1" style={{ color: "var(--muted)" }}>
            <span>
              يمكنه إنشاء مهام مباشرة في <button className="link" onClick={() => onNavigate("tasks")}>لوحة المهام</button> وفتح{" "}
              <button className="link" onClick={() => onNavigate("portals")}>البوابات</button> وقراءتها.
            </span>
            <span>Ctrl+J لفتح المساعد من أي مكان</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ الروتينات ------------------------------ */

const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function RoutinesPane({ onNavigate }: { onNavigate: Navigate }) {
  const { toast, confirm } = useUi();
  const [routines, setRoutines] = useState<AiRoutine[]>([]);
  const [edit, setEdit] = useState<Partial<AiRoutine> | null>(null);
  const [runningId, setRunningId] = useState<number | null>(null);
  const [live, setLive] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const jobRef = useRef<string | null>(null);

  const load = useCallback(async () => setRoutines(await api.ai.routines()), []);
  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const off = window.dynamo.on("app:ai", (raw) => {
      const ev = raw as AiStreamEvent;
      if (ev.jobId !== jobRef.current) return;
      if (ev.type === "text") setLive((t) => t + ev.text);
      if (ev.type === "done" || ev.type === "error" || ev.type === "refusal") {
        jobRef.current = null;
        setRunningId(null);
        if (ev.type !== "done") toast(ev.message, "danger");
        setTimeout(() => void load(), 300);
      }
    });
    const offR = window.dynamo.on("app:routine", () => void load());
    return () => {
      off();
      offR();
    };
  }, [load, toast]);

  const run = async (r: AiRoutine) => {
    if (jobRef.current) return;
    const jobId = uid();
    jobRef.current = jobId;
    setRunningId(r.id);
    setLive("");
    setExpanded(r.id);
    await api.ai.routineRun(r.id, jobId);
  };

  const save = async () => {
    if (!edit?.name?.trim() || !edit.prompt?.trim()) return toast("الاسم والتعليمات مطلوبان", "danger");
    setRoutines(await api.ai.routineSave({ ...edit, name: edit.name, prompt: edit.prompt }));
    setEdit(null);
    toast("تم حفظ الروتين", "ok");
  };

  return (
    <div className="grid gap-4 flex-1 min-h-0 two-col" style={{ gridTemplateColumns: "minmax(280px, 0.8fr) minmax(360px, 1.4fr)" }}>
      <div className="grid gap-2 content-start stagger">
        <div className="panel p-4" style={{ borderRadius: 20 }}>
          <h3 className="font-bold text-sm mb-1">روتينات ذكية</h3>
          <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
            أوامر محفوظة يشغّلها المساعد بنقرة أو تلقائيًا في وقت محدد (والتطبيق مفتوح): موجز الصباح، تحويل البريد إلى مهام، تحضير اجتماعات الغد… نتائجها تظهر هنا وتصلك بإشعار.
          </p>
          <Button variant="primary" onClick={() => setEdit({ name: "", prompt: "", schedule_time: null, weekdays: "0,1,2,3,4", enabled: 1 })}>
            <Icon name="plus" size={14} /> روتين جديد
          </Button>
        </div>
        <div className="panel p-3" style={{ borderRadius: 20 }}>
          <div className="text-[12px] font-extrabold mb-2" style={{ color: "var(--muted)" }}>
            قوالب جاهزة
          </div>
          <div className="flex flex-col gap-1.5">
            {ROUTINE_PRESETS.map((p) => (
              <button key={p.name} className="chip justify-start" onClick={() => setEdit({ name: p.name, prompt: p.prompt, schedule_time: p.time, weekdays: "0,1,2,3,4", enabled: 1 })} title={p.prompt}>
                <Icon name="clock" size={12} /> {p.name} · {p.time}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3 content-start">
        {routines.length === 0 && (
          <div className="panel">
            <EmptyState title="لا توجد روتينات بعد" hint="ابدأ بقالب جاهز من اليسار أو أنشئ روتينًا بتعليماتك" />
          </div>
        )}
        {routines.map((r) => (
          <div key={r.id} className="panel p-4" style={{ borderRadius: 20 }}>
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="font-bold flex items-center gap-2 flex-wrap">
                  {r.name}
                  {r.schedule_time ? <Badge tone={r.enabled ? "info" : "default"}>{r.enabled ? `يوميًا ${r.schedule_time}` : "متوقف"}</Badge> : <Badge>يدوي</Badge>}
                  {r.last_run_at && <Badge tone={r.last_ok ? "ok" : "danger"}>{r.last_ok ? "آخر تنفيذ ناجح" : "آخر تنفيذ فشل"} · {formatDateTime(r.last_run_at)}</Badge>}
                </div>
                <p className="text-xs mt-1 line-clamp-2" style={{ color: "var(--muted)" }}>
                  {r.prompt}
                </p>
                {r.schedule_time && (
                  <p className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
                    الأيام: {r.weekdays.split(",").map((d) => DAYS[Number(d)]).filter(Boolean).join("، ")}
                  </p>
                )}
              </div>
              <div className="flex gap-1 flex-wrap">
                <Button size="sm" variant="primary" disabled={runningId !== null} onClick={() => void run(r)}>
                  <Icon name={runningId === r.id ? "clock" : "wand"} size={13} /> {runningId === r.id ? "يعمل…" : "تشغيل الآن"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onNavigate("assistant", undefined, r.prompt)} title="تشغيله في المحادثة لمتابعة الخطوات">
                  <Icon name="sparkles" size={13} />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEdit(r)}>
                  <Icon name="settings" size={13} />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    if (!(await confirm(`حذف الروتين «${r.name}»؟`))) return;
                    setRoutines(await api.ai.routineDelete(r.id));
                  }}
                >
                  <Icon name="trash" size={13} />
                </Button>
              </div>
            </div>
            {(runningId === r.id || (expanded === r.id && r.last_result)) && (
              <div className="mt-3 p-3 output-pane text-sm" style={{ background: "var(--panel-2)", borderRadius: 14, maxHeight: 320, overflow: "auto" }}>
                {runningId === r.id ? <span className="cursor-blink">{live}</span> : r.last_result}
              </div>
            )}
            {expanded !== r.id && r.last_result && runningId !== r.id && (
              <button className="link text-xs mt-2" onClick={() => setExpanded(r.id)}>
                عرض نتيجة آخر تنفيذ
              </button>
            )}
          </div>
        ))}
      </div>

      <Modal open={!!edit} title={edit?.id ? "تعديل الروتين" : "روتين جديد"} onClose={() => setEdit(null)} width={600} footer={
        <>
          <Button onClick={() => setEdit(null)}>إلغاء</Button>
          <Button variant="primary" onClick={() => void save()}>
            حفظ
          </Button>
        </>
      }>
        {edit && (
          <div className="grid gap-3">
            <Field label="الاسم">
              <Input autoFocus value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <Field label="التعليمات (ما يفعله المساعد)" hint="اكتبها كما تكتب طلبًا في المحادثة؛ يستطيع فتح البوابات وقراءتها وإنشاء المهام.">
              <Textarea value={edit.prompt ?? ""} onChange={(e) => setEdit({ ...edit, prompt: e.target.value })} style={{ minHeight: 110 }} />
            </Field>
            <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <Field label="وقت التشغيل اليومي (اختياري)">
                <Input type="time" value={edit.schedule_time ?? ""} onChange={(e) => setEdit({ ...edit, schedule_time: e.target.value || null })} />
              </Field>
              <Field label="الحالة">
                <Select value={edit.enabled ? "1" : "0"} onChange={(e) => setEdit({ ...edit, enabled: Number(e.target.value) })}>
                  <option value="1">مفعّل</option>
                  <option value="0">متوقف</option>
                </Select>
              </Field>
            </div>
            <div>
              <span className="field-label">أيام التشغيل</span>
              <div className="flex gap-1.5 flex-wrap">
                {DAYS.map((d, i) => {
                  const set = new Set((edit.weekdays ?? "0,1,2,3,4").split(",").filter(Boolean));
                  const on = set.has(String(i));
                  return (
                    <button
                      key={d}
                      className="chip"
                      style={on ? { background: "var(--nav-on-bg)", color: "var(--nav-on-ink)", borderColor: "transparent" } : undefined}
                      onClick={() => {
                        if (on) set.delete(String(i));
                        else set.add(String(i));
                        setEdit({ ...edit, weekdays: [...set].sort().join(",") });
                      }}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>
            <Toggle on={!!edit.schedule_time} onChange={(v) => setEdit({ ...edit, schedule_time: v ? "08:00" : null })} label="تشغيل تلقائي يومي" hint="يعمل فقط والتطبيق مفتوح على هذا الجهاز" />
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ------------------------------ أدوات المهام ------------------------------ */

type ToolOptions = Record<string, string>;

function ToolsPane({ onNavigate }: { onNavigate: Navigate }) {
  const { toast } = useUi();
  const [active, setActive] = useState<AiTemplateId>("letter");
  const [text, setText] = useState("");
  const [options, setOptions] = useState<ToolOptions>({ lang: "ar", tone: "رسمية", kind: "letter", target: "en" });
  const [output, setOutput] = useState("");
  const [job, setJob] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const jobRef = useRef<string | null>(null);
  const outRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const off = window.dynamo.on("app:ai", (raw) => {
      const ev = raw as AiStreamEvent;
      if (ev.jobId !== jobRef.current) return;
      if (ev.type === "text") setOutput((o) => o + ev.text);
      if (ev.type === "done") {
        setOutput(ev.text);
        jobRef.current = null;
        setJob(null);
      }
      if (ev.type === "error" || ev.type === "refusal") {
        setError(ev.message);
        jobRef.current = null;
        setJob(null);
      }
    });
    return off;
  }, []);

  useEffect(() => {
    outRef.current?.scrollTo({ top: outRef.current.scrollHeight });
  }, [output]);

  const run = async () => {
    if (jobRef.current || !text.trim()) return;
    const jobId = uid();
    jobRef.current = jobId;
    setJob(jobId);
    setOutput("");
    setError(null);
    await api.ai.template(jobId, { template: active, text, options });
  };

  const stop = async () => {
    if (jobRef.current) await api.ai.cancel(jobRef.current);
  };

  const card = useMemo(() => TOOL_CARDS.find((c) => c.id === active)!, [active]);
  const running = !!job;
  const set = (k: string, v: string) => setOptions((o) => ({ ...o, [k]: v }));

  const placeholder: Record<AiTemplateId, string> = {
    letter: "مثال: طلب اعتماد قاعة إضافية · العدد ارتفع إلى 60 طالبًا · الحاجة اعتبارًا من الفصل القادم · جهة الاعتماد: عمادة الشؤون الأكاديمية",
    email: "النقاط التي تريد إيصالها، أو الصق الرسالة التي تريد الرد عليها",
    minutes: "الصق ملاحظات الاجتماع الخام كما كتبتها",
    summary: "الصق النص الطويل (تقرير، بريد، تعميم…)",
    translate: "النص المراد ترجمته",
    proofread: "النص المراد تدقيقه",
    weekly_plan: "اكتب مهامك واجتماعاتك والتزاماتك لهذا الأسبوع في سطور",
    report_narrative: "الصق الأرقام والإحصاءات (مثلًا من لوحة المؤشرات أو تقرير إكسل)",
    announcement: "ماذا/متى/أين/من، وما المطلوب من القارئ",
  };

  return (
    <div className="grid gap-4 flex-1 min-h-0 two-col" style={{ gridTemplateColumns: "300px 1fr" }}>
      <div className="grid gap-2 content-start stagger">
        <div className="panel p-3" style={{ borderRadius: 20 }}>
          <div className="text-[12px] font-extrabold mb-2" style={{ color: "var(--muted)" }}>
            مهام البوابات (عبر المحادثة)
          </div>
          <div className="flex flex-col gap-1.5">
            {[
              { l: "ملخص بريد Outlook → مهام", q: "افتح Outlook، اقرأ الرسائل غير المقروءة، لخّصها، وأنشئ مهمة لكل طلب فيها مع رابط الرسالة." },
              { l: "اجتماعات Teams اليوم", q: "افتح Teams واعرض اجتماعاتي اليوم مع أوقاتها، ثم أضف تذكيرًا كمهمة لكل اجتماع مهم." },
              { l: "حالة الدورات في Hub", q: "افتح لوحة الدورات Hub واستخرج جدولًا بالدورات الحالية وحالتها وأعداد المسجلين." },
              { l: "بحث في SharePoint", q: "ابحث في بوابة SharePoint عن: " },
              { l: "طلب إجازة عبر OneHub", q: "ساعدني خطوة بخطوة في تقديم طلب إجازة في OneHub. افتح البوابة واقرأ الصفحة أولًا." },
            ].map((x) => (
              <button key={x.l} className="chip justify-start" onClick={() => onNavigate("assistant", undefined, x.q)} title={x.q}>
                <Icon name="globe" size={12} /> {x.l}
              </button>
            ))}
          </div>
        </div>
        {TOOL_CARDS.map((c) => (
          <button key={c.id} className={`tool-card ${active === c.id ? "on" : ""}`} onClick={() => setActive(c.id)} style={{ padding: "10px 12px" }}>
            <div className="flex items-center gap-3">
              <span className="tool-icon" style={{ marginBottom: 0, width: 36, height: 36, fontSize: 18 }}>
                {c.icon}
              </span>
              <span className="min-w-0">
                <span className="block font-bold text-sm">{c.label}</span>
                <span className="block text-[11.5px] truncate" style={{ color: "var(--muted)" }}>
                  {c.desc}
                </span>
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="grid gap-3 min-h-0" style={{ gridTemplateRows: "auto 1fr" }}>
        <div className="panel p-4 pop" key={active}>
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <h3 className="font-bold flex items-center gap-2">
                <span>{card.icon}</span> {card.label}
              </h3>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                {card.desc}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mb-3">
            {(active === "letter" || active === "email" || active === "announcement") && (
              <Field label="اللغة">
                <Select value={options.lang ?? "ar"} onChange={(e) => set("lang", e.target.value)} style={{ width: 150 }}>
                  <option value="ar">العربية</option>
                  <option value="en">English</option>
                  {active !== "letter" && <option value="both">عربي + إنجليزي</option>}
                </Select>
              </Field>
            )}
            {active === "letter" && (
              <Field label="النوع">
                <Select value={options.kind ?? "letter"} onChange={(e) => set("kind", e.target.value)} style={{ width: 160 }}>
                  <option value="letter">خطاب رسمي</option>
                  <option value="memo">مذكرة داخلية</option>
                </Select>
              </Field>
            )}
            {(active === "letter" || active === "email") && (
              <>
                <Field label="الموجَّه إليه">
                  <Input value={options.to ?? ""} onChange={(e) => set("to", e.target.value)} placeholder="عمادة شؤون الطلبة…" style={{ width: 220 }} />
                </Field>
                <Field label="النبرة">
                  <Select value={options.tone ?? "رسمية"} onChange={(e) => set("tone", e.target.value)} style={{ width: 140 }}>
                    <option value="رسمية">رسمية</option>
                    <option value="ودّية مهنية">ودّية مهنية</option>
                    <option value="حازمة">حازمة</option>
                    <option value="اعتذارية">اعتذارية</option>
                  </Select>
                </Field>
              </>
            )}
            {active === "email" && (
              <Field label="الوضع">
                <Select value={options.reply ?? "0"} onChange={(e) => set("reply", e.target.value)} style={{ width: 150 }}>
                  <option value="0">رسالة جديدة</option>
                  <option value="1">ردّ على رسالة</option>
                </Select>
              </Field>
            )}
            {active === "translate" && (
              <Field label="الترجمة إلى">
                <Select value={options.target ?? "en"} onChange={(e) => set("target", e.target.value)} style={{ width: 150 }}>
                  <option value="en">الإنجليزية</option>
                  <option value="ar">العربية</option>
                </Select>
              </Field>
            )}
            {active === "summary" && (
              <Field label="الطول">
                <Select value={options.length ?? "normal"} onChange={(e) => set("length", e.target.value)} style={{ width: 150 }}>
                  <option value="normal">عادي</option>
                  <option value="short">قصير جدًا</option>
                </Select>
              </Field>
            )}
            {active === "proofread" && (
              <Field label="الأسلوب">
                <Select value={options.style ?? "keep"} onChange={(e) => set("style", e.target.value)} style={{ width: 170 }}>
                  <option value="keep">الحفاظ على الأسلوب</option>
                  <option value="formal">جعله رسميًا أكثر</option>
                </Select>
              </Field>
            )}
            {active === "announcement" && (
              <Field label="الفئة المستهدفة">
                <Input value={options.audience ?? ""} onChange={(e) => set("audience", e.target.value)} placeholder="الموظفين / الطلبة / أعضاء الهيئة" style={{ width: 220 }} />
              </Field>
            )}
          </div>

          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder[active]} style={{ minHeight: 120 }} />
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {running ? (
              <Button variant="danger" onClick={() => void stop()}>
                <Icon name="stop" size={15} /> إيقاف
              </Button>
            ) : (
              <Button variant="primary" onClick={() => void run()} disabled={!text.trim()}>
                <Icon name="wand" size={15} /> توليد
              </Button>
            )}
            <Button variant="ghost" onClick={() => setText("")} disabled={running || !text}>
              مسح
            </Button>
            {(active === "minutes" || active === "summary") && (
              <Button
                variant="ghost"
                onClick={async () => {
                  if (!text.trim()) return;
                  toast("جارٍ استخراج المهام…");
                  const res = await api.ai.extractTasks(text, "text");
                  if (!res.ok) return toast(res.message ?? "تعذّر الاستخراج", "danger");
                  if (res.tasks.length === 0) return toast("لم يُعثر على مهام في النص");
                  await api.tasks.bulkCreate(
                    res.tasks.map((t) => ({
                      title: t.title,
                      description: t.description,
                      priority: t.priority,
                      due_date: t.due_date,
                      tags: t.tags.join("، "),
                      source: "ai",
                    })),
                  );
                  toast(`أُضيفت ${res.tasks.length} مهمة إلى لوحة المهام`, "ok");
                }}
                disabled={running || !text.trim()}
              >
                <Icon name="tasks" size={15} /> استخراج المهام إلى اللوحة
              </Button>
            )}
          </div>
        </div>

        <div className="panel flex flex-col min-h-0" style={{ minHeight: 260 }}>
          <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
            <span className="font-bold text-sm flex items-center gap-2">
              المخرج
              {running && <span className="live-dot" style={{ background: "var(--accent)" }} />}
            </span>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" disabled={!output} onClick={() => copyToClipboard(output).then(() => toast("تم النسخ", "ok"))}>
                <Icon name="copy" size={13} /> نسخ
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={!output}
                onClick={async () => {
                  const p = await api.ai.saveText(card.label, output);
                  if (p) toast("تم حفظ الملف", "ok");
                }}
              >
                <Icon name="save" size={13} /> حفظ كملف
              </Button>
              <Button size="sm" variant="ghost" disabled={!output || running} onClick={() => onNavigate("minutes")}>
                <Icon name="minutes" size={13} /> فتح المحاضر
              </Button>
            </div>
          </div>
          <div ref={outRef} className="scroll-y flex-1 p-4 output-pane">
            {error ? (
              <p style={{ color: "var(--danger)" }}>{error}</p>
            ) : output ? (
              <span className={running ? "cursor-blink" : ""}>{output}</span>
            ) : (
              <p className="text-sm text-center py-10" style={{ color: "var(--muted)" }}>
                {running ? "جارٍ التوليد…" : "سيظهر المخرج هنا تدريجيًا."}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
