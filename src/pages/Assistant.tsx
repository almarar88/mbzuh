/**
 * المساعد الذكي: محادثة تعتمد أدوات تقرأ بيانات التطبيق، وأدوات مهام جاهزة
 * (خطابات، بريد، تلخيص، ترجمة، تدقيق، محاضر، خطة أسبوعية…) مع بث تدريجي.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { Button, Field, Input, Select, TabBar, Textarea, useUi } from "../components/ui";
import { Icon } from "../components/icons";
import type { AiChatMessage, AiSettings, AiStreamEvent, AiTemplateId } from "@shared/types";
import type { PageId } from "../App";

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const SUGGESTIONS = [
  "ما وضع الدورات الجارية اليوم؟ وهل توجد تعارضات تحتاج تدخلي؟",
  "لخّص لي آخر ثلاثة محاضر واستخرج ما عليّ متابعته.",
  "أضف مهمة: مراجعة جدول القاعات للأسبوع القادم، أولوية عالية، استحقاق الخميس.",
  "اقترح خطة لهذا الأسبوع بناءً على مهامي المفتوحة والمواعيد القادمة.",
  "اكتب مذكرة داخلية لطلب اعتماد قاعة إضافية بسبب ارتفاع أعداد المسجلين.",
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

function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

export default function AssistantPage({
  onNavigate,
  initialPrompt,
}: {
  onNavigate: (page: PageId) => void;
  initialPrompt?: string;
}) {
  const [tab, setTab] = useState<"chat" | "tools">("chat");
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
            مساعد تنفيذي يقرأ بيانات التطبيق ويُنشئ المهام ويصوغ المراسلات — مدعوم بـClaude.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {settings && (
            <span className={`badge ${settings.hasKey ? "badge-ok" : "badge-warn"}`}>
              {settings.hasKey ? `متصل · ${settings.model}` : "لم يُضبط مفتاح API"}
            </span>
          )}
          <Button size="sm" onClick={() => onNavigate("settings")}>
            <Icon name="settings" size={14} /> إعدادات المساعد
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
        ]}
        active={tab}
        onChange={(id) => setTab(id as "chat" | "tools")}
      />

      {tab === "chat" ? (
        <ChatPane key={initialPrompt ?? "chat"} initialPrompt={initialPrompt} onNavigate={onNavigate} />
      ) : (
        <ToolsPane onNavigate={onNavigate} />
      )}
    </div>
  );
}

/* ------------------------------ المحادثة ------------------------------ */

