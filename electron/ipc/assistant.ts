/** قنوات المساعد الذكي، ولوحة المهام، ولوحة UMS المدمجة. */
import type { BrowserWindow, IpcMain } from "electron";
import { dialog } from "electron";
import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import {
  cancelJob,
  chat,
  deleteChat,
  extractTasks,
  getAiSettings,
  getChatTranscript,
  listChats,
  runTemplate,
  saveApiKey,
  saveTranscript,
  testConnection,
  TEMPLATE_LABELS,
} from "../services/ai";
import { createTask, deleteTask, listTasks, reorderTasks, taskStats, updateTask } from "../services/tasks";
import { ums } from "../services/ums";
import { setSetting } from "../db";
import type { AiStreamEvent, AiTemplateInput, Task, TaskStatus } from "../../shared/types";

export function registerAssistantIpc(ipcMain: IpcMain, getWindow: () => BrowserWindow | null): void {
  const emit = (event: AiStreamEvent) => {
    const win = getWindow();
    if (win && !win.isDestroyed()) win.webContents.send("app:ai", event);
  };

  /* ------------------------------ المساعد ------------------------------ */

  ipcMain.handle("ai:settings", () => getAiSettings());
  ipcMain.handle("ai:setKey", (_e, key: string) => saveApiKey(key));
  ipcMain.handle("ai:setPrefs", (_e, prefs: { model?: string; effort?: string; adminName?: string; adminTitle?: string }) => {
    if (prefs.model) setSetting("ai_model", prefs.model);
    if (prefs.effort) setSetting("ai_effort", prefs.effort);
    if (prefs.adminName !== undefined) setSetting("ai_admin_name", prefs.adminName);
    if (prefs.adminTitle !== undefined) setSetting("ai_admin_title", prefs.adminTitle);
    return getAiSettings();
  });
  ipcMain.handle("ai:test", () => testConnection());
  ipcMain.handle("ai:templates", () => TEMPLATE_LABELS);

  ipcMain.handle("ai:chat", (_e, chatId: string, jobId: string, text: string) => {
    void chat(chatId, jobId, text, emit);
    return jobId;
  });
  ipcMain.handle("ai:template", (_e, jobId: string, input: AiTemplateInput) => {
    void runTemplate(jobId, input, emit);
    return jobId;
  });
  ipcMain.handle("ai:cancel", (_e, jobId: string) => cancelJob(jobId));
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

  /* ------------------------------- UMS ------------------------------- */

  ipcMain.handle("ums:show", (_e, bounds: { x: number; y: number; width: number; height: number }) => ums.show(bounds));
  ipcMain.handle("ums:hide", () => {
    ums.hide();
    return true;
  });
  ipcMain.handle("ums:visible", (_e, visible: boolean) => {
    ums.setVisible(visible);
    return true;
  });
  ipcMain.handle("ums:state", () => ums.state());
  ipcMain.handle("ums:navigate", (_e, action: "back" | "forward" | "reload" | "home" | "stop" | "url", url?: string) =>
    ums.navigate(action, url),
  );
  ipcMain.handle("ums:zoom", (_e, direction: "in" | "out" | "reset") => ums.setZoom(direction));
  ipcMain.handle("ums:theme", (_e, theme: "modern" | "original", dark: boolean) => ums.setTheme(theme, dark));
  ipcMain.handle("ums:setHome", (_e, url: string) => ums.setHomeUrl(url));
  ipcMain.handle("ums:openExternal", () => {
    ums.openExternal();
    return true;
  });
  ipcMain.handle("ums:clearSession", async () => {
    const confirm = await dialog.showMessageBox({
      type: "question",
      buttons: ["تسجيل الخروج ومسح الجلسة", "إلغاء"],
      defaultId: 1,
      cancelId: 1,
      title: "مسح جلسة UMS",
      message: "سيتم حذف ملفات تعريف الارتباط وبيانات الجلسة الخاصة بلوحة UMS وستحتاج لتسجيل الدخول مجددًا.",
    });
    if (confirm.response !== 0) return false;
    await ums.clearSession();
    return true;
  });
}
