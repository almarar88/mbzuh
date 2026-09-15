/** نقاط الالتصاق بالمنصة: تحليل HTML وفتح الروابط ومتغيرات البيئة. */

export interface Platform {
  /** يحوّل نص HTML إلى Document (linkedom في Electron، DOMParser في المتصفح/أندرويد). */
  parseHtml(html: string): Document;
  /** قيمة متغير بيئة إن وُجدت (Node فقط). */
  env(name: string): string | undefined;
  /** اسم المنصة للتسجيل والقرارات الصغيرة. */
  name: "electron" | "android" | "web";
}

let platform: Platform = {
  parseHtml: (html) => new DOMParser().parseFromString(html, "text/html"),
  env: () => undefined,
  name: "web",
};

export function setPlatform(p: Platform): void {
  platform = p;
}

export function getPlatform(): Platform {
  return platform;
}
