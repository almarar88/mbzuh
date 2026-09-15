/**
 * البوابات الجامعية المدمجة (UMS، لوحة الدورات Hub، Outlook، Teams، SharePoint، OneHub،
 * موقع الجامعة، وأي بوابة يضيفها المستخدم) داخل التطبيق.
 *
 * كل بوابة تُعرض في WebContentsView خاص بها (جلسة واحدة دائمة «persist:mbzuh-portals»
 * تحفظ تسجيل الدخول وتسمح بالدخول الموحّد بين أنظمة الجامعة). تُحقن أنماط «المظهر
 * الحديث» فوق الموقع اختياريًا، ويمكن للمساعد الذكي قراءة الصفحة النشطة والتحكم فيها
 * عبر واجهة PortalDriver.
 */
import { BrowserWindow, WebContentsView, safeStorage, session, shell, type WebContents } from "electron";
import { getSetting, setSetting } from "../db";
import { DARK_CSS, MODERN_CSS } from "../../shared/ums-theme";
import {
  AUTOFILL_JS,
  describeLoadError,
  isPortalInternalUrl,
  normalizeUrl,
  parsePortals,
  type PortalConfig,
  type PortalCredential,
  type PortalTabState,
  type PortalsState,
} from "../../shared/portals";
import type { PortalDriver } from "./portal-tools";

const PARTITION = "persist:mbzuh-portals";
const TRUST_SETTING = "portal_cert_trust";

interface Tab {
  view: WebContentsView;
  cssKeys: { modern?: string; dark?: string };
  error: string | null;
  certIssue: PortalTabState["certIssue"];
  /** آخر خطأ شهادة رُصد (قد يكون لمورد فرعي)؛ يُعرض فقط إن أفشل تحميل الصفحة الرئيسية. */
  lastCert: PortalTabState["certIssue"];
  zoom: number;
  autofills: { host: string; count: number; at: number };
}

/* ------------------------- بيانات الدخول (مشفّرة) ------------------------- */

export function readCredentials(): Record<string, PortalCredential> {
  const enc = getSetting("portal_creds_enc", "");
  const plain = getSetting("portal_creds", "");
  try {
    if (enc && safeStorage.isEncryptionAvailable()) return JSON.parse(safeStorage.decryptString(Buffer.from(enc, "base64")));
    if (plain) return JSON.parse(plain);
  } catch {
    /* تالف */
  }
  return {};
}

export function writeCredentials(creds: Record<string, PortalCredential>): void {
  const json = JSON.stringify(creds);
  if (safeStorage.isEncryptionAvailable()) {
    setSetting("portal_creds_enc", safeStorage.encryptString(json).toString("base64"));
    setSetting("portal_creds", "");
  } else {
    setSetting("portal_creds", json);
    setSetting("portal_creds_enc", "");
  }
}

/** ملخص آمن للواجهة: بلا كلمات مرور. */
export function credentialSummary(): Record<string, { username: string; autofill: boolean; hasPassword: boolean }> {
  const out: Record<string, { username: string; autofill: boolean; hasPassword: boolean }> = {};
  for (const [id, c] of Object.entries(readCredentials())) out[id] = { username: c.username, autofill: c.autofill, hasPassword: !!c.password };
  return out;
}

/* --------------------------- الشهادات الموثوقة --------------------------- */

function trustedCerts(): Set<string> {
  try {
    return new Set(JSON.parse(getSetting(TRUST_SETTING, "[]")) as string[]);
  } catch {
    return new Set();
  }
}

export class PortalManager implements PortalDriver {
  private win: BrowserWindow | null = null;
  private tabs = new Map<string, Tab>();
  private active: string | null = null;
  private visible = false;
  private bounds = { x: 0, y: 0, width: 0, height: 0 };
  private broadcastTimer: ReturnType<typeof setTimeout> | null = null;

