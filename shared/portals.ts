/** البوابات الجامعية المدمجة: تعريفها الافتراضي وأنواعها (مشترك بين سطح المكتب والجوال). */

export type PortalColor = "blue" | "coral" | "purple" | "lime" | "gold" | "slate";

export interface PortalConfig {
  id: string;
  name: string;
  url: string;
  color: PortalColor;
  /** حرف/رمز قصير يُعرض في البطاقة. */
  glyph: string;
  theme: "modern" | "original";
  dark: boolean;
  builtin: boolean;
  /** وصف قصير يظهر تحت الاسم. */
  hint?: string;
}

export interface PortalCredential {
  username: string;
  password: string;
  autofill: boolean;
  autoSubmit: boolean;
}

/**
 * سكربت التعبئة التلقائية لصفحات الدخول: يملأ حقل المستخدم/البريد وكلمة المرور
 * (يدعم صفحات مايكروسوفت ذات الخطوتين) ويضغط زر المتابعة اختياريًا.
 */
export function AUTOFILL_JS(username: string, password: string, autoSubmit: boolean): string {
  return `(() => {
  const u = ${JSON.stringify(username)}, p = ${JSON.stringify(password)}, auto = ${autoSubmit ? "true" : "false"};
  const vis = (el) => { const r = el.getBoundingClientRect(); const st = getComputedStyle(el); return r.width > 0 && r.height > 0 && st.visibility !== "hidden"; };
  const set = (el, v) => { const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value"); if (d && d.set) d.set.call(el, v); else el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); };
  const pw = [...document.querySelectorAll("input[type=password]")].find(vis);
  const userEl = [...document.querySelectorAll("input[type=email],input[type=text],input[type=tel],input:not([type])")].find((e) => vis(e) && /user|login|email|mail|name|id|account|رقم|اسم|بريد|مستخدم|loginfmt/i.test((e.name || "") + " " + (e.id || "") + " " + (e.placeholder || "") + " " + (e.getAttribute("aria-label") || "") + " " + (e.autocomplete || "")));
  let did = false;
  if (userEl && !userEl.value && u) { set(userEl, u); did = true; }
  if (pw && !pw.value && p) { set(pw, p); did = true; }
  if (did && auto) {
    const form = (pw || userEl) && (pw || userEl).form;
    const btn = (form && form.querySelector("button[type=submit],input[type=submit],button:not([type])")) || document.querySelector("#idSIButton9,#submitButton,button[type=submit],input[type=submit]");
    if (btn) setTimeout(() => btn.click(), 350);
  }
  return did;
})()`;
}

export interface PortalTabState {
  id: string;
  url: string;
  title: string;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  error: string | null;
  /** مشكلة في شهادة الأمان تمنع التحميل؛ يمكن للمستخدم الوثوق بها صراحةً. */
  certIssue: { host: string; fingerprint: string; issuer: string; error: string } | null;
  zoom: number;
}

/** يترجم أكواد أخطاء الشبكة في Chromium إلى رسائل عربية مفهومة. */
export function describeLoadError(code: number, desc: string): string {
  const map: Record<string, string> = {
    ERR_CERT_AUTHORITY_INVALID: "شهادة الأمان لهذا الموقع غير موثوقة على هذا الجهاز (جهة الإصدار غير معروفة).",
    ERR_CERT_COMMON_NAME_INVALID: "شهادة الأمان لا تطابق اسم الموقع.",
    ERR_CERT_DATE_INVALID: "شهادة الأمان منتهية الصلاحية أو تاريخ الجهاز غير صحيح.",
    ERR_NAME_NOT_RESOLVED: "تعذّر العثور على عنوان الموقع. إن كان الموقع داخليًا فتأكد من الاتصال بشبكة الجامعة أو VPN.",
    ERR_INTERNET_DISCONNECTED: "لا يوجد اتصال بالإنترنت.",
    ERR_CONNECTION_REFUSED: "الخادم رفض الاتصال.",
    ERR_CONNECTION_TIMED_OUT: "انتهت مهلة الاتصال بالموقع. قد يكون الموقع داخليًا ويتطلب شبكة الجامعة.",
    ERR_CONNECTION_RESET: "انقطع الاتصال بالموقع.",
    ERR_SSL_PROTOCOL_ERROR: "خطأ في بروتوكول الأمان مع الموقع.",
    ERR_PROXY_CONNECTION_FAILED: "تعذّر الاتصال عبر خادم البروكسي.",
    ERR_BLOCKED_BY_CLIENT: "حُظر الطلب على هذا الجهاز.",
  };
  return `${map[desc] ?? "تعذّر تحميل الصفحة."} (${desc} ${code})`;
}

export interface PortalsState {
  active: string | null;
  portals: PortalConfig[];
  tabs: PortalTabState[];
}

