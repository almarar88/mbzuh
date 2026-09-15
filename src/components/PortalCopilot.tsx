/**
 * «المساعد داخل البوابة»: شريط أوامر ومحادثة مصغّرة تظهر بجانب البوابة المفتوحة،
 * فينفّذ المساعد الطلب مباشرة على الصفحة الحالية (قراءة، استخراج، تعبئة، تحويل إلى مهام…).
 */
import { useMemo, useState } from "react";
import { Button, Textarea } from "./ui";
import { Icon } from "./icons";
import { ChatThread } from "./ChatThread";
import { useAiChat } from "../lib/useAiChat";
import type { PortalConfig } from "@shared/portals";

const QUICK: Record<string, string[]> = {
  outlook: ["لخّص الرسائل غير المقروءة وحوّل الطلبات إلى مهام", "افتح الرسالة الأحدث ولخّصها", "اكتب مسودة رد مهذبة على الرسالة المفتوحة (بلا إرسال)", "ما اجتماعاتي اليوم؟"],
  teams: ["ما اجتماعاتي اليوم وغدًا؟", "أضف تذكيرًا كمهمة لكل اجتماع مهم هذا الأسبوع"],
  cec: ["استخرج جدول الدورات المعروض وحالة كل دورة", "أي الدورات تحتاج متابعة؟ أنشئ مهامًا لها", "لخّص ما في هذه الصفحة"],
  ums: ["لخّص ما في هذه الصفحة", "استخرج الجدول المعروض إلى نقاط", "ما الإجراءات المطلوبة مني هنا؟"],
  sharepoint: ["ابحث هنا عن سياسة الإجازات ولخّصها", "ما آخر الملفات أو الأخبار في هذه الصفحة؟"],
  onehub: ["ما رصيد إجازاتي؟", "ساعدني خطوة بخطوة في تقديم طلب إجازة"],
  site: ["لخّص آخر الأخبار والتعاميم", "هل يوجد فعاليات قادمة؟"],
};

export function PortalCopilot({ portal, url, title, onClose, dock }: { portal: PortalConfig; url: string; title: string; onClose: () => void; dock: "side" | "bottom" }) {
  const context = useMemo(() => ({ scope: "portal" as const, portalId: portal.id, portalName: portal.name, url, title }), [portal.id, portal.name, url, title]);
  const chat = useAiChat({ chatId: `portal-${portal.id}`, context });
  const [input, setInput] = useState("");
  const quick = QUICK[portal.id] ?? ["لخّص ما في هذه الصفحة", "استخرج المهام المطلوبة مني من هذه الصفحة وأضفها للوحة", "ما الخطوة التالية هنا؟"];

  const submit = () => {
    if (!input.trim()) return;
    void chat.send(input);
    setInput("");
  };

  return (
    <div className={`copilot ${dock === "side" ? "copilot-side" : "copilot-bottom"} rise`}>
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
        <span className="tool-icon" style={{ width: 28, height: 28, fontSize: 14, marginBottom: 0, borderRadius: 10 }}>
          <Icon name="sparkles" size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-extrabold text-[13px] leading-tight">المساعد في {portal.name}</div>
          <div className="text-[10.5px] truncate" style={{ color: "var(--muted)" }}>
            {chat.running ? "ينفّذ الأمر على الصفحة…" : "يقرأ الصفحة الحالية وينفّذ ما تطلبه مباشرة"}
          </div>
        </div>
        <Button size="sm" variant="ghost" className="btn-icon" title="محادثة جديدة" disabled={chat.running} onClick={() => chat.setMessages([])}>
          <Icon name="plus" size={14} />
        </Button>
        <Button size="sm" variant="ghost" className="btn-icon" title="إغلاق" onClick={onClose}>
          <Icon name="x" size={14} />
        </Button>
      </div>

      <ChatThread
        messages={chat.messages}
        running={chat.running}
        onDecide={(m, r, ok) => void chat.decide(m, r, ok)}
        compact
        empty={
          <div className="my-auto text-center">
            <p className="text-[12.5px] mb-2" style={{ color: "var(--muted)" }}>
              اكتب أمرًا وسيُنفَّذ على هذه الصفحة. أمثلة:
            </p>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {quick.map((q) => (
                <button key={q} className="chip" style={{ fontSize: 12 }} onClick={() => void chat.send(q)}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <div className="p-2" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="flex gap-1.5 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="اطلب شيئًا في هذه الصفحة… (Enter للتنفيذ)"
            rows={1}
            style={{ minHeight: 42, maxHeight: 120, padding: "9px 12px", fontSize: 13.5 }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />
          {chat.running ? (
            <Button variant="danger" className="btn-icon" style={{ width: 42, height: 42 }} title="إيقاف" onClick={() => void chat.cancel()}>
              <Icon name="stop" size={15} />
            </Button>
          ) : (
            <Button variant="primary" className="btn-icon" style={{ width: 42, height: 42 }} title="تنفيذ" disabled={!input.trim()} onClick={submit}>
              <Icon name="send" size={15} />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