function ChatPane({ initialPrompt, onNavigate }: { initialPrompt?: string; onNavigate: (p: PageId) => void }) {
  const { toast, confirm } = useUi();
  const [chatId, setChatId] = useState(() => uid());
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [chats, setChats] = useState<{ id: string; title: string; updated_at: string }[]>([]);
  const [input, setInput] = useState(initialPrompt ?? "");
  const [job, setJob] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const jobRef = useRef<string | null>(null);
  const sentInitial = useRef(false);

  const loadChats = useCallback(async () => setChats(await api.ai.chats()), []);
  useEffect(() => {
    void loadChats();
  }, [loadChats]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const persist = useCallback(
    (list: AiChatMessage[]) => {
      const first = list.find((m) => m.role === "user")?.text ?? "محادثة";
      void api.ai.saveTranscript(chatId, first.slice(0, 80), list).then(loadChats);
    },
    [chatId, loadChats],
  );

  useEffect(() => {
    const off = window.dynamo.on("app:ai", (raw) => {
      const ev = raw as AiStreamEvent;
      if (ev.jobId !== jobRef.current) return;
      setMessages((list) => {
        const next = [...list];
        const last = next[next.length - 1];
        if (!last || last.role !== "assistant") return list;
        if (ev.type === "text") next[next.length - 1] = { ...last, text: last.text + ev.text };
        if (ev.type === "tool") {
          const tools = [...(last.tools ?? [])];
          if (ev.phase === "start") tools.push({ name: ev.name, label: ev.label });
          else {
            const i = tools.findIndex((t) => t.name === ev.name && t.ok === undefined);
            if (i >= 0) tools[i] = { ...tools[i], ok: ev.ok };
          }
          next[next.length - 1] = { ...last, tools };
        }
        if (ev.type === "error" || ev.type === "refusal") next[next.length - 1] = { ...last, error: ev.message };
        if (ev.type === "done") next[next.length - 1] = { ...last, text: ev.text || last.text };
        return next;
      });
      if (ev.type === "done" || ev.type === "error" || ev.type === "refusal") {
        jobRef.current = null;
        setJob(null);
        setTimeout(() => persist(messagesRef.current), 50);
      }
    });
    return off;
  }, [persist]);

  const send = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean || jobRef.current) return;
      const jobId = uid();
      jobRef.current = jobId;
      setJob(jobId);
      setInput("");
      setMessages((list) => [
        ...list,
        { id: uid(), role: "user", text: clean, at: new Date().toISOString() },
        { id: uid(), role: "assistant", text: "", tools: [], at: new Date().toISOString() },
      ]);
      await api.ai.chat(chatId, jobId, clean);
    },
    [chatId],
  );

  useEffect(() => {
    if (initialPrompt && !sentInitial.current) {
      sentInitial.current = true;
      void send(initialPrompt);
    }
  }, [initialPrompt, send]);

  const cancel = async () => {
    if (jobRef.current) await api.ai.cancel(jobRef.current);
  };

  const newChat = () => {
    if (jobRef.current) return;
    setChatId(uid());
    setMessages([]);
    setInput("");
  };

  const openChat = async (id: string) => {
    if (jobRef.current) return;
    const t = (await api.ai.transcript(id)) as AiChatMessage[];
    setChatId(id);
    setMessages(t);
    setShowHistory(false);
  };

  const running = !!job;

  return (
    <div className="flex-1 min-h-0 grid gap-3" style={{ gridTemplateColumns: showHistory ? "260px 1fr" : "1fr" }}>
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
                <button
                  className="nav-item flex-1 text-[13px]"
                  style={{ padding: "7px 9px" }}
                  onClick={() => void openChat(c.id)}
                >
                  <span className="truncate">{c.title}</span>
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
                <span className="live-dot" style={{ background: "var(--accent)" }} /> يكتب…
              </>
            ) : (
              "يقرأ بيانات التطبيق عند الحاجة عبر أدوات آمنة"
            )}
          </span>
        </div>

        <div ref={listRef} className="flex-1 scroll-y p-4 flex flex-col gap-3">
          {messages.length === 0 && (
            <div className="my-auto text-center stagger">
              <div className="tool-icon mx-auto float" style={{ width: 64, height: 64, fontSize: 30, borderRadius: 20 }}>
                <Icon name="sparkles" size={30} />
              </div>
              <h3 className="font-extrabold text-lg mt-2">بم أساعدك اليوم؟</h3>
              <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
                اسألني عن بياناتك، أو اطلب مسودة، أو كلّفني بإضافة مهمة.
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-2xl mx-auto">
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="chip" onClick={() => void send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={m.id} className={`flex flex-col ${m.role === "user" ? "items-start" : "items-end"}`}>
              {m.role === "assistant" && (m.tools ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1 justify-end" style={{ maxWidth: "78%" }}>
                  {(m.tools ?? []).map((t, k) => (
                    <span
                      key={`${t.name}-${k}`}
                      className={`badge ${t.ok === false ? "badge-danger" : t.ok ? "badge-ok" : "badge-accent"}`}
                      style={{ fontSize: 11 }}
                    >
                      {t.ok === undefined ? "⏳" : t.ok ? "✓" : "✕"} {t.label}
                    </span>
                  ))}
                </div>
              )}
              <div
                className={`bubble ${m.role === "user" ? "bubble-user" : "bubble-assistant"} ${
                  m.role === "assistant" && running && i === messages.length - 1 && !m.error ? "cursor-blink" : ""
                }`}
              >
                {m.text || (m.role === "assistant" && !m.error && running ? "" : m.text)}
                {m.error && (
                  <div className="text-sm mt-1" style={{ color: "var(--danger)" }}>
                    {m.error}
                  </div>
                )}
              </div>
              {m.role === "assistant" && m.text && !(running && i === messages.length - 1) && (
                <div className="flex gap-1 mt-1">
                  <Button size="sm" variant="ghost" onClick={() => copyToClipboard(m.text).then(() => toast("تم النسخ", "ok"))}>
                    <Icon name="copy" size={13} /> نسخ
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      const p = await api.ai.saveText("رد المساعد", m.text);
                      if (p) toast("تم الحفظ", "ok");
                    }}
                  >
                    <Icon name="save" size={13} /> حفظ
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="p-3" style={{ borderTop: "1px solid var(--border)" }}>
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
                  void send(input);
                }
              }}
            />
            {running ? (
              <Button variant="danger" onClick={() => void cancel()} style={{ height: 54 }}>
                <Icon name="stop" size={16} /> إيقاف
              </Button>
            ) : (
              <Button variant="primary" onClick={() => void send(input)} disabled={!input.trim()} style={{ height: 54 }}>
                <Icon name="send" size={16} /> إرسال
              </Button>
            )}
          </div>
          <div className="flex items-center justify-between mt-2 text-[11px]" style={{ color: "var(--muted)" }}>
            <span>يمكنه إنشاء مهام مباشرة في <button className="link" onClick={() => onNavigate("tasks")}>لوحة المهام</button>.</span>
            <span>Ctrl+J لفتح المساعد من أي مكان</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ أدوات المهام ------------------------------ */

type ToolOptions = Record<string, string>;

function ToolsPane({ onNavigate }: { onNavigate: (p: PageId) => void }) {
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
    <div className="grid gap-4 flex-1 min-h-0" style={{ gridTemplateColumns: "300px 1fr" }}>
      <div className="grid gap-2 content-start stagger">
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
          <div className="flex items-center gap-2 mt-3">
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