  attach(win: BrowserWindow): void {
    this.win = win;
    win.on("closed", () => {
      this.tabs.clear();
      this.win = null;
    });
  }

  /* ----------------------------- الإعدادات ----------------------------- */

  list(): PortalConfig[] {
    return parsePortals(getSetting("portals", ""));
  }

  save(list: PortalConfig[]): PortalsState {
    const clean = list
      .filter((p) => p.id && p.url)
      .map((p) => ({ ...p, url: normalizeUrl(p.url), name: p.name.trim() || p.url }));
    setSetting("portals", JSON.stringify(clean));
    for (const id of [...this.tabs.keys()]) if (!clean.some((p) => p.id === id)) this.closeTab(id);
    for (const p of clean) {
      const tab = this.tabs.get(p.id);
      if (tab) void this.applyTheme(p.id);
    }
    return this.state();
  }

  config(id: string): PortalConfig | null {
    return this.list().find((p) => p.id === id) ?? null;
  }

  /* ------------------------------ العرض ------------------------------ */

  private ensureTab(id: string): Tab {
    const existing = this.tabs.get(id);
    if (existing) return existing;
    const cfg = this.config(id);
    if (!cfg) throw new Error("بوابة غير معروفة");
    if (!this.win) throw new Error("النافذة الرئيسية غير جاهزة");
    const ses = session.fromPartition(PARTITION);
    ses.setUserAgent(ses.getUserAgent().replace(/ Electron\/[\d.]+/, "").replace(/ mbzuh-admin\/[\d.]+/i, ""));
    const view = new WebContentsView({
      webPreferences: {
        partition: PARTITION,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        spellcheck: false,
        // تبقى الصفحة حيّة (مؤقتات ورسوم) حتى وهي مخفية، ليتمكن المساعد من قراءتها من أي صفحة في التطبيق.
        backgroundThrottling: false,
      },
    });
    const tab: Tab = { view, cssKeys: {}, error: null, certIssue: null, lastCert: null, zoom: 1, autofills: { host: "", count: 0, at: 0 } };
    view.setBackgroundColor("#f6f3ec");
    const wc = view.webContents;
    wc.setWindowOpenHandler(({ url }) => {
      if (isPortalInternalUrl(url, cfg.url)) void wc.loadURL(url);
      else if (url.startsWith("http")) void shell.openExternal(url);
      return { action: "deny" };
    });
    const bc = () => this.broadcast();
    wc.on("did-start-loading", bc);
    wc.on("did-stop-loading", bc);
    wc.on("did-navigate", () => {
      tab.error = null;
      tab.certIssue = null;
      bc();
    });
    wc.on("did-navigate-in-page", bc);
    wc.on("page-title-updated", bc);
    wc.on("dom-ready", () => {
      tab.cssKeys = {};
      void this.applyTheme(id);
      void this.applyAutofill(id);
    });
    // نوافذ «هل تريد مغادرة الصفحة؟» تعلّق التنقّل الآلي؛ لا نسمح بها.
    wc.on("will-prevent-unload", (e) => e.preventDefault());
    wc.on("did-fail-load", (_e, code, desc, url, isMainFrame) => {
      if (!isMainFrame || code === -3) return;
      tab.error = describeLoadError(code, desc);
      let host = "";
      try {
        host = new URL(url).hostname;
      } catch {
        /* تجاهل */
      }
      tab.certIssue = /^ERR_CERT_/.test(desc) && tab.lastCert && tab.lastCert.host === host ? tab.lastCert : null;
      bc();
    });
    wc.on("render-process-gone", (_e, details) => {
      tab.error = `توقفت صفحة البوابة (${details.reason}). أعد التحميل.`;
      bc();
    });
    wc.on("unresponsive", () => {
      tab.error = "الصفحة لا تستجيب. أعد التحميل أو انتظر قليلًا.";
      bc();
    });
    wc.on("responsive", () => {
      if (tab.error?.startsWith("الصفحة لا تستجيب")) tab.error = null;
      bc();
    });
    this.win.contentView.addChildView(view);
    view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    view.setVisible(false);
    this.tabs.set(id, tab);
    void wc.loadURL(cfg.url);
    return tab;
  }

