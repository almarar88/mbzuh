/**
 * قنوات النظام المشتركة (سطح المكتب والجوال): أجندة اليوم، التحقق من التحديثات، فحص
 * النظام، السجل التشخيصي، وتصدير المهام إلى Excel.
 */
import * as electron from "electron";
import { app, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import type { IpcMain } from "electron";
import { backupsDir, dbPath, getDb, getSetting } from "../db";
import { agendaFor } from "../services/agenda";
import { clearLog, logLine, logPath, readLog } from "../services/log";
import { getAiSettings } from "../services/ai";
import { listTasks } from "../services/tasks";
import { detectAllConflicts } from "../services/conflicts";
import type { HealthReport, UpdateInfo } from "../../shared/types";

const RELEASES_API = "https://api.github.com/repos/almarar88/mbzuh/releases/latest";
const RELEASES_PAGE = "https://github.com/almarar88/mbzuh/releases/latest";

function cmpVersion(a: string, b: string): number {
  const pa = a.replace(/^v/, "").split(".").map(Number);
  const pb = b.replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

async function checkUpdate(): Promise<UpdateInfo> {
  const current = app.getVersion();
  const base: UpdateInfo = { current, latest: null, available: false, url: RELEASES_PAGE, notes: "" };
  try {
    const f = ((electron as unknown as { net?: { fetch?: typeof fetch } }).net?.fetch ?? fetch) as typeof fetch;
    const res = await f(RELEASES_API, { headers: { Accept: "application/vnd.github+json" } });
    if (!res.ok) return base;
    const json = (await res.json()) as { tag_name?: string; body?: string; html_url?: string };
    const tag = (json.tag_name ?? "").replace(/^android-/, "");
    if (!/^v?\d+\.\d+/.test(tag)) return base;
    return { current, latest: tag.replace(/^v/, ""), available: cmpVersion(tag, current) > 0, url: json.html_url ?? RELEASES_PAGE, notes: (json.body ?? "").slice(0, 1200) };
  } catch {
    return base;
  }
}

function health(): HealthReport {
  const checks: HealthReport["checks"] = [];
  const ai = getAiSettings();
  checks.push({ id: "key", label: "مفتاح Claude API", ok: ai.hasKey, detail: ai.hasKey ? `محفوظ ${ai.keyHint}${ai.encrypted ? " (مشفّر)" : ""}` : "غير مضبوط — المساعد لن يعمل حتى تضيفه من الإعدادات" });
  try {
    const size = fs.existsSync(dbPath()) ? fs.statSync(dbPath()).size : 0;
    const integrity = (getDb().prepare("PRAGMA integrity_check").get() as { integrity_check?: string } | undefined)?.integrity_check ?? "ok";
    checks.push({ id: "db", label: "قاعدة البيانات", ok: integrity === "ok", detail: `${Math.round(size / 1024)} ك.ب · الفحص: ${integrity}` });
  } catch (e) {
    checks.push({ id: "db", label: "قاعدة البيانات", ok: false, detail: String(e) });
  }
  try {
    const files = fs.readdirSync(backupsDir()).filter((f) => f.endsWith(".db"));
    const latest = files.map((f) => fs.statSync(path.join(backupsDir(), f)).mtimeMs).sort((a, b) => b - a)[0];
    const ageDays = latest ? Math.round((Date.now() - latest) / 86_400_000) : null;
    checks.push({ id: "backup", label: "النسخ الاحتياطي", ok: ageDays !== null && ageDays <= 2, detail: ageDays === null ? "لا توجد نسخ بعد" : `آخر نسخة منذ ${ageDays} يوم · ${files.length} نسخة` });
  } catch {
    checks.push({ id: "backup", label: "النسخ الاحتياطي", ok: false, detail: "تعذّر قراءة مجلد النسخ" });
  }
  const tasks = listTasks();
  const overdue = tasks.filter((t) => t.status !== "done" && t.due_date && t.due_date < new Date().toISOString().slice(0, 10)).length;
  checks.push({ id: "tasks", label: "المهام", ok: overdue === 0, detail: overdue ? `${overdue} مهمة متأخرة` : `${tasks.filter((t) => t.status !== "done").length} مهمة مفتوحة، لا متأخرات` });
  const conflicts = detectAllConflicts().filter((c) => c.severity === "error").length;
  checks.push({ id: "conflicts", label: "جدول الدورات", ok: conflicts === 0, detail: conflicts ? `${conflicts} تعارض يحتاج معالجة` : "لا تعارضات" });
  const routines = (getDb().prepare("SELECT COUNT(*) AS n FROM ai_routines WHERE enabled = 1 AND schedule_time IS NOT NULL").get() as { n: number }).n;
  checks.push({ id: "routines", label: "الروتينات المجدولة", ok: true, detail: routines ? `${routines} روتين يعمل تلقائيًا والتطبيق مفتوح` : "لا روتينات مجدولة" });
  const creds = getSetting("portal_creds_enc", "") || getSetting("portal_creds", "");
  checks.push({ id: "portals", label: "بيانات دخول البوابات", ok: true, detail: creds ? "محفوظة لبوابة واحدة أو أكثر" : "لم تُحفظ بعد (اختياري)" });
  return { checks };
}

async function exportTasksXlsx(): Promise<string | null> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("المهام", { views: [{ rightToLeft: true }] });
  ws.columns = [
    { header: "#", key: "id", width: 6 },
    { header: "العنوان", key: "title", width: 40 },
    { header: "التفاصيل", key: "description", width: 50 },
    { header: "الحالة", key: "status", width: 12 },
    { header: "الأولوية", key: "priority", width: 10 },
    { header: "الاستحقاق", key: "due_date", width: 12 },
    { header: "الوسوم", key: "tags", width: 20 },
    { header: "المصدر", key: "source_url", width: 40 },
    { header: "أُنشئت", key: "created_at", width: 18 },
    { header: "أُنجزت", key: "completed_at", width: 18 },
  ];
  const status: Record<string, string> = { todo: "للتنفيذ", doing: "قيد العمل", done: "منجز" };
  const prio: Record<string, string> = { low: "منخفضة", normal: "عادية", high: "عالية", urgent: "عاجلة" };
  for (const t of listTasks()) ws.addRow({ ...t, status: status[t.status] ?? t.status, priority: prio[t.priority] ?? t.priority });
  ws.getRow(1).font = { bold: true };
  const name = `المهام-${new Date().toISOString().slice(0, 10)}.xlsx`;
  const isBrowser = typeof (globalThis as { document?: unknown }).document !== "undefined";
  const buf = await wb.xlsx.writeBuffer();
  if (isBrowser) {
    const target = `/app/exports/${name}`;
    fs.writeFileSync(target, new Uint8Array(buf as ArrayBuffer));
    return target;
  }
  const res = await electron.dialog.showSaveDialog({ defaultPath: path.join(app.getPath("documents"), name), filters: [{ name: "Excel", extensions: ["xlsx"] }] });
  if (res.canceled || !res.filePath) return null;
  fs.writeFileSync(res.filePath, Buffer.from(buf as ArrayBuffer));
  return res.filePath;
}

export function registerSystemIpc(ipcMain: IpcMain): void {
  ipcMain.handle("agenda:day", (_e, date?: string) => agendaFor(date));
  ipcMain.handle("system:update", () => checkUpdate());
  ipcMain.handle("system:health", () => health());
  ipcMain.handle("system:log", () => readLog());
  ipcMain.handle("system:logClear", () => {
    clearLog();
    return true;
  });
  ipcMain.handle("system:logWrite", (_e, level: "info" | "warn" | "error", source: string, message: string) => {
    logLine(level, source, message);
    return true;
  });
  ipcMain.handle("system:openLogs", () => {
    try {
      shell.showItemInFolder(logPath());
    } catch {
      /* الجوال */
    }
    return true;
  });
  ipcMain.handle("tasks:export", () => exportTasksXlsx());
}
