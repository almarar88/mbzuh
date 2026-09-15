import { useEffect, useRef, useState, type ReactElement } from "react";
import type { AgentMessage, AgentToolCall, Conversation, LlmStatus } from "@shared/types";
import { api } from "@/lib/api";
import { markdownToHtml, timeAgo } from "@/lib/format";
import { Empty, useToast } from "@/components/ui";

const TOOL_LABELS: Record<string, string> = {
  search_news: "بحث في أخبار التطبيق",
  get_article: "قراءة خبر",
  fetch_url: "قراءة صفحة",
  search_web: "بحث في الويب",
  search_news_web: "بحث في أخبار Google",
  search_reddit: "بحث في Reddit",
  fetch_x: "جلب من X",
  translate: "ترجمة",
  refresh_feeds: "تحديث المصادر",
  web_search: "بحث ويب (Anthropic)",
};

const SUGGESTIONS = [
  "ما أهم أخبار الذكاء الاصطناعي اليوم؟ لخّصها مع المصادر.",
  "ماذا أعلنت OpenAI وAnthropic وGoogle هذا الأسبوع؟",
  "ما رأي مجتمع Reddit في آخر نموذج مفتوح المصدر؟",
  "قارن بين آخر نماذج الذكاء الاصطناعي من حيث الأداء والسعر.",
  "ما آخر أخبار Nvidia والرقائق؟ وما أثرها على السوق؟",
];

interface LiveState {
  text: string;
  calls: AgentToolCall[];
  status: string | null;
}