  private closeTab(id: string): void {
    const tab = this.tabs.get(id);
    if (!tab) return;
    if (this.win && !this.win.isDestroyed()) this.win.contentView.removeChildView(tab.view);
    tab.view.webContents.close();
    this.tabs.delete(id);
    if (this.active === id) this.active = null;
  }

  private async applyTheme(id: string): Promise<void> {
    const tab = this.tabs.get(id);
    const cfg = this.config(id);
    const wc = tab?.view.webContents;
    if (!tab || !cfg || !wc || wc.isDestroyed()) return;
    try {
      if (cfg.theme === "modern") {
        if (!tab.cssKeys.modern) tab.cssKeys.modern = await wc.insertCSS(MODERN_CSS, { cssOrigin: "author" });
        if (cfg.dark) {
          if (!tab.cssKeys.dark) tab.cssKeys.dark = await wc.insertCSS(DARK_CSS, { cssOrigin: "author" });
        } else if (tab.cssKeys.dark) {
          await wc.removeInsertedCSS(tab.cssKeys.dark);
          tab.cssKeys.dark = undefined;
        }
      } else {
        if (tab.cssKeys.dark) await wc.removeInsertedCSS(tab.cssKeys.dark);
        if (tab.cssKeys.modern) await wc.removeInsertedCSS(tab.cssKeys.modern);
        tab.cssKeys = {};
      }
      tab.view.setBackgroundColor(cfg.theme === "modern" && cfg.dark ? "#0b1426" : "#f6f3ec");
    } catch {
      /* الصفحة قد تكون انتقلت أثناء الحقن */
    }
    this.broadcast();
  }

  /** تعبئة بيانات الدخول المحفوظة تلقائيًا في صفحات تسجيل الدخول (حد أقصى 4 مرات لكل نطاق). */
  private async applyAutofill(id: string): Promise<void> {
    const tab = this.tabs.get(id);
    const wc = tab?.view.webContents;
    if (!tab || !wc || wc.isDestroyed()) return;
    const cred = readCredentials()[id];
    if (!cred?.autofill || !cred.username) return;
    let host = "";
    try {
      host = new URL(wc.getURL()).hostname;
    } catch {
      return;
    }
    if (tab.autofills.host !== host || Date.now() - tab.autofills.at > 120_000) tab.autofills = { host, count: 0, at: Date.now() };
    if (tab.autofills.count >= 4) return;
    try {
      // ننتظر قليلًا حتى تُرسم النماذج (صفحات مايكروسوفت تُبنى بالـJS)
      await new Promise((r) => setTimeout(r, 700));
      if (wc.isDestroyed()) return;
      const did = await wc.executeJavaScript(AUTOFILL_JS(cred.username, cred.password, cred.autoSubmit), true);
      if (did) tab.autofills.count++;
    } catch {
      /* الصفحة انتقلت */
    }
  }

  private tabState(id: string): PortalTabState {
    const tab = this.tabs.get(id);
    const wc = tab?.view.webContents;
    const alive = !!wc && !wc.isDestroyed();
    const cfg = this.config(id);
    return {
      id,
      url: alive ? wc!.getURL() : (cfg?.url ?? ""),
      title: alive ? wc!.getTitle() : "",
      loading: alive ? wc!.isLoading() : false,
      canGoBack: alive ? wc!.navigationHistory.canGoBack() : false,
      canGoForward: alive ? wc!.navigationHistory.canGoForward() : false,
      error: tab?.error ?? null,
      certIssue: tab?.certIssue ?? null,
      zoom: tab?.zoom ?? 1,
    };
  }

  state(): PortalsState {
    return { active: this.active, portals: this.list(), tabs: [...this.tabs.keys()].map((id) => this.tabState(id)) };
  }

