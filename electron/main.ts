/** نقطة انطلاق «منصّة الإداري» — تطبيق سطح مكتب لجامعة محمد بن زايد للعلوم الإنسانية. */
import path from "node:path";
import { BrowserWindow, Menu, app, ipcMain, shell, dialog, nativeImage } from "electron";
import { autoBackup, closeDb, getDb, getSetting, setSetting } from "./db";
import { isEmptyDatabase, seedDemoData } from "./db/seed";
import { registerCatalogIpc } from "./ipc/catalog";
import { registerLogisticsIpc } from "./ipc/logistics";
import { registerAcademicsIpc } from "./ipc/academics";
import { registerWorkspaceIpc } from "./ipc/workspace";
import { registerAssistantIpc } from "./ipc/assistant";
import { ums } from "./services/ums";

const isDev = !!process.env.VITE_DEV_SERVER_URL;
const APP_TITLE = "منصّة الإداري — جامعة محمد بن زايد للعلوم الإنسانية";
let mainWindow: BrowserWindow | null = null;

function send(channel: string, payload?: unknown): void {
  mainWindow?.webContents.send(channel, payload);
}

function buildMenu(): void {
  const menu = Menu.buildFromTemplate([
    {
      label: "ملف",
      submenu: [
        { label: "بحث سريع", accelerator: "CmdOrCtrl+K", click: () => send("app:command", "search") },
        { label: "المساعد الذكي", accelerator: "CmdOrCtrl+J", click: () => send("app:navigate", "assistant") },
        { label: "مهمة جديدة", accelerator: "CmdOrCtrl+Shift+T", click: () => send("app:command", "new-task") },
        { type: "separator" },
        { label: "استيراد ملف إكسل", click: () => send("app:navigate", "reports") },
        { label: "إنشاء نسخة احتياطية", click: () => send("app:command", "backup") },
        { type: "separator" },
        { label: "خروج", role: "quit" },
      ],
    },
    {
      label: "الوحدات",
      submenu: [
        { label: "الرئيسية", accelerator: "CmdOrCtrl+1", click: () => send("app:navigate", "dashboard") },
        { label: "نظام الجامعة الموحّد UMS", accelerator: "CmdOrCtrl+2", click: () => send("app:navigate", "ums") },
        { label: "المساعد الذكي", accelerator: "CmdOrCtrl+3", click: () => send("app:navigate", "assistant") },
        { label: "لوحة المهام", accelerator: "CmdOrCtrl+4", click: () => send("app:navigate", "tasks") },
        { type: "separator" },
        { label: "المدربون", click: () => send("app:navigate", "trainers") },
        { label: "الدورات والمستويات", click: () => send("app:navigate", "courses") },
        { label: "الجدول الأسبوعي", click: () => send("app:navigate", "schedule") },
        { label: "القاعات والحجوزات", click: () => send("app:navigate", "rooms") },
        { label: "الشركاء الخارجيون", click: () => send("app:navigate", "partners") },
        { label: "الطلبة والحضور", click: () => send("app:navigate", "students") },
        { label: "التقارير والإحصائيات", click: () => send("app:navigate", "reports") },
        { label: "محاضر الاجتماعات", click: () => send("app:navigate", "minutes") },
        { type: "separator" },
        { label: "الإعدادات", accelerator: "CmdOrCtrl+,", click: () => send("app:navigate", "settings") },
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
        { label: "فتح UMS في المتصفح", click: () => ums.openExternal() },
        { label: "موقع الجامعة", click: () => void shell.openExternal("https://mbzuh.ac.ae") },
        { type: "separator" },
        {
          label: "عن البرنامج",
          click: () => {
            void dialog.showMessageBox({
              type: "info",
              title: "عن منصّة الإداري",
              message: APP_TITLE,
              detail:
                `الإصدار ${app.getVersion()} — تطوير Alcode\n\n` +
                "تطبيق سطح مكتب يجمع لوحة نظام الجامعة الموحّد (UMS) بمظهر حديث، ومساعدًا ذكيًا " +
                "للمهام الإدارية، ولوحة مهام، ووحدات إدارة الدورات والمدربين والقاعات والتقارير والمحاضر.\n\n" +
                "بياناتك محلية على هذا الجهاز؛ لا يُرسل شيء لأي خادم سوى طلبات المساعد إلى Claude API عند استخدامه.",
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
    width: 1480,
    height: 940,
    minWidth: 1100,
    minHeight: 700,
    title: APP_TITLE,
    backgroundColor: "#0b1426",
    show: false,
    icon: nativeImage.createFromPath(path.join(__dirname, "../build/icon.png")),
    autoHideMenuBar: true,
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

  // منع الانتقال لأي وجهة خارجية داخل النافذة، وفتح الروابط في المتصفح.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) void shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const devUrl = process.env.VITE_DEV_SERVER_URL;
    if (!(devUrl && url.startsWith(devUrl))) event.preventDefault();
  });

  ums.attach(mainWindow);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
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
    app.setAppUserModelId("com.alcode.mbzuh-admin");

    getDb();
    if (getSetting("seeded") !== "1" && isEmptyDatabase()) {
      seedDemoData();
      setSetting("seeded", "1");
    }
    if (!getSetting("org_name")) setSetting("org_name", "جامعة محمد بن زايد للعلوم الإنسانية");
    void autoBackup();

    registerCatalogIpc(ipcMain);
    registerLogisticsIpc(ipcMain);
    registerAcademicsIpc(ipcMain);
    registerWorkspaceIpc(ipcMain);
    registerAssistantIpc(ipcMain, () => mainWindow);

    buildMenu();
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  // النسخة اليومية تُؤخذ عند بدء التشغيل؛ عند الخروج نغلق القاعدة فقط
  // حتى لا تتسابق عملية النسخ غير المتزامنة مع إغلاق الاتصال.
  app.on("before-quit", () => {
    closeDb();
  });
}
