/**
 * البوابات الجامعية: UMS، لوحة الدورات Hub، Outlook، Teams، SharePoint، OneHub، وأي بوابة يضيفها المستخدم.
 * - سطح المكتب: تُعرض داخل التطبيق عبر WebContentsView (هذه الواجهة ترسم التبويبات
 *   وشريط الأدوات و«المساعد داخل البوابة» وتبلّغ العملية الرئيسية بمساحة العرض).
 * - الجوال: تُفتح في متصفح أصلي داخل التطبيق مع حقن المظهر الحديث وشريط أوامر ذكي.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { Button, useUi } from "../components/ui";
import { Icon } from "../components/icons";
import { PortalCopilot } from "../components/PortalCopilot";
import { PORTAL_COLORS, type PortalConfig, type PortalsState } from "@shared/portals";
import { isMobileRuntime } from "../platform/runtime";
import logoUrl from "../assets/logo.png";
import type { PageId } from "../App";

/** initialId قد يكون «معرّف» أو «معرّف|رابط» لفتح صفحة محددة (مثل مصدر مهمة). */
function parseInitial(initial?: string): { id?: string; url?: string } {
  if (!initial) return {};
  const i = initial.indexOf("|");
  return i < 0 ? { id: initial } : { id: initial.slice(0, i), url: initial.slice(i + 1) };
}