export function AgentPage({ prefill, onPrefillConsumed, onOpenArticle, onGoSettings }: {
  prefill: string | null;
  onPrefillConsumed: () => void;
  onOpenArticle: (id: number) => void;
  onGoSettings: () => void;
}) {
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState("");
  const [live, setLive] = useState<LiveState | null>(null);
  const [status, setStatus] = useState<LlmStatus | null>(null);
  const [openCall, setOpenCall] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const activeRef = useRef<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const loadConvs = (): void => {
    void api.agent.conversations().then(setConvs);
  };

  useEffect(() => {
    loadConvs();
    void api.agent.status().then(setStatus);
    const off = api.on.agentEvent((e) => {
      if (e.conversationId !== activeRef.current) {
        if (e.type === "done") loadConvs();
        return;
      }
      if (e.type === "text") setLive((s) => ({ text: (s?.text ?? "") + e.delta, calls: s?.calls ?? [], status: null }));
      if (e.type === "tool_start") setLive((s) => ({ text: s?.text ?? "", calls: [...(s?.calls ?? []), e.call], status: `يستخدم: ${TOOL_LABELS[e.call.name] ?? e.call.name}` }));
      if (e.type === "tool_end") setLive((s) => ({ text: s?.text ?? "", calls: (s?.calls ?? []).map((c) => (c.id === e.call.id ? e.call : c)), status: null }));
      if (e.type === "status") setLive((s) => ({ text: s?.text ?? "", calls: s?.calls ?? [], status: e.message }));
      if (e.type === "done") {
        setLive(null);
        setMessages((m) => [...m, e.message]);
        loadConvs();
      }
      if (e.type === "error") {
        setLive(null);
        toast(e.message, "error");
        void api.agent.messages(e.conversationId).then(setMessages);
      }
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (prefill) {
      setInput(prefill);
      setActive(null);
      setMessages([]);
      onPrefillConsumed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, live?.text, live?.calls.length]);

  async function open(id: number): Promise<void> {
    setActive(id);
    setListOpen(false);
    setLive(null);
    setMessages(await api.agent.messages(id));
    if (await api.agent.running(id)) setLive({ text: "", calls: [], status: "يعمل…" });
  }

  async function send(text?: string): Promise<void> {
    const t = (text ?? input).trim();
    if (!t || live) return;
    if (!status?.configured) {
      toast("أضِف مفتاح Anthropic API من الإعدادات أولًا", "error");
      return;
    }
    setInput("");
    const optimistic: AgentMessage = { id: -Date.now(), conversationId: active ?? 0, role: "user", content: t, toolCalls: [], createdAt: new Date().toISOString() };
    setMessages((m) => [...m, optimistic]);
    setLive({ text: "", calls: [], status: "يفكر…" });
    try {
      const id = await api.agent.send(active, t);
      if (id !== active) {
        setActive(id);
        activeRef.current = id;
        loadConvs();
      }
    } catch (e) {
      setLive(null);
      toast((e as Error).message, "error");
    }
  }

  async function remove(id: number): Promise<void> {
    await api.agent.delete(id);
    if (active === id) {
      setActive(null);
      setMessages([]);
    }
    loadConvs();
  }

  function renderMd(text: string): ReactElement {
    return (
      <div
        className="prose text-[14.5px]"
        dir="auto"
        dangerouslySetInnerHTML={{ __html: markdownToHtml(text) }}
        onClick={(e) => {
          const t = e.target as HTMLElement;
          if (t.tagName === "A") {
            e.preventDefault();
            const href = (t as HTMLAnchorElement).href;
            const m = /^#?(\d+)$/.exec(t.textContent ?? "");
            if (m && !href.startsWith("http")) onOpenArticle(Number(m[1]));
            else if (href) void api.feed.openExternal(href);
          }
        }}
      />
    );
  }

  function renderCalls(calls: AgentToolCall[]): ReactElement | null {
    if (!calls.length) return null;
    return (
      <div className="flex flex-col gap-1 mb-2">
        <div className="flex gap-1 flex-wrap">
          {calls.map((c) => (
            <span key={c.id} className={`tool-chip ${c.error ? "err" : ""}`} onClick={() => setOpenCall(openCall === c.id ? null : c.id)} title={JSON.stringify(c.input)}>
              {c.result === undefined ? <span className="spinner" style={{ width: 10, height: 10 }} /> : c.error ? "✗" : "✓"} {TOOL_LABELS[c.name] ?? c.name}
              {typeof c.input.query === "string" && <span style={{ color: "var(--muted)" }}>· {String(c.input.query).slice(0, 30)}</span>}
              {typeof c.input.handle === "string" && <span style={{ color: "var(--muted)" }}>· @{String(c.input.handle)}</span>}
              {typeof c.input.id === "number" && <span style={{ color: "var(--muted)" }}>· #{String(c.input.id)}</span>}
            </span>
          ))}
        </div>
        {calls.filter((c) => c.id === openCall && c.result).map((c) => (
          <pre key={c.id} className="text-[11px] p-2 rounded-lg overflow-auto max-h-60 whitespace-pre-wrap" dir="auto" style={{ background: "var(--panel-2)", color: "var(--ink-2)" }}>{c.result}</pre>
        ))}
      </div>
    );
  }

  return (
    <div className="agent-layout">
      <div className={`conv-list ${listOpen ? "open" : ""}`}>
        <div className="flex gap-2">
          <button className="btn btn-accent flex-1" onClick={() => { setActive(null); setMessages([]); setLive(null); setListOpen(false); }}>＋ محادثة جديدة</button>
          <button className="btn hide-wide" onClick={() => setListOpen(false)}>✕</button>
        </div>
        <div className="flex-1 overflow-y-auto flex flex-col gap-1 mt-1">
          {convs.map((c) => (
            <div key={c.id} className={`nav-item group ${active === c.id ? "active" : ""}`} onClick={() => void open(c.id)}>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px]">{c.title}</div>
                <div className="text-[11px]" style={{ color: "var(--muted)" }}>{timeAgo(c.updatedAt)} · {c.messageCount} رسالة</div>
              </div>
              <button className="btn btn-ghost btn-sm opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); void remove(c.id); }} title="حذف">🗑️</button>
            </div>
          ))}
        </div>
        <div className="text-[11px] px-1" style={{ color: "var(--muted)" }}>
          {status?.configured ? <span><span className="dot" style={{ background: "var(--ok)" }} /> {status.model}</span> : <span><span className="dot" style={{ background: "var(--danger)" }} /> بلا مفتاح API — <a className="underline cursor-pointer" onClick={onGoSettings}>الإعدادات</a></span>}
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="hide-wide flex items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
          <button className="btn btn-sm" onClick={() => setListOpen(true)}>☰ المحادثات ({convs.length})</button>
          <span className="text-[11px] ms-auto" style={{ color: "var(--muted)" }}>{status?.configured ? status.model : "بلا مفتاح API"}</span>
        </div>
        <div className="flex-1 overflow-y-auto page-pad">
          {messages.length === 0 && !live ? (
            <div className="max-w-2xl mx-auto mt-10">
              <Empty icon="✨" title="الوكيل الذكي لأخبار التقنية" hint="يبحث في أخبار التطبيق وعلى الويب وReddit وX، يقرأ المقالات، يترجم، ويحلّل — ويجيبك بالعربية مع المصادر." />
              {!status?.configured && (
                <div className="panel p-4 text-sm text-center mb-4" style={{ borderColor: "var(--warn)" }}>
                  لتفعيل الوكيل أضِف مفتاح Anthropic API من <a className="underline cursor-pointer" onClick={onGoSettings}>الإعدادات</a>. باقي التطبيق يعمل بدونه.
                </div>
              )}
              <div className="two-col">
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="btn text-start justify-start" onClick={() => void send(s)}>{s}</button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto flex flex-col gap-4">
              {messages.map((m) => (
                <div key={m.id} className={`${m.role === "user" ? "msg-user self-start max-w-[85%]" : "msg-assistant"} p-4`}>
                  {m.role === "assistant" && renderCalls(m.toolCalls)}
                  {m.role === "user" ? <div className="whitespace-pre-wrap text-[14.5px]" dir="auto">{m.content}</div> : renderMd(m.content)}
                  <div className="text-[10px] mt-2" style={{ color: m.role === "user" ? "var(--dark-muted)" : "var(--muted)" }}>{timeAgo(m.createdAt)}</div>
                </div>
              ))}
              {live && (
                <div className="msg-assistant p-4">
                  {renderCalls(live.calls)}
                  {live.text ? renderMd(live.text) : null}
                  <div className="text-xs mt-2 flex items-center gap-2" style={{ color: "var(--muted)" }}>
                    <span className="spinner" /> {live.status ?? "يكتب…"}
                    <button className="btn btn-ghost btn-sm ms-auto" onClick={() => active && void api.agent.stop(active)}>إيقاف</button>
                  </div>
                </div>
              )}
              <div ref={bottom} />
            </div>
          )}
        </div>
        <div className="p-3" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="max-w-3xl mx-auto flex gap-2 items-end">
            <textarea
              className="textarea"
              rows={2}
              placeholder="اسأل عن أي خبر تقني أو اطلب تحليلًا… (Enter للإرسال، Shift+Enter لسطر جديد)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              disabled={Boolean(live)}
            />
            <button className="btn btn-accent" style={{ height: 46 }} onClick={() => void send()} disabled={Boolean(live) || !input.trim()}>إرسال</button>
          </div>
        </div>
      </div>
    </div>
  );
}
