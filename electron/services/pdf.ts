/**
 * تصدير التقارير إلى PDF.
 * - سطح المكتب: محرك الطباعة المدمج في Electron (دعم كامل للعربية).
 * - الجوال/المتصفح: حوار الطباعة الأصلي في أندرويد («حفظ كـPDF») عبر جسر التطبيق.
 */
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { BrowserWindow } from "electron";

const g = globalThis as unknown as {
  document?: unknown;
  AndroidBridge?: { printHtml: (html: string, jobName: string) => void };
  open?: (url?: string, target?: string) => { document: { write: (s: string) => void; close: () => void }; print: () => void } | null;
};

export async function htmlToPdf(html: string, targetPath: string): Promise<string> {
  if (g.document) {
    const jobName = path.basename(targetPath, ".pdf");
    if (g.AndroidBridge?.printHtml) {
      g.AndroidBridge.printHtml(html, jobName);
      return targetPath;
    }
    const w = g.open?.("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => w.print(), 300);
      return targetPath;
    }
    throw new Error("الطباعة غير متاحة في هذه البيئة.");
  }

  const tmp = path.join(os.tmpdir(), `mbzuh-report-${Date.now()}.html`);
  fs.writeFileSync(tmp, html, "utf8");
  const win = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: true, sandbox: true, javascript: false },
  });
  try {
    await win.loadFile(tmp);
    const data = await win.webContents.printToPDF({
      pageSize: "A4",
      printBackground: true,
      margins: { marginType: "default" },
    });
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, data);
    return targetPath;
  } finally {
    win.destroy();
    fs.rmSync(tmp, { force: true });
  }
}
