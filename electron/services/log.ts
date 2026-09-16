/**
 * سجل تشخيصي بسيط: أخطاء العملية الرئيسية والواجهة، تُكتب في ملف داخل بيانات التطبيق
 * (على الجوال في نظام الملفات الافتراضي) لتصديرها عند الدعم.
 */
import fs from "node:fs";
import path from "node:path";
import { app } from "electron";

const MAX_BYTES = 2 * 1024 * 1024;
let cached: string | null = null;

export function logPath(): string {
  if (cached) return cached;
  const dir = path.join(app.getPath("userData"), "logs");
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    /* تجاهل */
  }
  cached = path.join(dir, "app.log");
  return cached;
}

export function logLine(level: "info" | "warn" | "error", source: string, message: string): void {
  try {
    const p = logPath();
    const line = `${new Date().toISOString()} [${level}] ${source}: ${message.replace(/\s+/g, " ").slice(0, 2000)}\n`;
    try {
      if (fs.existsSync(p) && fs.statSync(p).size > MAX_BYTES) {
        const tail = fs.readFileSync(p, "utf8").slice(-MAX_BYTES / 2);
        fs.writeFileSync(p, tail, "utf8");
      }
    } catch {
      /* تجاهل */
    }
    fs.appendFileSync(p, line, "utf8");
  } catch {
    /* السجل ثانوي */
  }
}

export function readLog(maxChars = 60_000): string {
  try {
    const p = logPath();
    return fs.existsSync(p) ? fs.readFileSync(p, "utf8").slice(-maxChars) : "";
  } catch {
    return "";
  }
}

export function clearLog(): void {
  try {
    fs.writeFileSync(logPath(), "", "utf8");
  } catch {
    /* تجاهل */
  }
}
