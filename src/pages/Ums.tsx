/**
 * لوحة نظام الجامعة الموحّد (UMS) داخل التطبيق.
 * الصفحة نفسها تُعرض عبر WebContentsView في العملية الرئيسية؛ هذه الواجهة ترسم
 * شريط الأدوات وتخبر العملية الرئيسية بمساحة العرض المتاحة.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { Button, useUi } from "../components/ui";
import { Icon } from "../components/icons";
import type { UmsState } from "@shared/types";
import logoUrl from "../assets/logo.png";

export default function UmsPage() {
  const { toast } = useUi();
  const hostRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<UmsState | null>(null);
  const [urlDraft, setUrlDraft] = useState("");
  const [editingUrl, setEditingUrl] = useState(false);

  const sync = useCallback(async () => {
    const el = hostRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const s = await api.ums.show({ x: r.left, y: r.top, width: r.width, height: r.height });
    setState(s);
  }, []);

  useEffect(() => {
    void sync();
    const ro = new ResizeObserver(() => void sync());
    if (hostRef.current) ro.observe(hostRef.current);
    window.addEventListener("resize", sync);
    const off = window.dynamo.on("app:ums", (s) => setState(s as UmsState));
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sync);
      off();
      void api.ums.hide();
    };
  }, [sync]);

  const nav = async (action: "back" | "forward" | "reload" | "home" | "stop") => setState(await api.ums.navigate(action));

  const toggleTheme = async () => {
    if (!state) return;
    const next = state.theme === "modern" ? "original" : "modern";
    setState(await api.ums.theme(next, state.dark));
    toast(next === "modern" ? "تم تفعيل المظهر الحديث" : "تم الرجوع للمظهر الأصلي للموقع");
  };

  const toggleDark = async () => {
    if (!state) return;
    setState(await api.ums.theme("modern", !state.dark));
  };

  const goUrl = async () => {
    setEditingUrl(false);
    if (!urlDraft.trim()) return;
    setState(await api.ums.navigate("url", urlDraft.trim()));
  };

  const displayUrl = state?.url ?? "";
  let host = "";
  try {
    host = displayUrl ? new URL(displayUrl).hostname : "";
  } catch {
    host = displayUrl;
  }

  return (
    <div className="flex flex-col h-full">
      <div
        className="glass flex items-center gap-2 px-3 py-2 flex-wrap"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="btn-icon" title="رجوع" disabled={!state?.canGoBack} onClick={() => void nav("back")}>
            <Icon name="arrowRight" />
          </Button>
          <Button size="sm" variant="ghost" className="btn-icon" title="تقدّم" disabled={!state?.canGoForward} onClick={() => void nav("forward")}>
            <Icon name="arrowLeft" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="btn-icon"
            title={state?.loading ? "إيقاف" : "إعادة تحميل"}
            onClick={() => void nav(state?.loading ? "stop" : "reload")}
          >
            <Icon name={state?.loading ? "stop" : "refresh"} />
          </Button>
          <Button size="sm" variant="ghost" className="btn-icon" title="الصفحة الرئيسية للوحة" onClick={() => void nav("home")}>
            <Icon name="home" />
          </Button>
        </div>

        <div
          className="flex-1 min-w-[260px] flex items-center gap-2 px-3 py-1.5 rounded-xl"
          style={{ background: "var(--panel-2)", border: "1px solid var(--border)", cursor: "text" }}
          onClick={() => {
            if (!editingUrl) {
              setUrlDraft(displayUrl);
              setEditingUrl(true);
            }
          }}
        >
          <span className="live-dot" style={{ background: state?.error ? "var(--danger)" : state?.loading ? "var(--warn)" : "var(--ok)" }} />
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
              <span className="text-sm font-semibold truncate">{state?.title || "نظام الجامعة الموحّد"}</span>
              <span className="text-xs truncate" dir="ltr" style={{ color: "var(--muted)" }}>
                {host}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="btn-icon" title="تصغير" onClick={async () => setState(await api.ums.zoom("out"))}>
            <Icon name="zoomOut" />
          </Button>
          <button
            className="text-xs tabular-nums px-1"
            style={{ color: "var(--muted)", background: "none", border: "none", cursor: "pointer" }}
            title="الحجم الافتراضي"
            onClick={async () => setState(await api.ums.zoom("reset"))}
          >
            {Math.round((state?.zoom ?? 1) * 100)}%
          </button>
          <Button size="sm" variant="ghost" className="btn-icon" title="تكبير" onClick={async () => setState(await api.ums.zoom("in"))}>
            <Icon name="zoomIn" />
          </Button>
        </div>

        <div className="flex items-center gap-1" style={{ borderInlineStart: "1px solid var(--border)", paddingInlineStart: 8 }}>
          <Button
            size="sm"
            variant={state?.theme === "modern" ? "primary" : "default"}
            onClick={() => void toggleTheme()}
            title="تبديل بين المظهر الحديث والمظهر الأصلي للموقع"
          >
            <Icon name="palette" size={15} />
            {state?.theme === "modern" ? "المظهر الحديث" : "المظهر الأصلي"}
          </Button>
          {state?.theme === "modern" && (
            <Button size="sm" variant="ghost" className="btn-icon" title={state.dark ? "وضع فاتح للوحة" : "وضع داكن للوحة"} onClick={() => void toggleDark()}>
              <Icon name={state.dark ? "sun" : "moon"} />
            </Button>
          )}
          <Button size="sm" variant="ghost" className="btn-icon" title="فتح في المتصفح" onClick={() => void api.ums.openExternal()}>
            <Icon name="external" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="btn-icon"
            title="تسجيل الخروج ومسح الجلسة"
            onClick={async () => {
              if (await api.ums.clearSession()) toast("تم مسح جلسة UMS", "ok");
            }}
          >
            <Icon name="logout" />
          </Button>
        </div>
      </div>

      <div ref={hostRef} className="flex-1 relative min-h-0">
        {/* هنا تُرسم لوحة UMS من العملية الرئيسية. المحتوى أدناه يظهر فقط قبل التحميل أو عند الخطأ. */}
        <div className="absolute inset-0 flex items-center justify-center p-8" style={{ zIndex: 0 }}>
          {state?.error ? (
            <div className="panel p-6 max-w-md text-center pop">
              <div className="tool-icon mx-auto" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
                !
              </div>
              <h3 className="font-bold mb-1">تعذّر الوصول إلى لوحة UMS</h3>
              <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
                {state.error}
              </p>
              <div className="flex gap-2 justify-center">
                <Button variant="primary" onClick={() => void nav("reload")}>
                  إعادة المحاولة
                </Button>
                <Button onClick={() => void api.ums.openExternal()}>فتح في المتصفح</Button>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <img src={logoUrl} alt="" width={120} height={120} className="mx-auto mb-4 float" style={{ opacity: 0.85 }} />
              <div className="skeleton mx-auto mb-3" style={{ width: 240, height: 14 }} />
              <div className="skeleton mx-auto" style={{ width: 160, height: 14 }} />
              <p className="text-sm mt-4" style={{ color: "var(--muted)" }}>
                جارٍ تحميل نظام الجامعة الموحّد…
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
