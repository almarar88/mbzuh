/** قنوات المساعد الذكي ولوحة المهام (مشتركة بين سطح المكتب والجوال). */
import type { BrowserWindow, IpcMain } from "electron";
import { app, dialog } from "electron";
import fs from "node:fs";
import path from "node:path";
import {
  addMemory,
  cancelJob,
  chat,
  deleteChat,
  deleteMemory,
  deleteRoutine,
  extractTasks,
  getAiSettings,
  getBrief,
  getChatTranscript,
  listChats,
  listMemory,
  listRoutines,
  resolveApproval,
  runBrief,
  runRoutine,
  runTemplate,
  saveApiKey,
  saveRoutine,
  saveTranscript,
  setApprovalHandler,
  testConnection,
  TEMPLATE_LABELS,
} from "../services/ai";
import { createTask, deleteTask, listTasks, reorderTasks, taskStats, updateTask } from "../services/tasks";
import { setSetting } from "../db";
import type { AiAttachment, AiChatContext, AiRoutine, AiStreamEvent, AiTemplateInput, Task, TaskStatus } from "../../shared/types";
import { MAX_ATTACHMENT_BYTES } from "../services/attachments";

export function registerAssistantIpc(ipcMain: IpcMain, getWindow: () => BrowserWindow | null): void {
  const emit = (event: AiStreamEvent) => {
    const win = getWindow();
    if (win && !win.isDestroyed()) win.webContents.send("app:ai", event);
  };
  setApprovalHandler(emit);

  /* ------------------------------ المساعد ------------------------------ */

  ipcMain.handle("ai:settings", () => getAiSettings());
  ipcMain.handle("ai:setKey", (_e, key: string) => saveApiKey(key));
  ipcMain.handle(
    "ai:setPrefs",
    (
      _e,
      prefs: {
        model?: string;
        effort?: string;
        adminName?: string;
        adminTitle?: string;
        computerControl?: boolean;
        webSearch?: boolean;
        confirmCommands?: boolean;
        confirmGui?: boolean;
      },
    ) => {
      if (prefs.model) setSetting("ai_model", prefs.model);
      if (prefs.effort) setSetting("ai_effort", prefs.effort);
      if (prefs.adminName !== undefined) setSetting("ai_admin_name", prefs.adminName);
      if (prefs.adminTitle !== undefined) setSetting("ai_admin_title", prefs.adminTitle);
      if (prefs.computerControl !== undefined) setSetting("ai_computer", prefs.computerControl ? "1" : "0");
      if (prefs.webSearch !== undefined) setSetting("ai_web", prefs.webSearch ? "1" : "0");
      if (prefs.confirmCommands !== undefined) setSetting("ai_confirm_cmd", prefs.confirmCommands ? "1" : "0");
      if (prefs.confirmGui !== undefined) setSetting("ai_confirm_gui", prefs.confirmGui ? "1" : "0");
      return getAiSettings();
    },
  );
  ipcMain.handle("ai:test", () => testConnection());
  ipcMain.handle("ai:templates", () => TEMPLATE_LABELS);

  ipcMain.handle("ai:chat", (_e, chatId: string, jobId: string, text: string, context?: AiChatContext, attachments?: AiAttachment[]) => {
    void chat(chatId, jobId, text, emit, context, attachments?.map((a) => ({ name: a.name, data: a.data })));
    return jobId;
  });
  /** اختيار مرفقات من الجهاز (سطح المكتب). على الجوال تُختار من الواجهة مباشرة. */
  ipcMain.handle("ai:pickAttachments", async () => {
    const res = await dialog.showOpenDialog({
      properties: ["openFile", "multiSelections"],
      filters: [
        { name: "المستندات والصور", extensions: ["pdf", "docx", "xlsx", "xlsm", "pptx", "csv", "txt", "md", "json", "png", "jpg", "jpeg", "gif", "webp", "eml", "html"] },
        { name: "كل الملفات", extensions: ["*"] },
      ],
    });
    if (res.canceled) return [] as AiAttachment[];
    const out: AiAttachment[] = [];
    for (const p of res.filePaths.slice(0, 8)) {
      const st = fs.statSync(p);
      if (st.size > MAX_ATTACHMENT_BYTES) continue;
      out.push({ name: path.basename(p), data: fs.readFileSync(p).toString("base64"), size: st.size });
    }
    return out;
  });
  ipcMain.handle("ai:template", (_e, jobId: string, input: AiTemplateInput) => {
    void runTemplate(jobId, input, emit);
    return jobId;
  });
  ipcMain.handle("ai:cancel", (_e, jobId: string) => cancelJob(jobId));
  ipcMain.handle("ai:approve", (_e, requestId: string, ok: boolean) => resolveApproval(requestId, ok));
  ipcMain.handle("ai:extractTasks", async (_e, text: string, mode: "goal" | "text") => {
    try {
      return { ok: true, tasks: await extractTasks(text, mode) };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error), tasks: [] };
    }
  });
  ipcMain.handle("ai:chats", () => listChats());
  ipcMain.handle("ai:chatTranscript", (_e, chatId: string) => getChatTranscript(chatId));
  ipcMain.handle("ai:saveTranscript", (_e, chatId: string, title: string, transcript: unknown[]) => {
    saveTranscript(chatId, title, transcript);
    return true;
  });
  ipcMain.handle("ai:deleteChat", (_e, chatId: string) => {
    deleteChat(chatId);
    return true;
  });
  ipcMain.handle("ai:saveText", async (_e, suggested: string, text: string) => {
    const res = await dialog.showSaveDialog({
      defaultPath: path.join(app.getPath("documents"), `${suggested.replace(/[\\/:*?"<>|]/g, "-").slice(0, 60) || "مسودة"}.txt`),
      filters: [{ name: "ملف نصي", extensions: ["txt"] }],
    });
    if (res.canceled || !res.filePath) return null;
    fs.writeFileSync(res.filePath, text, "utf8");
    return res.filePath;
  });

  /* ------------------------------ الذاكرة والروتينات والموجز ------------------------------ */

  ipcMain.handle("ai:memory", () => listMemory());
  ipcMain.handle("ai:memoryAdd", (_e, fact: string) => addMemory(fact, "user"));
  ipcMain.handle("ai:memoryDelete", (_e, id: number) => deleteMemory(id));

  ipcMain.handle("ai:routines", () => listRoutines());
  ipcMain.handle("ai:routineSave", (_e, input: Partial<AiRoutine> & { name: string; prompt: string }) => saveRoutine(input));
  ipcMain.handle("ai:routineDelete", (_e, id: number) => deleteRoutine(id));
  ipcMain.handle("ai:routineRun", (_e, id: number, jobId: string) => {
    void runRoutine(id, jobId, emit).then((res) => {
      const win = getWindow();
      const r = listRoutines().find((x) => x.id === id);
      if (win && !win.isDestroyed() && r) win.webContents.send("app:routine", { id, name: r.name, ok: res.ok, summary: res.text.slice(0, 200) });
    });
    return jobId;
  });

  ipcMain.handle("ai:brief", (_e, day?: string) => getBrief(day));
  ipcMain.handle("ai:briefRun", (_e, jobId: string) => {
    void runBrief(jobId, emit);
    return jobId;
  });

  /* ------------------------------ المهام ------------------------------ */

  ipcMain.handle("tasks:list", () => ({ tasks: listTasks(), stats: taskStats() }));
  ipcMain.handle("tasks:create", (_e, payload: Partial<Task> & { title: string }) => createTask(payload));
  ipcMain.handle("tasks:update", (_e, id: number, patch: Partial<Task>) => updateTask(id, patch));
  ipcMain.handle("tasks:reorder", (_e, status: TaskStatus, ids: number[]) => {
    reorderTasks(status, ids);
    return true;
  });
  ipcMain.handle("tasks:delete", (_e, id: number) => deleteTask(id));
  ipcMain.handle("tasks:bulkCreate", (_e, rows: (Partial<Task> & { title: string })[]) =>
    rows.map((r) => createTask(r)),
  );
}
