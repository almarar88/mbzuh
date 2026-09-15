/**
 * أدوات «التحكم بالكمبيوتر» للمساعد الذكي (سطح المكتب).
 *
 * تعتمد على ما يوفره ويندوز نفسه دون وحدات أصلية: PowerShell (user32 عبر Add-Type،
 * SendKeys، AppActivate، Start-Process) ولقطات الشاشة عبر desktopCapturer في
 * Electron، والحافظة وفتح الملفات عبر shell. على macOS/Linux تتوفر الأدوات
 * الأساسية فقط (فتح، أوامر، ملفات، حافظة).
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { clipboard, desktopCapturer, screen, shell, app } from "electron";
import type { AiSettings } from "../../shared/types";
import type { ToolDef, ToolOutput } from "./ai";

const IS_WIN = process.platform === "win32";

/* ------------------------------ PowerShell ------------------------------ */

function runPowerShell(script: string, timeoutMs = 60_000): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    if (!IS_WIN) {
      reject(new Error("هذه الأداة تعمل على ويندوز فقط."));
      return;
    }
    const encoded = Buffer.from(`[Console]::OutputEncoding=[System.Text.Encoding]::UTF8\n${script}`, "utf16le").toString("base64");
    const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded], {
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`انتهت مهلة التنفيذ (${Math.round(timeoutMs / 1000)} ث).`));
    }, timeoutMs);
    child.stdout.on("data", (d) => (stdout += d.toString("utf8")));
    child.stderr.on("data", (d) => (stderr += d.toString("utf8")));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout: stdout.slice(0, 20_000), stderr: stderr.slice(0, 5_000), code });
    });
  });
}

function runShell(command: string, timeoutMs = 60_000): Promise<{ stdout: string; stderr: string; code: number | null }> {
  if (IS_WIN) return runPowerShell(command, timeoutMs);
  return new Promise((resolve, reject) => {
    const child = spawn("/bin/sh", ["-c", command]);
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("انتهت مهلة التنفيذ."));
    }, timeoutMs);
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout: stdout.slice(0, 20_000), stderr: stderr.slice(0, 5_000), code });
    });
  });
}