  /** بث الحالة للواجهة مع تجميع الأحداث المتلاحقة (تحديثات العنوان من Outlook/Teams كثيرة). */
  private broadcast(): void {
    if (this.broadcastTimer) return;
    this.broadcastTimer = setTimeout(() => {
      this.broadcastTimer = null;
      if (!this.win || this.win.isDestroyed()) return;
      this.win.webContents.send("app:portals", this.state());
    }, 80);
  }

  /** يفعّل بوابة ويعرضها في المساحة المحددة. */
  open(id: string, bounds?: { x: number; y: number; width: number; height: number }): PortalsState {
    const tab = this.ensureTab(id);
    if (this.active && this.active !== id) this.tabs.get(this.active)?.view.setVisible(false);
    this.active = id;
    if (bounds) this.bounds = this.round(bounds);
    tab.view.setBounds(this.bounds);
    tab.view.setVisible(this.visible = true);
    this.broadcast();
    return this.state();
  }

  private round(b: { x: number; y: number; width: number; height: number }) {
    return { x: Math.round(b.x), y: Math.round(b.y), width: Math.max(0, Math.round(b.width)), height: Math.max(0, Math.round(b.height)) };
  }

  setBounds(bounds: { x: number; y: number; width: number; height: number }): PortalsState {
    this.bounds = this.round(bounds);
    if (this.active) {
      const tab = this.tabs.get(this.active);
      tab?.view.setBounds(this.bounds);
      if (!this.visible) {
        tab?.view.setVisible(true);
        this.visible = true;
      }
    }
    return this.state();
  }

  hide(): void {
    for (const t of this.tabs.values()) t.view.setVisible(false);
    this.visible = false;
  }

  setVisible(visible: boolean): void {
    if (!visible) return this.hide();
    if (this.active) {
      const tab = this.tabs.get(this.active);
      tab?.view.setBounds(this.bounds);
      tab?.view.setVisible(true);
      this.visible = true;
    }
  }

  private activeTab(): { id: string; tab: Tab; cfg: PortalConfig } {
    if (!this.active) throw new Error("لا توجد بوابة مفتوحة");
    const tab = this.tabs.get(this.active);
    const cfg = this.config(this.active);
    if (!tab || !cfg) throw new Error("البوابة غير جاهزة");
    return { id: this.active, tab, cfg };
  }

