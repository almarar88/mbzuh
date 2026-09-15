/**
 * سائق البوابات على أندرويد: ينفّذ أدوات المساعد (portal_*) داخل WebView البوابة الأصلية
 * عبر الجسر. النتائج تعود بشكل غير متزامن من الطبقة الأصلية عبر window.__mbzuhPortalResult.
 */
import type { PortalDriver } from "../../electron/services/portal-tools";
import type { PortalConfig, PortalsState } from "../../shared/portals";

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };
const pending = new Map<string, Pending>();
let seq = 0;

function installResultHook(): void {
  if (window.__mbzuhPortalResult) return;
  window.__mbzuhPortalResult = (reqId: string, value: unknown) => {
    const p = pending.get(reqId);
    if (!p) return;
    pending.delete(reqId);
    const err = value && typeof value === "object" && "__error" in (value as Record<string, unknown>) ? String((value as Record<string, unknown>).__error) : null;
    if (err) p.reject(new Error(err));
    else p.resolve(value);
  };
}

function request<T>(fire: (reqId: string) => void): Promise<T> {
  installResultHook();
  const reqId = `r${Date.now().toString(36)}${(seq++).toString(36)}`;
  return new Promise<T>((resolve, reject) => {
    pending.set(reqId, { resolve: resolve as (v: unknown) => void, reject });
    try {
      fire(reqId);
    } catch (e) {
      pending.delete(reqId);
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}

function bridge() {
  const b = window.AndroidBridge;
  if (!b || !b.portalEval) throw new Error("التحكم في البوابات متاح داخل تطبيق أندرويد فقط.");
  return b as Required<NonNullable<typeof window.AndroidBridge>>;
}

function info(): { open: boolean; id: string; url: string; title: string } {
  try {
    return JSON.parse(bridge().portalInfo() || "{}");
  } catch {
    return { open: false, id: "", url: "", title: "" };
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createMobilePortalDriver(listPortals: () => PortalConfig[], openPortal: (id: string, url?: string) => void): PortalDriver {
  const state = (): PortalsState => {
    const i = info();
    return {
      active: i.open ? i.id : null,
      portals: listPortals(),
      tabs: i.open ? [{ id: i.id, url: i.url, title: i.title, loading: false, canGoBack: false, canGoForward: false, error: null, certIssue: null, zoom: 1 }] : [],
    };
  };
  return {
    state,
    async open(id) {
      const i = info();
      if (!(i.open && i.id === id)) {
        openPortal(id);
        for (let k = 0; k < 20; k++) {
          await sleep(500);
          const n = info();
          if (n.open && n.id === id && n.url) break;
        }
      }
      return state();
    },
    async loadUrl(url) {
      bridge().portalNavigate(url);
      await sleep(800);
    },
    navigate(action) {
      bridge().portalAction(action);
    },
    evaluate<T>(code: string) {
      return request<T>((reqId) => bridge().portalEval(reqId, code));
    },
    capture() {
      return request<{ jpeg: string; width: number; height: number }>((reqId) => bridge().portalCapture(reqId));
    },
  };
}