const USER32 = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class MbzuhInput {
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
}
"@
`;

/** يحوّل تعبيرًا مثل ctrl+shift+s أو enter إلى صيغة SendKeys. */
function toSendKeys(combo: string): string {
  const named: Record<string, string> = {
    enter: "{ENTER}", return: "{ENTER}", tab: "{TAB}", esc: "{ESC}", escape: "{ESC}", backspace: "{BACKSPACE}", delete: "{DELETE}", del: "{DELETE}",
    up: "{UP}", down: "{DOWN}", left: "{LEFT}", right: "{RIGHT}", home: "{HOME}", end: "{END}", pageup: "{PGUP}", pagedown: "{PGDN}",
    space: " ", win: "^{ESC}", f1: "{F1}", f2: "{F2}", f3: "{F3}", f4: "{F4}", f5: "{F5}", f6: "{F6}", f7: "{F7}", f8: "{F8}", f9: "{F9}", f10: "{F10}", f11: "{F11}", f12: "{F12}",
  };
  const parts = combo.toLowerCase().split("+").map((p) => p.trim()).filter(Boolean);
  let prefix = "";
  let key = "";
  for (const p of parts) {
    if (p === "ctrl" || p === "control") prefix += "^";
    else if (p === "alt") prefix += "%";
    else if (p === "shift") prefix += "+";
    else key = named[p] ?? (p.length === 1 ? escapeSendKeys(p) : `{${p.toUpperCase()}}`);
  }
  return prefix + key;
}

function escapeSendKeys(text: string): string {
  return text.replace(/[+^%~(){}[\]]/g, (c) => `{${c}}`);
}

function psQuote(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

/* ------------------------------ لقطة الشاشة ------------------------------ */

let lastShot: { scale: number; offsetX: number; offsetY: number } = { scale: 1, offsetX: 0, offsetY: 0 };

async function takeScreenshot(): Promise<{ png: Buffer; width: number; height: number; screenW: number; screenH: number }> {
  const display = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = display.size;
  const maxW = 1366;
  const scale = Math.min(1, maxW / screenW);
  const thumb = { width: Math.round(screenW * scale), height: Math.round(screenH * scale) };
  const sources = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: thumb });
  const primary = sources.find((s) => String(s.display_id) === String(display.id)) ?? sources[0];
  if (!primary) throw new Error("تعذّر التقاط الشاشة.");
  const img = primary.thumbnail;
  const size = img.getSize();
  lastShot = { scale: size.width / screenW, offsetX: display.bounds.x, offsetY: display.bounds.y };
  return { png: img.toPNG(), width: size.width, height: size.height, screenW, screenH };
}

function toScreen(x: number, y: number): { x: number; y: number } {
  return { x: Math.round(x / lastShot.scale + lastShot.offsetX), y: Math.round(y / lastShot.scale + lastShot.offsetY) };
}

/* ------------------------------ الأدوات ------------------------------ */

const gui = (label: string) => (_i: Record<string, unknown>, s: AiSettings) => (s.confirmGui ? label : null);

function safePath(p: string): string {
  const expanded = p.replace(/^~(?=$|[\\/])/, os.homedir()).replace(/%([^%]+)%/g, (_m, v: string) => process.env[v] ?? _m);
  return path.resolve(expanded);
}

export function computerTools(): ToolDef[] {
  const tools: ToolDef[] = [
    {
      label: "فتح برنامج / ملف / رابط",
      tool: {
        name: "open_target",
        description:
          "يفتح برنامجًا باسمه (مثل notepad, excel, chrome, outlook)، أو ملفًا/مجلدًا بمساره الكامل، أو رابط ويب في المتصفح الافتراضي.",
        input_schema: {
          type: "object",
          properties: { target: { type: "string", description: "اسم البرنامج أو مسار الملف أو الرابط" }, args: { type: "string", description: "معاملات اختيارية للبرنامج" } },
          required: ["target"],
          additionalProperties: false,
        },
      },
      approval: (i, s) => (s.confirmGui ? `فتح: ${String(i.target ?? "")}` : null),
      run: async (input) => {
        const target = String(input.target ?? "").trim();
        if (!target) throw new Error("لم يُحدّد الهدف.");
        if (/^https?:\/\//i.test(target) || /^mailto:/i.test(target)) {
          await shell.openExternal(target);
          return { ok: true, opened: target, kind: "url" };
        }
        const p = safePath(target);
        if (fs.existsSync(p)) {
          const err = await shell.openPath(p);
          if (err) throw new Error(err);
          return { ok: true, opened: p, kind: "path" };
        }
        if (IS_WIN) {
          const args = typeof input.args === "string" && input.args.trim() ? ` -ArgumentList ${psQuote(input.args.trim())}` : "";
          const r = await runPowerShell(`Start-Process ${psQuote(target)}${args}`, 20_000);
          if (r.code !== 0 && r.stderr) throw new Error(r.stderr.trim().split("\n")[0]);
          return { ok: true, opened: target, kind: "app" };
        }
        const r = await runShell(`xdg-open ${JSON.stringify(target)} || open ${JSON.stringify(target)}`, 20_000);
        return { ok: r.code === 0, stderr: r.stderr };
      },
    },
    {
      label: "لقطة شاشة",
      tool: {
        name: "take_screenshot",
        description: "يلتقط صورة للشاشة الرئيسية الآن ويعيدها لك لتراها. استخدمها قبل النقر أو الكتابة وبعدهما للتحقق.",
        input_schema: { type: "object", properties: {}, additionalProperties: false },
      },
      run: async () => {
        const shot = await takeScreenshot();
        return {
          __blocks: [
            { type: "image", source: { type: "base64", media_type: "image/png", data: shot.png.toString("base64") } },
            { type: "text", text: `أبعاد اللقطة ${shot.width}×${shot.height} (الشاشة الفعلية ${shot.screenW}×${shot.screenH}). استخدم إحداثيات اللقطة عند النقر.` },
          ],
          __preview: `data:image/png;base64,${shot.png.toString("base64")}`,
        };
      },
      preview: (_i, out) => (out as { __preview?: string })?.__preview ?? null,
    },
    {
      label: "نقر بالفأرة",
      tool: {
        name: "mouse_click",
        description: "ينقر بالفأرة عند إحداثيات من آخر لقطة شاشة. button: left | right | double. يمكن تحريك المؤشر فقط بـ move_only.",
        input_schema: {
          type: "object",
          properties: {
            x: { type: "number" },
            y: { type: "number" },
            button: { type: "string", enum: ["left", "right", "double"] },
            move_only: { type: "boolean" },
          },
          required: ["x", "y"],
          additionalProperties: false,
        },
      },
      approval: gui("نقر بالفأرة"),
      run: async (input) => {
        const { x, y } = toScreen(Number(input.x), Number(input.y));
        const button = String(input.button ?? "left");
        const down = button === "right" ? "0x0008" : "0x0002";
        const up = button === "right" ? "0x0010" : "0x0004";
        const clicks = input.move_only ? "" : button === "double" ? 2 : 1;
        const clickCode = clicks
          ? Array.from({ length: Number(clicks) })
              .map(() => `[MbzuhInput]::mouse_event(${down},0,0,0,[UIntPtr]::Zero); [MbzuhInput]::mouse_event(${up},0,0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds 80`)
              .join("\n")
          : "";
        await runPowerShell(`${USER32}\n[MbzuhInput]::SetCursorPos(${x}, ${y}) | Out-Null\nStart-Sleep -Milliseconds 60\n${clickCode}`, 20_000);
        return { ok: true, screen: { x, y }, button, moved_only: !!input.move_only };
      },
    },
    {
      label: "كتابة نص",
      tool: {
        name: "type_text",
        description: "يكتب نصًا في العنصر النشط حاليًا (كما لو كُتب بلوحة المفاتيح). يدعم العربية والإنجليزية.",
        input_schema: {
          type: "object",
          properties: { text: { type: "string" }, press_enter: { type: "boolean" } },
          required: ["text"],
          additionalProperties: false,
        },
      },
      approval: gui("كتابة نص"),
      run: async (input) => {
        const text = String(input.text ?? "");
        const script = `${USER32}\n[System.Windows.Forms.SendKeys]::SendWait(${psQuote(escapeSendKeys(text))})${input.press_enter ? "\n[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')" : ""}`;
        await runPowerShell(script, 30_000);
        return { ok: true, typed: text.length, enter: !!input.press_enter };
      },
    },
    {
      label: "ضغط مفاتيح",
      tool: {
        name: "press_keys",
        description: "يضغط اختصارًا أو مفتاحًا: مثل ctrl+s, alt+tab, enter, esc, ctrl+shift+n, win. يمكن تمرير عدة اختصارات مفصولة بفاصلة.",
        input_schema: { type: "object", properties: { keys: { type: "string" } }, required: ["keys"], additionalProperties: false },
      },
      approval: gui("ضغط مفاتيح"),
      run: async (input) => {
        const combos = String(input.keys ?? "").split(",").map((c) => c.trim()).filter(Boolean);
        const script = `${USER32}\n${combos.map((c) => `[System.Windows.Forms.SendKeys]::SendWait(${psQuote(toSendKeys(c))}); Start-Sleep -Milliseconds 120`).join("\n")}`;
        await runPowerShell(script, 30_000);
        return { ok: true, pressed: combos };
      },
    },
    {
      label: "قائمة النوافذ المفتوحة",
      tool: {
        name: "list_windows",
        description: "يعيد النوافذ المفتوحة حاليًا (اسم البرنامج وعنوان النافذة ومعرّف العملية).",
        input_schema: { type: "object", properties: {}, additionalProperties: false },
      },
      run: async () => {
        const r = await runPowerShell(
          `Get-Process | Where-Object { $_.MainWindowTitle } | Select-Object Id, ProcessName, MainWindowTitle | ConvertTo-Json -Compress`,
          20_000,
        );
        try {
          const parsed = JSON.parse(r.stdout || "[]");
          return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          return r.stdout;
        }
      },
    },
    {
      label: "تنشيط نافذة",
      tool: {
        name: "focus_window",
        description: "يجلب نافذة إلى المقدمة بجزء من عنوانها أو بمعرّف العملية.",
        input_schema: {
          type: "object",
          properties: { title: { type: "string" }, pid: { type: "integer" } },
          additionalProperties: false,
        },
      },
      run: async (input) => {
        const target = input.pid ? Number(input.pid) : psQuote(String(input.title ?? ""));
        const r = await runPowerShell(`$s = New-Object -ComObject WScript.Shell; $s.AppActivate(${target})`, 15_000);
        return { ok: /True/i.test(r.stdout), output: r.stdout.trim() };
      },
    },
    {
      label: "تنفيذ أمر",
      tool: {
        name: "run_command",
        description:
          "ينفّذ أمر PowerShell (على ويندوز) ويعيد المخرجات. مناسب لجلب معلومات النظام، إدارة الملفات، فتح الإعدادات، إلخ. يتطلب موافقة المستخدم.",
        input_schema: {
          type: "object",
          properties: { command: { type: "string" }, timeout_seconds: { type: "integer", minimum: 1, maximum: 300 } },
          required: ["command"],
          additionalProperties: false,
        },
      },
      approval: (i, s) => (s.confirmCommands ? `تنفيذ الأمر:\n${String(i.command ?? "")}` : null),
      run: async (input) => {
        const r = await runShell(String(input.command ?? ""), Math.min(300, Math.max(1, Number(input.timeout_seconds ?? 60))) * 1000);
        return { code: r.code, stdout: r.stdout, stderr: r.stderr };
      },
    },
    {
      label: "قراءة الحافظة",
      tool: {
        name: "read_clipboard",
        description: "يقرأ النص الموجود حاليًا في الحافظة.",
        input_schema: { type: "object", properties: {}, additionalProperties: false },
      },
      run: () => ({ text: clipboard.readText().slice(0, 20_000) }),
    },
    {
      label: "كتابة في الحافظة",
      tool: {
        name: "write_clipboard",
        description: "يضع نصًا في الحافظة ليلصقه المستخدم.",
        input_schema: { type: "object", properties: { text: { type: "string" } }, required: ["text"], additionalProperties: false },
      },
      run: (input) => {
        clipboard.writeText(String(input.text ?? ""));
        return { ok: true };
      },
    },
    {
      label: "استعراض مجلد",
      tool: {
        name: "list_directory",
        description: "يعرض محتويات مجلد (الأسماء والأحجام والتواريخ). يدعم ~ ومتغيرات البيئة مثل %USERPROFILE%.",
        input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"], additionalProperties: false },
      },
      run: (input) => {
        const dir = safePath(String(input.path ?? "~"));
        return fs
          .readdirSync(dir, { withFileTypes: true })
          .slice(0, 300)
          .map((e) => {
            const full = path.join(dir, e.name);
            let size = 0;
            let mtime = "";
            try {
              const st = fs.statSync(full);
              size = st.size;
              mtime = st.mtime.toISOString();
            } catch {
              /* ignore */
            }
            return { name: e.name, dir: e.isDirectory(), size, mtime };
          });
      },
    },
    {
      label: "قراءة ملف نصي",
      tool: {
        name: "read_text_file",
        description: "يقرأ محتوى ملف نصي (txt, csv, md, json, log…) حتى 60 ألف حرف.",
        input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"], additionalProperties: false },
      },
      run: (input) => {
        const p = safePath(String(input.path ?? ""));
        const st = fs.statSync(p);
        if (st.size > 5_000_000) throw new Error("الملف كبير جدًا.");
        return { path: p, text: fs.readFileSync(p, "utf8").slice(0, 60_000) };
      },
    },
    {
      label: "كتابة ملف نصي",
      tool: {
        name: "write_text_file",
        description: "ينشئ ملفًا نصيًا أو يستبدل محتواه. المسار الافتراضي مجلد المستندات.",
        input_schema: {
          type: "object",
          properties: { path: { type: "string" }, content: { type: "string" } },
          required: ["path", "content"],
          additionalProperties: false,
        },
      },
      approval: (i) => `كتابة ملف: ${String(i.path ?? "")}`,
      run: (input) => {
        const raw = String(input.path ?? "");
        const p = path.isAbsolute(raw) || /^[~%]/.test(raw) ? safePath(raw) : path.join(app.getPath("documents"), raw);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, String(input.content ?? ""), "utf8");
        return { ok: true, path: p };
      },
    },
    {
      label: "معلومات النظام",
      tool: {
        name: "system_info",
        description: "يعيد معلومات الجهاز: النظام، المستخدم، الذاكرة، الشاشة، مجلدات المستندات/التنزيلات.",
        input_schema: { type: "object", properties: {}, additionalProperties: false },
      },
      run: () => ({
        platform: process.platform,
        release: os.release(),
        hostname: os.hostname(),
        user: os.userInfo().username,
        memoryGb: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
        freeMemoryGb: Math.round((os.freemem() / 1024 ** 3) * 10) / 10,
        cpus: os.cpus().length,
        screen: screen.getPrimaryDisplay().size,
        documents: app.getPath("documents"),
        downloads: app.getPath("downloads"),
        desktop: app.getPath("desktop"),
      }),
    },
  ];
  // على غير ويندوز: نستبعد أدوات الفأرة/المفاتيح/النوافذ التي تعتمد على PowerShell.
  return IS_WIN ? tools : tools.filter((t) => !["mouse_click", "type_text", "press_keys", "list_windows", "focus_window"].includes(t.tool.name));
}

export type { ToolOutput };