  navigate(action: "back" | "forward" | "reload" | "home" | "stop" | "url", url?: string): PortalsState {
    const { tab, cfg } = this.activeTab();
    const wc = tab.view.webContents;
    tab.error = null;
    switch (action) {
      case "back":
        if (wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack();
        break;
      case "forward":
        if (wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward();
        break;
      case "reload":
        wc.reload();
        break;
      case "stop":
        wc.stop();
        break;
      case "home":
        void wc.loadURL(cfg.url);
        break;
      case "url":
        if (url) {
          const target = normalizeUrl(url);
          if (isPortalInternalUrl(target, cfg.url)) void wc.loadURL(target);
          else void shell.openExternal(target);
        }
        break;
    }
    return this.state();
  }

  setZoom(direction: "in" | "out" | "reset"): PortalsState {
    const { tab } = this.activeTab();
    tab.zoom = direction === "reset" ? 1 : Math.min(2, Math.max(0.6, tab.zoom + (direction === "in" ? 0.1 : -0.1)));
    tab.view.webContents.setZoomFactor(Number(tab.zoom.toFixed(2)));
    return this.state();
  }

  async setTheme(id: string, theme: "modern" | "original", dark: boolean): Promise<PortalsState> {
    const list = this.list().map((p) => (p.id === id ? { ...p, theme, dark } : p));
    setSetting("portals", JSON.stringify(list));
    await this.applyTheme(id);
    return this.state();
  }

  async clearSession(): Promise<void> {
    const ses = session.fromPartition(PARTITION);
    await ses.clearStorageData();
    await ses.clearCache();
    for (const [id, tab] of this.tabs) {
      const cfg = this.config(id);
      if (cfg) void tab.view.webContents.loadURL(cfg.url);
    }
  }

  openExternal(id?: string): void {
    const target = id ?? this.active;
    const tab = target ? this.tabs.get(target) : null;
    const url = tab && !tab.view.webContents.isDestroyed() ? tab.view.webContents.getURL() : this.config(target ?? "")?.url;
    if (url) void shell.openExternal(url);
  }

  /* ----------------------------- الشهادات ----------------------------- */

  /**
   * يُستدعى من حدث app «certificate-error». يقبل الشهادة إن كان المستخدم قد وثق بها
   * صراحةً (المضيف + البصمة)، وإلا يرفضها ويسجّل المشكلة لعرضها في الواجهة مع زر الوثوق.
   */
  onCertificateError(wc: WebContents, url: string, error: string, cert: Electron.Certificate): boolean {
    const entry = [...this.tabs.entries()].find(([, t]) => t.view.webContents.id === wc.id);
    if (!entry) return false;
    let host = "";
    try {
      host = new URL(url).hostname;
    } catch {
      return false;
    }
    // الوثوق على مستوى المضيف (لا البصمة) لأن بعض الخوادم الداخلية تقدّم شهادات متعددة/متجددة.
    if (trustedCerts().has(host)) return true;
    entry[1].lastCert = { host, fingerprint: cert.fingerprint, issuer: cert.issuerName || cert.issuer?.organizations?.[0] || "غير معروف", error };
    return false;
  }

  /** يوثّق بالشهادة الحالية المرفوضة لبوابة ويعيد تحميلها. */
  trustCertificate(id: string): PortalsState {
    const tab = this.tabs.get(id);
    if (!tab?.certIssue) return this.state();
    const set = trustedCerts();
    set.add(tab.certIssue.host);
    setSetting(TRUST_SETTING, JSON.stringify([...set]));
    tab.certIssue = null;
    tab.lastCert = null;
    tab.error = null;
    const cfg = this.config(id);
    const wc = tab.view.webContents;
    const current = wc.getURL();
    void wc.loadURL(current && current !== "about:blank" ? current : (cfg?.url ?? ""));
    return this.state();
  }

  /* -------------------- واجهة للمساعد الذكي (PortalDriver) -------------------- */

  activeId(): string | null {
    return this.active;
  }

  /** ينفّذ JavaScript داخل البوابة النشطة ويعيد الناتج. */
  async evaluate<T>(code: string): Promise<T> {
    const { tab } = this.activeTab();
    if (tab.error) throw new Error(`البوابة لم تُحمَّل: ${tab.error}`);
    return (await tab.view.webContents.executeJavaScript(code, true)) as T;
  }

  async capture(): Promise<{ jpeg: string; width: number; height: number }> {
    const { tab } = this.activeTab();
    const img = await tab.view.webContents.capturePage();
    const size = img.getSize();
    const scaled = size.width > 1280 ? img.resize({ width: 1280 }) : img;
    const s = scaled.getSize();
    return { jpeg: scaled.toJPEG(72).toString("base64"), width: s.width, height: s.height };
  }

  async loadUrl(url: string): Promise<void> {
    const { tab, cfg } = this.activeTab();
    const target = normalizeUrl(url);
    if (!isPortalInternalUrl(target, cfg.url)) throw new Error("الرابط خارج نطاق البوابة.");
    tab.error = null;
    try {
      await tab.view.webContents.loadURL(target);
    } catch (e) {
      // ERR_ABORTED يحدث عند إعادة التوجيه داخل التطبيقات أحادية الصفحة — ليس خطأ فعليًا.
      if (!/ERR_ABORTED/.test(String(e))) throw e;
    }
  }
}

export const portals = new PortalManager();
