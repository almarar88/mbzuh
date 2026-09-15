/** معلومات بيئة التشغيل للواجهة: سطح مكتب (Electron) أم جوال/متصفح. */

export function isMobileRuntime(): boolean {
  return typeof window !== "undefined" && (window as unknown as { __MBZUH_MOBILE__?: boolean }).__MBZUH_MOBILE__ === true;
}

export function isAndroidRuntime(): boolean {
  return typeof window !== "undefined" && !!(window as unknown as { AndroidBridge?: unknown }).AndroidBridge;
}

export type Posture = { posture: "flat" | "tabletop" | "book"; top?: number; bottom?: number; left?: number; right?: number };

/** يستقبل وضعية هاتف الطي من الطبقة الأصلية ويعكسها على CSS. */
export function installPostureBridge(): void {
  if (typeof window === "undefined") return;
  window.__mbzuhPosture = (p: Posture) => {
    const root = document.documentElement;
    root.dataset.posture = p.posture;
    root.style.setProperty("--hinge-top", p.top ? `${p.top}px` : "100vh");
    root.style.setProperty("--hinge-bottom", p.bottom ? `${p.bottom}px` : "100vh");
    root.style.setProperty("--hinge-left", p.left ? `${p.left}px` : "0px");
    window.dispatchEvent(new CustomEvent("mbzuh:posture", { detail: p }));
  };
}