export default function PortalsPage({ initialId, onNavigate }: { initialId?: string; onNavigate: (p: PageId, id?: number, q?: string) => void }) {
  const { toast } = useUi();
  const mobile = isMobileRuntime();
  const hostRef = useRef<HTMLDivElement>(null);
  const initial = useMemo(() => parseInitial(initialId), [initialId]);
  const [state, setState] = useState<PortalsState | null>(null);
  const [urlDraft, setUrlDraft] = useState("");
  const [editingUrl, setEditingUrl] = useState(false);
  const [launcher, setLauncher] = useState(!initial.id);
  const [copilot, setCopilot] = useState(() => localStorage.getItem("portal_copilot") !== "0");
  const [dock, setDock] = useState<"side" | "bottom">(() => (window.innerWidth >= 1180 ? "side" : "bottom"));

  const rect = () => {
    const r = hostRef.current?.getBoundingClientRect();
    return r ? { x: r.left, y: r.top, width: r.width, height: r.height } : { x: 0, y: 0, width: 0, height: 0 };
  };

  const open = useCallback(
    async (id: string, url?: string) => {
      setLauncher(false);
      if (mobile) {
        setState(await api.portal.open(id, url ? ({ url } as never) : undefined));
        return;
      }
      // ننتظر إطارًا حتى يُرسم الحاوي بعد إغلاق شاشة الاختيار
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const s = await api.portal.open(id, rect());
      setState(s);
      if (url) setState(await api.portal.navigate("url", url));
    },
    [mobile],
  );

  useEffect(() => {
    void api.portal.state().then(setState);
    if (initial.id) void open(initial.id, initial.url);
    const off = window.dynamo.on("app:portals", (s) => setState(s as PortalsState));
    const onResize = () => setDock(window.innerWidth >= 1180 ? "side" : "bottom");
    window.addEventListener("resize", onResize);
    return () => {
      off();
      window.removeEventListener("resize", onResize);
      if (!mobile) void api.portal.hide();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mobile || launcher) return;
    const sync = () => void api.portal.bounds(rect()).then(setState);
    sync();
    const ro = new ResizeObserver(sync);
    if (hostRef.current) ro.observe(hostRef.current);
    window.addEventListener("resize", sync);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [mobile, launcher, copilot, dock]);

  // إظهار شاشة الاختيار يخفي العرض المدمج
  useEffect(() => {
    if (!mobile) void api.portal.visible(!launcher);
  }, [launcher, mobile]);

  useEffect(() => {
    localStorage.setItem("portal_copilot", copilot ? "1" : "0");
  }, [copilot]);

  const active = useMemo(() => state?.portals.find((p) => p.id === state.active) ?? null, [state]);
  const tab = useMemo(() => state?.tabs.find((t) => t.id === state.active) ?? null, [state]);

  const nav = async (action: "back" | "forward" | "reload" | "home" | "stop") => setState(await api.portal.navigate(action));

  const toggleTheme = async () => {
    if (!active) return;
    const next = active.theme === "modern" ? "original" : "modern";
    setState(await api.portal.theme(active.id, next, active.dark));
    toast(next === "modern" ? "تم تفعيل المظهر الحديث" : "تم الرجوع للمظهر الأصلي للموقع");
  };

  const goUrl = async () => {
    setEditingUrl(false);
    if (!urlDraft.trim()) return;
    setState(await api.portal.navigate("url", urlDraft.trim()));
  };

  let host = "";
  try {
    host = tab?.url ? new URL(tab.url).hostname : "";
  } catch {
    host = tab?.url ?? "";
  }

  if (!state) return <div className="p-6 skeleton" style={{ height: 200 }} />;

  /* ------------------------------ شاشة الاختيار ------------------------------ */
  if (launcher || mobile) {
    return (
      <div className="p-5 md:p-6 max-w-[1200px] mx-auto">
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-extrabold">البوابات</h1>
            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
              كل أنظمة الجامعة في مكان واحد بجلسة دخول موحّدة. {mobile ? "تُفتح داخل التطبيق بمظهر حديث ومعها شريط أوامر للمساعد الذكي." : "تُعرض داخل التطبيق ومعها المساعد الذكي يقرأ الصفحة وينفّذ أوامرك عليها."}
            </p>
          </div>
          <div className="flex gap-2">
            {!mobile && state.active && (
              <Button variant="primary" onClick={() => setLauncher(false)}>
                العودة إلى {active?.name}
              </Button>
            )}
            <Button onClick={() => onNavigate("settings")}>
              <Icon name="settings" size={14} /> إدارة البوابات
            </Button>
          </div>
        </div>

        <div className="grid gap-3 stagger" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
          {state.portals.map((p) => (
            <PortalCard key={p.id} portal={p} live={state.tabs.find((t) => t.id === p.id)} onOpen={() => void open(p.id)} />
          ))}
        </div>

        {mobile && (
          <div className="mt-4 flex gap-2 flex-wrap">
            <Button
              variant="ghost"
              onClick={async () => {
                if (await api.portal.clearSession()) toast("تم مسح جلسة البوابات", "ok");
              }}
            >
              <Icon name="logout" size={14} /> تسجيل الخروج من كل البوابات
            </Button>
          </div>
        )}
      </div>
    );
  }

  /* ------------------------------ العرض المدمج ------------------------------ */
  return (
    <div className="flex flex-col h-full">
      <div className="glass flex items-center gap-2 px-3 py-2 flex-wrap" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="btn-icon" title="كل البوابات" onClick={() => setLauncher(true)}>
            <Icon name="grid" />
          </Button>
          <Button size="sm" variant="ghost" className="btn-icon" title="رجوع" disabled={!tab?.canGoBack} onClick={() => void nav("back")}>
            <Icon name="arrowRight" />
          </Button>
          <Button size="sm" variant="ghost" className="btn-icon" title="تقدّم" disabled={!tab?.canGoForward} onClick={() => void nav("forward")}>
            <Icon name="arrowLeft" />
          </Button>
          <Button size="sm" variant="ghost" className="btn-icon" title={tab?.loading ? "إيقاف" : "إعادة تحميل"} onClick={() => void nav(tab?.loading ? "stop" : "reload")}>
            <Icon name={tab?.loading ? "stop" : "refresh"} />
          </Button>
          <Button size="sm" variant="ghost" className="btn-icon" title="الصفحة الرئيسية للبوابة" onClick={() => void nav("home")}>
            <Icon name="home" />
          </Button>
        </div>

        {/* تبويبات البوابات */}
        <div className="flex items-center gap-1 overflow-x-auto" style={{ maxWidth: "38%" }}>
          {state.portals.map((p) => {
            const c = PORTAL_COLORS[p.color];
            const on = p.id === state.active;
            return (
              <button
                key={p.id}
                onClick={() => void open(p.id)}
                className="shrink-0 flex items-center gap-1.5 text-[12.5px] font-bold"
                title={p.name}
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: `1px solid ${on ? c.bg : "var(--border)"}`,
                  background: on ? c.bg : "transparent",
                  color: on ? c.ink : "var(--ink-2)",
                  cursor: "pointer",
                }}
              >
                <span className="inline-flex items-center justify-center rounded-full" style={{ width: 18, height: 18, background: on ? "rgba(0,0,0,.15)" : c.bg, color: c.ink, fontSize: 10 }}>
                  {p.glyph}
                </span>
                <span className="truncate" style={{ maxWidth: 120 }}>
                  {p.name}
                </span>
              </button>
            );
          })}
        </div>

        <div
          className="flex-1 min-w-[220px] flex items-center gap-2 px-3 py-1.5 rounded-full"
          style={{ background: "var(--panel-2)", border: "1px solid var(--border)", cursor: "text" }}
          onClick={() => {
            if (!editingUrl) {
              setUrlDraft(tab?.url ?? "");
              setEditingUrl(true);
            }
          }}
        >
          <span className="live-dot" style={{ background: tab?.error ? "var(--danger)" : tab?.loading ? "var(--warn)" : "var(--ok)" }} />
          {editingUrl ? (
            <input
              autoFocus
              className="flex-1 bg-transparent outline-none text-sm"
              dir="ltr"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              onBlur={() => setEditingUrl(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void goUrl();
                if (e.key === "Escape") setEditingUrl(false);
              }}
            />
          ) : (
            <>
              <span className="text-sm font-semibold truncate">{tab?.title || active?.name}</span>
              <span className="text-xs truncate" dir="ltr" style={{ color: "var(--muted)" }}>
                {host}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="btn-icon" title="تصغير" onClick={async () => setState(await api.portal.zoom("out"))}>
            <Icon name="zoomOut" />
          </Button>
          <button className="text-xs tabular-nums px-1" style={{ color: "var(--muted)", background: "none", border: "none", cursor: "pointer" }} onClick={async () => setState(await api.portal.zoom("reset"))}>
            {Math.round((tab?.zoom ?? 1) * 100)}%
          </button>
          <Button size="sm" variant="ghost" className="btn-icon" title="تكبير" onClick={async () => setState(await api.portal.zoom("in"))}>
            <Icon name="zoomIn" />
          </Button>
          <Button size="sm" variant={active?.theme === "modern" ? "primary" : "default"} onClick={() => void toggleTheme()} title="تبديل المظهر الحديث/الأصلي">
            <Icon name="palette" size={15} />
            {active?.theme === "modern" ? "حديث" : "أصلي"}
          </Button>
          {active?.theme === "modern" && (
            <Button size="sm" variant="ghost" className="btn-icon" title={active.dark ? "وضع فاتح" : "وضع داكن"} onClick={async () => setState(await api.portal.theme(active.id, "modern", !active.dark))}>
              <Icon name={active.dark ? "sun" : "moon"} />
            </Button>
          )}
          <Button
            size="sm"
            variant={copilot ? "primary" : "ghost"}
            title={copilot ? "إخفاء المساعد" : "المساعد داخل البوابة (أوامر تُنفَّذ على هذه الصفحة)"}
            onClick={() => setCopilot((v) => !v)}
          >
            <Icon name="sparkles" size={15} /> المساعد
          </Button>
          <Button size="sm" variant="ghost" className="btn-icon" title="فتح في المتصفح" onClick={() => void api.portal.openExternal()}>
            <Icon name="external" />
          </Button>
        </div>
      </div>

      <div className={`flex-1 min-h-0 flex ${dock === "side" ? "flex-row" : "flex-col"}`}>
        <div ref={hostRef} className="flex-1 relative min-h-0 min-w-0">
          <div className="absolute inset-0 flex items-center justify-center p-8" style={{ zIndex: 0 }}>
            {tab?.certIssue ? (
              <div className="panel p-6 max-w-lg text-center pop">
                <div className="tool-icon mx-auto" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>
                  <Icon name="shield" size={20} />
                </div>
                <h3 className="font-bold mb-1">شهادة الأمان لموقع {tab.certIssue.host} غير موثوقة على هذا الجهاز</h3>
                <p className="text-sm mb-1" style={{ color: "var(--muted)" }}>
                  هذا يحدث عادةً مع الأنظمة الداخلية التي تستخدم شهادة صادرة من الجامعة نفسها. جهة الإصدار: {tab.certIssue.issuer} ({tab.certIssue.error}).
                </p>
                <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
                  إن كنت متأكدًا أن هذا هو موقع الجامعة (يعمل لديك في المتصفح المعتاد)، يمكنك الوثوق بهذه الشهادة تحديدًا؛ سيُحفظ القرار لهذا الموقع فقط.
                </p>
                <div className="flex gap-2 justify-center flex-wrap">
                  <Button
                    variant="primary"
                    onClick={async () => {
                      if (active) setState(await api.portal.trustCert(active.id));
                      toast("تم الوثوق بالشهادة وإعادة التحميل", "ok");
                    }}
                  >
                    <Icon name="check" size={14} /> الوثوق بالشهادة والمتابعة
                  </Button>
                  <Button onClick={() => void api.portal.openExternal()}>فتح في المتصفح</Button>
                </div>
              </div>
            ) : tab?.error ? (
              <div className="panel p-6 max-w-md text-center pop">
                <div className="tool-icon mx-auto" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
                  !
                </div>
                <h3 className="font-bold mb-1">تعذّر الوصول إلى {active?.name}</h3>
                <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
                  {tab.error}
                </p>
                <div className="flex gap-2 justify-center">
                  <Button variant="primary" onClick={() => void nav("reload")}>
                    إعادة المحاولة
                  </Button>
                  <Button onClick={() => void api.portal.openExternal()}>فتح في المتصفح</Button>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <img src={logoUrl} alt="" width={110} height={110} className="mx-auto mb-4 float" style={{ opacity: 0.85 }} />
                <div className="skeleton mx-auto mb-3" style={{ width: 240, height: 14 }} />
                <p className="text-sm mt-4" style={{ color: "var(--muted)" }}>
                  جارٍ تحميل {active?.name ?? "البوابة"}…
                </p>
              </div>
            )}
          </div>
        </div>
        {copilot && active && <PortalCopilot key={active.id} portal={active} url={tab?.url ?? active.url} title={tab?.title ?? ""} dock={dock} onClose={() => setCopilot(false)} />}
      </div>
    </div>
  );
}

export function PortalCard({ portal, live, onOpen, compact }: { portal: PortalConfig; live?: { title: string; loading: boolean; error: string | null }; onOpen: () => void; compact?: boolean }) {
  const c = PORTAL_COLORS[portal.color];
  return (
    <button onClick={onOpen} className="portal-card text-start" style={{ background: c.bg, color: c.ink, minHeight: compact ? 96 : 150 }}>
      <div className="flex items-start justify-between">
        <span className="portal-glyph" style={{ background: "rgba(255,255,255,.55)", color: c.ink }}>
          {portal.glyph}
        </span>
        <span className="portal-arrow">
          <Icon name="arrowLeft" size={16} />
        </span>
      </div>
      <div className="mt-auto">
        <div className="font-extrabold text-[15px] leading-snug">{portal.name}</div>
        {!compact && (
          <div className="text-[12px] mt-0.5" style={{ opacity: 0.75 }}>
            {live?.error ? "⚠ " + live.error.split("(")[0] : live?.title && !live.loading ? live.title : (portal.hint ?? portal.url.replace(/^https?:\/\//, ""))}
          </div>
        )}
      </div>
    </button>
  );
}
