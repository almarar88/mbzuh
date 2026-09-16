/**
 * خطّاف محادثة المساعد: يدير الرسائل والبث التدريجي والموافقات لمحادثة واحدة،
 * ويُستخدم في صفحة المساعد وفي «المساعد داخل البوابة» وأي مكان آخر.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import type { AiAttachment, AiChatContext, AiChatMessage, AiStreamEvent } from "@shared/types";

export const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export function useAiChat(options: { chatId: string; context?: AiChatContext; persist?: boolean; onDone?: (text: string) => void }) {
  const { chatId, persist = true } = options;
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [job, setJob] = useState<string | null>(null);
  const jobRef = useRef<string | null>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const contextRef = useRef(options.context);
  contextRef.current = options.context;
  const onDoneRef = useRef(options.onDone);
  onDoneRef.current = options.onDone;
  const [version, setVersion] = useState(0);

  const save = useCallback(
    (list: AiChatMessage[]) => {
      if (!persist) return;
      const first = list.find((m) => m.role === "user")?.text ?? "محادثة";
      void api.ai.saveTranscript(chatId, first.slice(0, 80), list).then(() => setVersion((v) => v + 1));
    },
    [chatId, persist],
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
        if (ev.type === "approval") next[next.length - 1] = { ...last, approval: { requestId: ev.requestId, label: ev.label, detail: ev.detail } };
        if (ev.type === "screenshot") next[next.length - 1] = { ...last, shots: [...(last.shots ?? []), { dataUrl: ev.dataUrl, label: ev.label }].slice(-4) };
        if (ev.type === "error" || ev.type === "refusal") next[next.length - 1] = { ...last, error: ev.message, approval: undefined };
        if (ev.type === "done") next[next.length - 1] = { ...last, text: ev.text || last.text, approval: undefined };
        return next;
      });
      if (ev.type === "done" || ev.type === "error" || ev.type === "refusal") {
        jobRef.current = null;
        setJob(null);
        if (ev.type === "done") onDoneRef.current?.(ev.text);
        setTimeout(() => save(messagesRef.current), 50);
      }
    });
    return off;
  }, [save]);

  const send = useCallback(
    async (text: string, attachments?: AiAttachment[]) => {
      const clean = text.trim();
      if ((!clean && !attachments?.length) || jobRef.current) return;
      const jobId = uid();
      jobRef.current = jobId;
      setJob(jobId);
      setMessages((list) => [
        ...list,
        { id: uid(), role: "user", text: clean || "اقرأ المرفقات ولخّصها.", attachments: attachments?.map((a) => a.name), at: new Date().toISOString() },
        { id: uid(), role: "assistant", text: "", tools: [], at: new Date().toISOString() },
      ]);
      await api.ai.chat(chatId, jobId, clean, contextRef.current, attachments);
    },
    [chatId],
  );

  const cancel = useCallback(async () => {
    if (jobRef.current) await api.ai.cancel(jobRef.current);
  }, []);

  const decide = useCallback(async (messageId: string, requestId: string, ok: boolean) => {
    setMessages((list) => list.map((m) => (m.id === messageId && m.approval ? { ...m, approval: { ...m.approval, decided: true } } : m)));
    await api.ai.approve(requestId, ok);
  }, []);

  const load = useCallback(async (id: string) => {
    const t = (await api.ai.transcript(id)) as AiChatMessage[];
    setMessages(t);
  }, []);

  return { messages, setMessages, running: !!job, send, cancel, decide, load, busy: jobRef, version };
}
