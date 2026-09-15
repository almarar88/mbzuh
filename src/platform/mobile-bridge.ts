/**
 * طبقة الجوال/المتصفح: تشغّل طبقة البيانات نفسها (electron/ipc + services) داخل
 * المتصفح عبر بدائل (shims) لـ electron وnode:sqlite وnode:fs، وتعرّض window.dynamo
 * بنفس واجهة جسر Electron حتى تعمل واجهة React دون تغيير.
 */
import { loadVfs, flush } from "./shims/node-fs";
import { initSqlite } from "./shims/node-sqlite";
import { registerCatalogIpc } from "../../electron/ipc/catalog";
import { registerLogisticsIpc } from "../../electron/ipc/logistics";
import { registerAcademicsIpc } from "../../electron/ipc/academics";
import { registerWorkspaceIpc } from "../../electron/ipc/workspace";
import { registerAssistantIpc } from "../../electron/ipc/assistant";
import { autoBackup, getDb, getSetting, setSetting } from "../../electron/db";
import { isEmptyDatabase, seedDemoData } from "../../electron/db/seed";
import { DARK_CSS, MODERN_CSS } from "../../shared/ums-theme";
import { AUTOFILL_JS, isPortalInternalUrl, normalizeUrl, parsePortals, type PortalConfig, type PortalCredential, type PortalsState } from "../../shared/portals";
import { installPostureBridge, isAndroidRuntime } from "./runtime";
import { nativeOpenExternal, nativeToast } from "./native";

type Handler = (event: unknown, ...args: unknown[]) => unknown;
const handlers = new Map<string, Handler>();
const listeners = new Map<string, Set<(...args: unknown[]) => void>>();

const fakeIpc = {
  handle(channel: string, fn: Handler) {
    handlers.set(channel, fn);
  },
};

function emit(channel: string, payload?: unknown): void {
  for (const l of listeners.get(channel) ?? []) l(payload);
}

/** نافذة وهمية تستقبل «send» من الخدمات وتحوّلها إلى مستمعي الواجهة. */
const fakeWindow = {
  isDestroyed: () => false,
  webContents: { send: (channel: string, payload?: unknown) => emit(channel, payload) },
};

/* ------------------------------ البوابات (جوال) ------------------------------ */

function portalList(): PortalConfig[] {
  return parsePortals(getSetting("portals", ""));
}

function portalState(active: string | null): PortalsState {
  return { active, portals: portalList(), tabs: [] };
}

let activePortal: string | null = null;

function readCreds(): Record<string, PortalCredential> {
  try {
    return JSON.parse(getSetting("portal_creds", "") || "{}");
  } catch {
    return {};
  }
}
function credSummary() {
  const out: Record<string, { username: string; autofill: boolean; hasPassword: boolean }> = {};
  for (const [id, c] of Object.entries(readCreds())) out[id] = { username: c.username, autofill: c.autofill, hasPassword: !!c.password };
  return out;
}

function registerMobilePortals(): void {
  fakeIpc.handle("portal:state", () => portalState(activePortal));
  fakeIpc.handle("portal:save", (_e, list) => {
    const clean = (list as PortalConfig[]).filter((p) => p.id && p.url).map((p) => ({ ...p, url: normalizeUrl(p.url) }));
    setSetting("portals", JSON.stringify(clean));
    return portalState(activePortal);
  });
  fakeIpc.handle("portal:open", (_e, id) => {
    const p = portalList().find((x) => x.id === id);
    if (!p) throw new Error("بوابة غير معروفة");
    activePortal = p.id;
    const bridge = window.AndroidBridge;
    if (bridge) {
      const css = p.theme === "modern" ? MODERN_CSS : "";
      const dark = p.theme === "modern" && p.dark ? DARK_CSS : "";
      const cred = readCreds()[p.id];
      const autofill = cred?.autofill && cred.username ? AUTOFILL_JS(cred.username, cred.password, cred.autoSubmit) : "";
      bridge.openPortal(p.url, p.name, css, dark, p.dark, JSON.stringify({ home: p.url, autofill }));
    } else {
      // متصفح عادي (للاختبار): نفتح في تبويب جديد
      window.open(p.url, "_blank", "noopener");
    }
    return portalState(activePortal);
  });
  for (const ch of ["portal:bounds", "portal:hide", "portal:visible", "portal:navigate", "portal:zoom"]) {
    fakeIpc.handle(ch, () => portalState(activePortal));
  }
  fakeIpc.handle("portal:theme", (_e, id, theme, dark) => {
    const list = portalList().map((p) => (p.id === id ? { ...p, theme: theme as "modern" | "original", dark: !!dark } : p));
    setSetting("portals", JSON.stringify(list));
    return portalState(activePortal);
  });
  fakeIpc.handle("portal:openExternal", (_e, id) => {
    const p = portalList().find((x) => x.id === (id ?? activePortal));
    if (p) nativeOpenExternal(p.url);
    return true;
  });
  fakeIpc.handle("portal:credentials", () => credSummary());
  fakeIpc.handle("portal:setCredential", (_e, id, cred) => {
    const all = readCreds();
    const c = cred as PortalCredential | null;
    if (!c || !c.username) delete all[id as string];
    else all[id as string] = { username: c.username, password: c.password ?? all[id as string]?.password ?? "", autofill: !!c.autofill, autoSubmit: !!c.autoSubmit };
    setSetting("portal_creds", JSON.stringify(all));
    return credSummary();
  });
  fakeIpc.handle("portal:clearSession", () => {
    if (!window.confirm("تسجيل الخروج من كل البوابات ومسح الجلسة؟")) return false;
    window.AndroidBridge?.clearPortalSession();
    nativeToast("تم مسح جلسة البوابات");
    return true;
  });
  void isPortalInternalUrl;
}

/* ------------------------------ الإقلاع ------------------------------ */

export async function bootMobile(): Promise<void> {
  (window as unknown as { __MBZUH_MOBILE__: boolean }).__MBZUH_MOBILE__ = true;
  installPostureBridge();
  await loadVfs();
  await initSqlite();

  getDb();
  if (getSetting("seeded") !== "1" && isEmptyDatabase()) {
    seedDemoData();
    setSetting("seeded", "1");
  }
  if (!getSetting("org_name")) setSetting("org_name", "جامعة محمد بن زايد للعلوم الإنسانية");
  void autoBackup();

  registerCatalogIpc(fakeIpc as never);
  registerLogisticsIpc(fakeIpc as never);
  registerAcademicsIpc(fakeIpc as never);
  registerWorkspaceIpc(fakeIpc as never);
  registerAssistantIpc(fakeIpc as never, () => fakeWindow as never);
  registerMobilePortals();

  window.dynamo = {
    invoke: async (channel: string, ...args: unknown[]) => {
      const fn = handlers.get(channel);
      if (!fn) throw new Error(`قناة غير متاحة على الجوال: ${channel}`);
      return (await fn(null, ...args)) as never;
    },
    on: (channel: string, listener: (...args: unknown[]) => void) => {
      if (!listeners.has(channel)) listeners.set(channel, new Set());
      listeners.get(channel)!.add(listener);
      return () => listeners.get(channel)?.delete(listener);
    },
  };

  // حفظ فوري عند إخفاء التطبيق (الأندرويد قد يُنهي العملية)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flush();
  });
  window.addEventListener("pagehide", () => void flush());

  if (isAndroidRuntime()) nativeToast("");
}
