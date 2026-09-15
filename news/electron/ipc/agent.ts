import type { IpcMain, WebContents } from "electron";
import type { AgentEvent } from "@shared/types";
import { createConversation, deleteConversation, isAgentRunning, listConversations, listMessages, runAgent, stopAgent } from "../services/agent";
import { llmStatus } from "../services/llm";
import { truncate } from "../services/text";

export function registerAgentIpc(ipc: IpcMain, getWeb: () => WebContents | null): void {
  const emit = (e: AgentEvent): void => {
    getWeb()?.send("app:agent-event", e);
  };
  ipc.handle("agent:conversations", () => listConversations());
  ipc.handle("agent:messages", (_e, id: number) => listMessages(Number(id)));
  ipc.handle("agent:new", (_e, title?: string) => createConversation(title || "محادثة جديدة"));
  ipc.handle("agent:delete", (_e, id: number) => deleteConversation(Number(id)));
  ipc.handle("agent:stop", (_e, id: number) => stopAgent(Number(id)));
  ipc.handle("agent:running", (_e, id: number) => isAgentRunning(Number(id)));
  ipc.handle("agent:status", () => llmStatus());
  ipc.handle("agent:send", (_e, conversationId: number | null, text: string) => {
    const conv = conversationId ? { id: Number(conversationId) } : createConversation(truncate(text.trim(), 60));
    // نبدأ التشغيل في الخلفية ونعيد المعرّف فورًا؛ الأحداث تصل عبر app:agent-event
    void runAgent(conv.id, text.trim(), emit).catch(() => undefined);
    return conv.id;
  });
}
