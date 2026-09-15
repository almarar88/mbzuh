/** نقطة انطلاق تطبيق «نبض التقنية» لسطح المكتب. */
import path from "node:path";
import { BrowserWindow, Menu, app, dialog, ipcMain, net, shell } from "electron";
import type { RefreshProgress, Settings } from "@shared/types";
import { parseHTML } from "linkedom";
import { getDb } from "../core/db";
import { setPlatform } from "../core/platform";
import { closeNodeDb, openNodeDb } from "./db/sqlite-node";
import { registerAgentIpc } from "./ipc/agent";
import { registerNewsIpc } from "./ipc/news";
import { registerSettingsIpc } from "./ipc/settings";
import { aggregator } from "../core/services/aggregator";
import { setFetchImpl } from "../core/services/http";
import { loadSettings } from "../core/services/settings";
import { seedSources } from "../core/services/sources";

const isDev = !!process.env.VITE_DEV_SERVER_URL;
let mainWindow: BrowserWindow | null = null;
let refreshTimer: NodeJS.Timeout | null = null;

function send(channel: string, payload?: unknown): void {
  mainWindow?.webContents.send(channel, payload);
}

function scheduleRefresh(settings: Settings): void {
  if (refreshTimer) clearInterval(refreshTimer);
  const minutes = Math.max(5, settings.refreshMinutes || 30);
  refreshTimer = setInterval(() => {
    if (!aggregator.refreshing) void aggregator.refreshAll().catch(() => undefined);
  }, minutes * 60 * 1000);
}

function buildMenu(): void {
  const menu = Menu.buildFromTemplate([
    {
      label: "ملف",
      submenu: [
        { label: "تحديث الأخبار", accelerator: "F5", click: () => send("app:command", "refresh") },
        { label: "بحث", accelerator: "CmdOrCtrl+K", click: () => send("app:command", "search") },
        { type: "separator" },
        { label: "خروج", role: "quit" },
      ],
    },
    {
      label: "الأقسام",
      submenu: [
        { label: "آخر الأخبار", click: () => send("app:navigate", "feed") },
        { label: "الذكاء الاصطناعي", click: () => send("app:navigate", "ai") },
        { label: "التقنية", click: () => send("app:navigate", "tech") },
        { label: "المحفوظات", click: () => send("app:navigate", "saved") },
        { label: "الوكيل الذكي", accelerator: "CmdOrCtrl+J", click: () => send("app:navigate", "agent") },
        { label: "المصادر", click: () => send("app:navigate", "sources") },
        { label: "الإعدادات", click: () => send("app:navigate", "settings") },
      ],
    },
    {
      label: "عرض",
      submenu: [
        { label: "إعادة تحميل", role: "reload" },
        { label: "تكبير", role: "zoomIn" },
        { label: "تصغير", role: "zoomOut" },
        { label: "الحجم الافتراضي", role: "resetZoom" },
        { type: "separator" },
        { label: "ملء الشاشة", role: "togglefullscreen" },
        { label: "أدوات المطور", role: "toggleDevTools" },
      ],
    },
    {
      label: "مساعدة",
      submenu: [
        {
          label: "عن البرنامج",
          click: () => {
            void dialog.showMessageBox({
              type: "info",
              title: "عن نبض التقنية",
              message: "نبض التقنية — أخبار التقنية والذكاء الاصطناعي",
              detail:
                `الإصدار ${app.getVersion()} — تطوير Alcode\n` +
                "يجمع الأخبار مباشرة من خلاصات المواقع التقنية العربية والعالمية وReddit وX وأخبار Google، " +
                "ويترجم ما ليس بالعربية، ويحلّلها بوكيل ذكاء اصطناعي.",
              buttons: ["حسنًا"],
            });
          },
        },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 680,
    title: "نبض التقنية — أخبار التقنية والذكاء الاصطناعي",
    backgroundColor: "#0b1220",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());

  if (isDev) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL as string);
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) void shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const devUrl = process.env.VITE_DEV_SERVER_URL;
    if (!(devUrl && url.startsWith(devUrl))) event.preventDefault();
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // وضع الفحص الذاتي: يلتقط صورًا لكل الشاشات ثم يخرج (يُستخدم في الاختبارات فقط).
  const shotDir = process.env.TECHPULSE_SCREENSHOT_DIR;
  if (shotDir) {
    mainWindow.webContents.once("did-finish-load", () => {
      void (async () => {
        const fs = await import("node:fs");
        const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
        const pages = ["feed", "ai", "agent", "sources", "settings"];
        await wait(Number(process.env.TECHPULSE_SCREENSHOT_WAIT ?? 15000));
        for (const p of pages) {
          send("app:navigate", p);
          await wait(1500);
          const img = await mainWindow!.webContents.capturePage();
          fs.writeFileSync(path.join(shotDir, `${p}.png`), img.toPNG());
        }
        const first = getDb().prepare("SELECT id FROM articles WHERE lang != 'ar' AND details_fetched = 1 AND image_url IS NOT NULL ORDER BY published_at DESC LIMIT 1").get() as { id: number } | undefined;
        if (first) {
          send("app:open-article", first.id);
          await wait(6000);
          fs.writeFileSync(path.join(shotDir, "article.png"), (await mainWindow!.webContents.capturePage()).toPNG());
        }
        app.quit();
      })().catch((e) => {
        console.error("screenshot failed", e);
        app.exit(1);
      });
    });
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  void app.whenReady().then(() => {
    app.setAppUserModelId("com.alcode.techpulse");
    // شبكة Chromium بدل fetch الخاص بـ Node: تمرّ عبر وكيل النظام وتُقبل من المواقع التي تحجب العملاء غير المتصفحية.
    setFetchImpl((input, init) => net.fetch(input, { ...init, bypassCustomProtocolHandlers: true }));
    setPlatform({
      name: "electron",
      parseHtml: (html) => parseHTML(html).document as unknown as Document,
      env: (name) => process.env[name],
    });
    openNodeDb(path.join(app.getPath("userData"), "techpulse.db"));
    seedSources();

    aggregator.onProgress((p: RefreshProgress) => send("app:refresh-progress", p));

    registerNewsIpc(ipcMain);
    registerAgentIpc(ipcMain, () => mainWindow?.webContents ?? null);
    registerSettingsIpc(ipcMain, (s) => scheduleRefresh(s));
    ipcMain.handle("system:version", () => app.getVersion());

    buildMenu();
    createWindow();
    scheduleRefresh(loadSettings());
    // تحديث أولي بعد ثانيتين من الإقلاع
    setTimeout(() => void aggregator.refreshAll().catch(() => undefined), 2000);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("before-quit", () => {
    if (refreshTimer) clearInterval(refreshTimer);
    closeNodeDb();
  });
}
