/**
 * جسر الأندرويد (AndroidBridge عبر addJavascriptInterface) مع بدائل للمتصفح العادي،
 * حتى يعمل التطبيق نفسه داخل WebView أندرويد أو في متصفح للاختبار.
 */

export interface AndroidBridge {
  openExternal(url: string): void;
  openPortal(url: string, title: string, css: string, darkCss: string, dark: boolean, internalHosts: string): void;
  clearPortalSession(): void;
  saveFile(name: string, mime: string, base64: string): void;
  openFile(name: string, mime: string, base64: string): void;
  printHtml(html: string, jobName: string): void;
  toast(message: string): void;
  getInfo(): string;
}

declare global {
  interface Window {
    AndroidBridge?: AndroidBridge;
    __mbzuhPosture?: (json: { posture: "flat" | "tabletop" | "book"; top?: number; bottom?: number; left?: number; right?: number }) => void;
  }
}

export const isAndroid = (): boolean => typeof window !== "undefined" && !!window.AndroidBridge;

function toBase64(bytes: Uint8Array): string {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(s);
}

export function mimeFor(name: string): string {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  return (
    {
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      xls: "application/vnd.ms-excel",
      csv: "text/csv",
      pdf: "application/pdf",
      txt: "text/plain",
      db: "application/octet-stream",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      html: "text/html",
    }[ext] ?? "application/octet-stream"
  );
}

/** يحفظ ملفًا في تنزيلات الجهاز (أندرويد) أو ينزّله في المتصفح. */
export function nativeSaveFile(name: string, bytes: Uint8Array): void {
  if (window.AndroidBridge) {
    window.AndroidBridge.saveFile(name, mimeFor(name), toBase64(bytes));
    return;
  }
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mimeFor(name) }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function nativeOpenFile(name: string, bytes: Uint8Array): void {
  if (window.AndroidBridge) {
    window.AndroidBridge.openFile(name, mimeFor(name), toBase64(bytes));
    return;
  }
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mimeFor(name) }));
  window.open(url, "_blank");
}

export function nativeOpenExternal(url: string): void {
  if (window.AndroidBridge) window.AndroidBridge.openExternal(url);
  else window.open(url, "_blank", "noopener");
}

export function nativeToast(message: string): void {
  if (window.AndroidBridge) window.AndroidBridge.toast(message);
}

/** يفتح منتقي ملفات المتصفح/الأندرويد ويعيد الملف المختار. */
export function pickFile(accept?: string): Promise<{ name: string; bytes: Uint8Array } | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    if (accept) input.accept = accept;
    input.style.display = "none";
    document.body.appendChild(input);
    let done = false;
    const finish = (v: { name: string; bytes: Uint8Array } | null) => {
      if (done) return;
      done = true;
      input.remove();
      resolve(v);
    };
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return finish(null);
      finish({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) });
    };
    // إلغاء المنتقي بلا اختيار
    window.addEventListener("focus", () => setTimeout(() => finish(null), 800), { once: true });
    input.click();
  });
}