export const DEFAULT_PORTALS: PortalConfig[] = [
  {
    id: "ums",
    name: "نظام الجامعة الموحّد UMS",
    hint: "الطلبة، التسجيل، الشؤون الأكاديمية",
    url: "https://ums.mbzuh.ac.ae",
    color: "blue",
    glyph: "U",
    theme: "modern",
    dark: false,
    builtin: true,
  },
  {
    id: "cec",
    name: "لوحة الدورات — Hub",
    hint: "إدارة دورات مركز التعليم المستمر",
    url: "https://hub.mbzuh.ac.ae/cecadmin?records=10&page=0",
    color: "purple",
    glyph: "H",
    theme: "modern",
    dark: false,
    builtin: true,
  },
  {
    id: "outlook",
    name: "البريد — Outlook",
    hint: "المهام والمراسلات تصل هنا",
    url: "https://outlook.office.com/mail/",
    color: "coral",
    glyph: "O",
    theme: "original",
    dark: false,
    builtin: true,
  },
  {
    id: "teams",
    name: "Microsoft Teams",
    hint: "الاجتماعات ومواعيدها والمحادثات",
    url: "https://teams.microsoft.com/v2/",
    color: "slate",
    glyph: "T",
    theme: "original",
    dark: false,
    builtin: true,
  },
  {
    id: "sharepoint",
    name: "بوابة الملفات — SharePoint",
    hint: "حفظ الملفات واستخراج المعلومات منها",
    url: "https://mbzuh.sharepoint.com/sites/MBZUHPortal/SitePages/ar/OrganizationHome.aspx",
    color: "lime",
    glyph: "S",
    theme: "original",
    dark: false,
    builtin: true,
  },
  {
    id: "onehub",
    name: "OneHub الحكومي",
    hint: "الإجازات والخدمات الحكومية للموظف",
    url: "https://onehub.gov.ae/",
    color: "gold",
    glyph: "1",
    theme: "original",
    dark: false,
    builtin: true,
  },
  {
    id: "site",
    name: "موقع الجامعة",
    hint: "الأخبار والتعاميم والفعاليات",
    url: "https://mbzuh.ac.ae/ar",
    color: "slate",
    glyph: "M",
    theme: "original",
    dark: false,
    builtin: true,
  },
];

/** يدمج البوابات المحفوظة مع أي بوابات افتراضية جديدة أُضيفت في إصدار لاحق. */
export function mergeWithDefaults(list: PortalConfig[]): PortalConfig[] {
  const ids = new Set(list.map((p) => p.id));
  const missing = DEFAULT_PORTALS.filter((p) => !ids.has(p.id) && !list.some((x) => x.id === `removed:${p.id}`));
  return [...list, ...missing];
}

export function parsePortals(raw: string | null | undefined): PortalConfig[] {
  if (!raw) return DEFAULT_PORTALS;
  try {
    const list = JSON.parse(raw) as PortalConfig[];
    if (!Array.isArray(list) || list.length === 0) return DEFAULT_PORTALS;
    return mergeWithDefaults(list
      .filter((p) => p && typeof p.id === "string" && typeof p.url === "string")
      .map((p) => ({
        id: p.id,
        name: p.name || p.url,
        hint: p.hint,
        url: p.url,
        color: p.color ?? "slate",
        glyph: (p.glyph || p.name || "•").slice(0, 1).toUpperCase(),
        theme: p.theme === "original" ? "original" : "modern",
        dark: !!p.dark,
        builtin: !!p.builtin,
      })));
  } catch {
    return DEFAULT_PORTALS;
  }
}

export function normalizeUrl(url: string): string {
  const clean = url.trim();
  return /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
}

/** النطاق القابل للتسجيل تقريبيًا (يراعي اللواحق المركّبة مثل gov.ae وac.ae وco.uk). */
export function rootDomain(host: string): string {
  const parts = host.toLowerCase().split(".");
  if (parts.length <= 2) return parts.join(".");
  const second = parts[parts.length - 2];
  const tld = parts[parts.length - 1];
  const composite = ["gov", "ac", "co", "com", "org", "net", "edu", "sch"].includes(second) && tld.length === 2;
  return parts.slice(composite ? -3 : -2).join(".");
}

/** نطاقات تسجيل الدخول الموحّد والخدمات المصاحبة التي يجب أن تبقى داخل البوابة. */
const SSO_DOMAINS = [
  "microsoftonline.com", "microsoft.com", "live.com", "office.com", "office.net", "office365.com", "sharepoint.com",
  "cloud.microsoft", "msauth.net", "msftauth.net", "microsoftonline-p.com", "windows.net", "azureedge.net",
  "uaepass.ae", "gov.ae", "mbzuh.ac.ae", "skype.com", "onenote.com", "sharepointonline.com", "svc.ms", "outlook.com",
];

/** هل الرابط ضمن نطاق البوابة أو مزوّدي تسجيل الدخول (يبقى داخل البوابة)؟ */
export function isPortalInternalUrl(url: string, homeUrl: string): boolean {
  try {
    const home = new URL(normalizeUrl(homeUrl));
    const host = new URL(url).hostname.toLowerCase();
    if (host === home.hostname.toLowerCase()) return true;
    const root = rootDomain(host);
    if (root === rootDomain(home.hostname)) return true;
    return SSO_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

export const PORTAL_COLORS: Record<PortalColor, { bg: string; ink: string; label: string }> = {
  blue: { bg: "#bcd4f8", ink: "#16243f", label: "أزرق" },
  coral: { bg: "#ff8f84", ink: "#3b120e", label: "مرجاني" },
  purple: { bg: "#b83cf0", ink: "#ffffff", label: "بنفسجي" },
  lime: { bg: "#d7f5a6", ink: "#1f3516", label: "ليموني" },
  gold: { bg: "#e8c874", ink: "#3a2a08", label: "ذهبي" },
  slate: { bg: "#c9d1de", ink: "#1b2230", label: "رمادي" },
};
