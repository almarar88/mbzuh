/** عرض رسائل محادثة المساعد: الفقاعات، شارات الأدوات، اللقطات، وبطاقات الموافقة. */
import { useEffect, useRef } from "react";
import { Button, useUi } from "./ui";
import { Icon } from "./icons";
import { api } from "../lib/api";
import type { AiChatMessage } from "@shared/types";

export function ChatThread({
  messages,
  running,
  onDecide,
  compact,
  empty,
  className = "",
}: {
  messages: AiChatMessage[];
  running: boolean;
  onDecide: (messageId: string, requestId: string, ok: boolean) => void;
  compact?: boolean;
  empty?: React.ReactNode;
  className?: string;
}) {
  const { toast } = useUi();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  return (
    <div ref={listRef} className={`flex-1 scroll-y flex flex-col gap-3 ${compact ? "p-3" : "p-4"} ${className}`}>
      {messages.length === 0 && empty}
      {messages.map((m, i) => (
        <div key={m.id} className={`flex flex-col ${m.role === "user" ? "items-start" : "items-end"}`}>
          {m.role === "assistant" && (m.tools ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1 justify-end" style={{ maxWidth: compact ? "100%" : "78%" }}>
              {(m.tools ?? []).map((t, k) => (
                <span key={`${t.name}-${k}`} className={`badge ${t.ok === false ? "badge-danger" : t.ok ? "badge-ok" : "badge-accent"}`} style={{ fontSize: 11 }}>
                  {t.ok === undefined ? "⏳" : t.ok ? "✓" : "✕"} {t.label}
                </span>
              ))}
            </div>
          )}
          {m.role === "assistant" && (m.shots ?? []).length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2 justify-end" style={{ maxWidth: compact ? "100%" : "82%" }}>
              {(m.shots ?? []).map((sh, k) => (
                <img key={k} src={sh.dataUrl} alt={sh.label} title={sh.label} className="shot" style={compact ? { maxWidth: 200 } : undefined} onClick={() => window.open(sh.dataUrl, "_blank")} />
              ))}
            </div>
          )}
          {m.role === "assistant" && m.approval && !m.approval.decided && (
            <div className="approval-card mb-2 pop" style={{ maxWidth: compact ? "100%" : "82%" }}>
              <div className="font-bold text-sm mb-1 flex items-center gap-2">
                <Icon name="shield" size={15} style={{ color: "var(--warn)" }} /> يطلب المساعد الإذن: {m.approval.label}
              </div>
              <pre className="text-xs whitespace-pre-wrap mb-2" style={{ color: "var(--ink-2)", fontFamily: "inherit" }}>
                {m.approval.detail}
              </pre>
              <div className="flex gap-2">
                <Button size="sm" variant="primary" onClick={() => onDecide(m.id, m.approval!.requestId, true)}>
                  <Icon name="check" size={14} /> موافق، نفّذ
                </Button>
                <Button size="sm" onClick={() => onDecide(m.id, m.approval!.requestId, false)}>
                  <Icon name="x" size={14} /> رفض
                </Button>
              </div>
            </div>
          )}
          <div
            className={`bubble ${m.role === "user" ? "bubble-user" : "bubble-assistant"} ${m.role === "assistant" && running && i === messages.length - 1 && !m.error ? "cursor-blink" : ""}`}
            style={compact ? { maxWidth: "96%", padding: "9px 12px", fontSize: 13.5 } : undefined}
          >
            {m.text}
            {m.error && (
              <div className="text-sm mt-1" style={{ color: "var(--danger)" }}>
                {m.error}
              </div>
            )}
          </div>
          {m.role === "assistant" && m.text && !(running && i === messages.length - 1) && (
            <div className="flex gap-1 mt-1">
              <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(m.text).then(() => toast("تم النسخ", "ok"))}>
                <Icon name="copy" size={13} /> نسخ
              </Button>
              {!compact && (
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
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
