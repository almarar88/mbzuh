/**
 * أدوات المساعد الذكي للتحكم في البوابات الجامعية (UMS، Hub، Outlook، Teams، SharePoint،
 * OneHub…): فتح البوابة، انتظار التحميل، قراءة الصفحة (نص، عناوين، جداول، روابط، أزرار،
 * حقول، عناصر القوائم مثل رسائل البريد)، التنقّل، النقر، التعبئة، التمرير، ولقطة للصفحة.
 *
 * الأدوات لا تعرف شيئًا عن Electron أو أندرويد: تعمل عبر «سائق بوابات» (PortalDriver)
 * يوفّره سطح المكتب (WebContentsView) أو الجوال (WebView أصلي عبر الجسر).
 */
import type { AiSettings } from "../../shared/types";
import type { PortalsState } from "../../shared/portals";
import type { ToolDef } from "./ai";

export interface PortalDriver {
  state(): PortalsState;
  /** يفعّل البوابة (ويفتحها إن لم تكن مفتوحة). */
  open(id: string): Promise<PortalsState> | PortalsState;
  loadUrl(url: string): Promise<void>;
  navigate(action: "back" | "reload" | "home"): unknown;
  /** ينفّذ JavaScript في البوابة النشطة ويعيد الناتج (JSON). */
  evaluate<T>(code: string): Promise<T>;
  /** لقطة للبوابة النشطة (JPEG مضغوط). */
  capture(): Promise<{ jpeg: string; width: number; height: number }>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** يفشل بعد مهلة بدل التعليق (مثلًا عندما تعرض الصفحة alert أو تكون غير مستجيبة). */
export function withTimeout<T>(p: Promise<T>, ms: number, what = "العملية"): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    p.finally(() => clearTimeout(timer)),
    new Promise<T>((_r, reject) => {
      timer = setTimeout(() => reject(new Error(`${what} لم تكتمل خلال ${Math.round(ms / 1000)} ثانية — الصفحة قد تكون غير مستجيبة أو تعرض نافذة تنبيه.`)), ms);
    }),
  ]);
}

const LOGIN_RE = `/login\\.microsoftonline|login\\.live|id\\.mbzuh|uaepass|\\/login|signin/i`;
export const LOGIN_PROBE_JS = `({ url: location.href, title: document.title, loginPage: ${LOGIN_RE}.test(location.href) || !!document.querySelector("input[type=password]") })`;

function readPageJs(selector: string | null, maxChars: number): string {
  const scope = selector ? `document.querySelector(${JSON.stringify(selector)}) || document.body` : "document.body";
  return `
(() => {
  const root = ${scope};
  const clean = (s) => (s || "").replace(/\\s+/g, " ").trim();
  const visible = (el) => { try { const r = el.getBoundingClientRect(); const st = getComputedStyle(el); return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none"; } catch { return false; } };
  const q = (sel) => [...root.querySelectorAll(sel)].filter(visible);
  const label = (el) => clean(el.getAttribute("aria-label") || el.title || el.innerText || el.value || "");
  const loginPage = ${LOGIN_RE}.test(location.href) || !!document.querySelector("input[type=password]");
  const links = q("a[href]").slice(0, 80).map((a, i) => ({ i, text: clean(a.innerText || a.getAttribute("aria-label")).slice(0, 80), href: a.href }));
  const buttons = q("button, input[type=submit], input[type=button], [role=button], [role=tab], [role=menuitem]").slice(0, 80).map((b, i) => ({ i, text: label(b).slice(0, 80), id: b.id || null }));
  const fields = q("input:not([type=hidden]), select, textarea, [contenteditable=true], [role=textbox], [role=searchbox], [role=combobox]").slice(0, 60).map((f, i) => ({
    i, tag: f.tagName.toLowerCase(), type: f.type || f.getAttribute("role") || null, name: f.name || null, id: f.id || null, placeholder: f.placeholder || f.getAttribute("aria-placeholder") || null,
    label: clean((f.labels && f.labels[0] && f.labels[0].innerText) || f.getAttribute("aria-label") || ""), value: f.type === "password" ? "***" : clean(f.value || f.innerText || "").slice(0, 80),
    options: f.tagName === "SELECT" ? [...f.options].slice(0, 30).map((o) => o.text) : undefined,
  }));
  const headings = q("h1,h2,h3").slice(0, 30).map((h) => clean(h.innerText)).filter(Boolean);
  const tables = q("table, [role=grid], [role=table]").slice(0, 6).map((t) => [...t.querySelectorAll("tr, [role=row]")].slice(0, 60).map((tr) => [...tr.querySelectorAll("th, td, [role=cell], [role=gridcell], [role=columnheader]")].map((c) => clean(c.innerText).slice(0, 80))).filter((r) => r.length));
  // عناصر القوائم (رسائل البريد، الاجتماعات، الملفات، نتائج البحث…)
  const items = q("[role=option], [role=listitem], [role=treeitem], article, [role=article], [data-convid], .ms-List-cell").slice(0, 80).map((el, i) => ({ i, text: (label(el) || clean(el.innerText)).slice(0, 300) })).filter((x) => x.text);
  const main = root.querySelector("[role=main], main") || root;
  const text = clean(main.innerText || root.innerText).slice(0, ${maxChars});
  return { url: location.href, title: document.title, loginPage, readyState: document.readyState, textLength: (root.innerText || "").length, headings, text, items, tables, links, buttons, fields };
})()`;
}

function findAndAct(kind: "click" | "fill", target: string, value?: string): string {
  const t = JSON.stringify(target);
  const v = JSON.stringify(value ?? "");
  return `
(() => {
  const target = ${t};
  const clean = (s) => (s || "").replace(/\\s+/g, " ").trim().toLowerCase();
  const visible = (el) => { try { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; } catch { return false; } };
  let el = null;
  try { el = document.querySelector(target); } catch {}
  if (el && !visible(el)) el = null;
  if (!el && /^#/.test(target)) el = document.getElementById(target.slice(1));
  if (!el) {
    const pool = ${
      kind === "click"
        ? '[...document.querySelectorAll("a, button, input[type=submit], input[type=button], [role=button], [role=tab], [role=menuitem], [role=option], [role=listitem], [role=treeitem], [role=link], li, td, label, span, div, article")]'
        : '[...document.querySelectorAll("input:not([type=hidden]), select, textarea, [contenteditable=true], [role=textbox], [role=searchbox], [role=combobox]")]'
    };
    const want = clean(target);
    const score = (e) => {
      const txt = clean(${kind === "click" ? "e.getAttribute('aria-label') || e.innerText || e.value || e.title" : "(e.labels && e.labels[0] && e.labels[0].innerText) || e.placeholder || e.getAttribute('aria-placeholder') || e.getAttribute('aria-label') || e.name || e.id"});
      if (!txt) return 0;
      if (txt === want) return 4;
      if (txt.startsWith(want)) return 3;
      if (txt.includes(want)) return 2;
      const words = want.split(" ").filter((w) => w.length > 2);
      if (words.length > 1 && words.every((w) => txt.includes(w))) return 1;
      return 0;
    };
    const ranked = pool.filter(visible).map((e) => [score(e), e]).filter(([s]) => s > 0)
      .sort((a, b) => b[0] - a[0] || (a[1].innerText || "").length - (b[1].innerText || "").length);
    el = ranked.length ? ranked[0][1] : null;
  }
  if (!el) return { ok: false, message: "لم يُعثر على عنصر مطابق: " + target + " — اقرأ الصفحة لمعرفة النصوص المتاحة" };
  el.scrollIntoView({ block: "center" });
  ${
    kind === "click"
      ? `try { el.focus && el.focus(); } catch {}
         const r = el.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
         for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) { try { el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: cx, clientY: cy, view: window })); } catch {} }
         return { ok: true, clicked: ((el.getAttribute("aria-label") || el.innerText || el.value || el.tagName) + "").trim().slice(0, 100) };`
      : `const isEditable = el.isContentEditable || el.getAttribute("role") === "textbox" && el.tagName !== "INPUT" && el.tagName !== "TEXTAREA";
         el.focus();
         if (el.tagName === "SELECT") { const opt = [...el.options].find((o) => clean(o.text) === clean(${v}) || clean(o.value) === clean(${v}) || clean(o.text).includes(clean(${v}))); if (opt) el.value = opt.value; else return { ok: false, message: "لا يوجد خيار مطابق" }; }
         else if (isEditable) { document.execCommand("selectAll", false, null); document.execCommand("insertText", false, ${v}); }
         else { const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; const setter = Object.getOwnPropertyDescriptor(proto, "value"); if (setter && setter.set) setter.set.call(el, ${v}); else el.value = ${v}; }
         el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true }));
         return { ok: true, field: el.name || el.id || el.placeholder || el.getAttribute("aria-label") || el.tagName, value: clean(el.value || el.innerText || "").slice(0, 80) };`
  }
})()`;
}

const PRESS_ENTER_JS = `(() => { const el = document.activeElement; if (!el) return false;
  for (const t of ["keydown", "keypress", "keyup"]) el.dispatchEvent(new KeyboardEvent(t, { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
  const f = el.form; if (f) { try { f.requestSubmit ? f.requestSubmit() : f.submit(); } catch {} }
  return true; })()`;

/** إجراءات حسّاسة داخل الصفحات تتطلب موافقة المستخدم دائمًا (إرسال، حذف، اعتماد، دفع…). */
const SENSITIVE_RE = /\b(send|submit|delete|remove|approve|reject|pay|purchase|confirm|sign)\b|إرسال|أرسل|حذف|احذف|اعتماد|اعتمد|رفض|دفع|تأكيد|توقيع|إلغاء الاشتراك/i;

export function portalTools(driver: PortalDriver): ToolDef[] {
  const evaluate = <T,>(js: string) => withTimeout(driver.evaluate<T>(js), 20_000, "قراءة الصفحة");

  /** ينتظر اكتمال التحميل واستقرار المحتوى (حتى ~8 ثوانٍ). */
  async function waitForContent(minChars = 200, timeoutMs = 8000): Promise<void> {
    const start = Date.now();
    let lastLen = -1;
    let stable = 0;
    while (Date.now() - start < timeoutMs) {
      try {
        const info = await evaluate<{ ready: string; len: number }>(`({ ready: document.readyState, len: (document.body && document.body.innerText || "").length })`);
        if (info.ready === "complete" && info.len >= minChars) {
          if (info.len === lastLen) stable++;
          else stable = 0;
          lastLen = info.len;
          if (stable >= 2) return;
        }
      } catch {
        /* الصفحة تنتقل */
      }
      await sleep(500);
    }
  }

  const gui = (label: string) => (_i: Record<string, unknown>, s: AiSettings) => (s.confirmGui ? label : null);

  return [
    {
      label: "قائمة البوابات",
      tool: {
        name: "portal_list",
        description: "يعيد البوابات الجامعية المدمجة في التطبيق (ums, cec, outlook, teams, sharepoint, onehub, site…) والبوابة المفتوحة حاليًا وصفحتها. استخدمها قبل التعامل مع أي نظام جامعي.",
        input_schema: { type: "object", properties: {}, additionalProperties: false },
      },
      run: () => {
        const s = driver.state();
        return { active: s.active, portals: s.portals.map((p) => ({ id: p.id, name: p.name, url: p.url, hint: p.hint })), openTabs: s.tabs.map((t) => ({ id: t.id, url: t.url, title: t.title, error: t.error })) };
      },
    },
    {
      label: "فتح بوابة",
      tool: {
        name: "portal_open",
        description: "يفتح بوابة بمعرّفها داخل التطبيق ويجعلها نشطة وينتظر تحميلها. البوابات المفتوحة سابقًا تبقى محمّلة بجلستها. إن كانت الصفحة تطلب تسجيل الدخول اطلب من المستخدم إتمامه من صفحة «البوابات» ثم تابع.",
        input_schema: { type: "object", properties: { id: { type: "string" }, url: { type: "string", description: "رابط اختياري داخل نطاق البوابة يُفتح مباشرة" } }, required: ["id"], additionalProperties: false },
      },
      run: async (input) => {
        const s = await driver.open(String(input.id ?? ""));
        if (typeof input.url === "string" && input.url.trim()) await driver.loadUrl(input.url.trim());
        await waitForContent();
        const info = await evaluate<{ url: string; title: string; loginPage: boolean }>(LOGIN_PROBE_JS);
        const tab = s.tabs.find((t) => t.id === s.active);
        return { ok: !tab?.error, active: s.active, error: tab?.error ?? undefined, ...info, hint: info.loginPage ? "الصفحة تطلب تسجيل الدخول — اطلب من المستخدم الدخول ثم أعد المحاولة." : undefined };
      },
    },
    {
      label: "قراءة صفحة البوابة",
      tool: {
        name: "portal_read_page",
        description:
          "يقرأ الصفحة النشطة في البوابة بعد انتظار تحميلها: العنوان، النص الرئيسي، العناوين، عناصر القوائم (items: رسائل البريد، الاجتماعات، الملفات، النتائج)، الجداول، الروابط، الأزرار، وحقول الإدخال. يمكن تحديد منطقة بمحدد CSS (مثل [role=main]) وعدد الأحرف.",
        input_schema: {
          type: "object",
          properties: {
            selector: { type: "string", description: "محدد CSS لقراءة جزء من الصفحة فقط" },
            max_chars: { type: "integer", minimum: 500, maximum: 40000, description: "حد أقصى لطول النص (افتراضي 12000)" },
            wait_ms: { type: "integer", minimum: 0, maximum: 15000, description: "انتظار إضافي قبل القراءة" },
          },
          additionalProperties: false,
        },
      },
      run: async (input) => {
        if (input.wait_ms) await sleep(Number(input.wait_ms));
        await waitForContent();
        const selector = typeof input.selector === "string" && input.selector.trim() ? input.selector.trim() : null;
        const max = Math.min(40000, Math.max(500, Number(input.max_chars ?? 12000)));
        let result = await evaluate<{ textLength: number }>(readPageJs(selector, max));
        if (result.textLength < 200) {
          await sleep(2500);
          result = await evaluate(readPageJs(selector, max));
        }
        return result;
      },
    },
    {
      label: "الانتقال داخل البوابة",
      tool: {
        name: "portal_navigate",
        description: "ينتقل إلى رابط داخل نطاق البوابة النشطة (مثل https://outlook.office.com/mail/inbox أو /calendar/view/day) أو back/reload/home، وينتظر التحميل.",
        input_schema: {
          type: "object",
          properties: { url: { type: "string" }, action: { type: "string", enum: ["url", "back", "reload", "home"] } },
          additionalProperties: false,
        },
      },
      run: async (input) => {
        const action = String(input.action ?? "url");
        if (action === "url") await driver.loadUrl(String(input.url ?? ""));
        else await driver.navigate(action as "back" | "reload" | "home");
        await waitForContent();
        const s = driver.state();
        return s.tabs.find((t) => t.id === s.active) ?? (await evaluate(LOGIN_PROBE_JS));
      },
    },
    {
      label: "نقر في البوابة",
      tool: {
        name: "portal_click",
        description: "ينقر على عنصر في الصفحة النشطة بنصه الظاهر أو تسميته (aria-label) — مثل موضوع رسالة، اسم ملف، «التالي»، «Inbox» — أو بمحدد CSS. ينتظر بعد النقر ليتغيّر المحتوى. أزرار الإرسال/الحذف/الاعتماد تتطلب موافقة المستخدم.",
        input_schema: { type: "object", properties: { target: { type: "string" }, wait_ms: { type: "integer", minimum: 0, maximum: 10000 } }, required: ["target"], additionalProperties: false },
      },
      approval: (i, s) => {
        const target = String(i.target ?? "");
        if (SENSITIVE_RE.test(target)) return `نقر على «${target}» — إجراء حسّاس (إرسال/حذف/اعتماد) داخل البوابة`;
        return s.confirmGui ? `نقر على «${target}» داخل البوابة` : null;
      },
      run: async (input) => {
        const r = await evaluate<{ ok: boolean; message?: string }>(findAndAct("click", String(input.target ?? "")));
        await sleep(Number(input.wait_ms ?? 1200));
        await waitForContent(50, 4000);
        return r;
      },
    },
    {
      label: "تعبئة حقل في البوابة",
      tool: {
        name: "portal_fill",
        description: "يعبّئ حقل إدخال (أو محرر نص/مربع بحث/نص رسالة) أو يختار من قائمة في الصفحة النشطة، بتحديد الحقل بعنوانه/placeholder/aria-label أو بمحدد CSS، مع خيار ضغط Enter. لا تستخدمه لكلمات المرور.",
        input_schema: {
          type: "object",
          properties: { target: { type: "string" }, value: { type: "string" }, press_enter: { type: "boolean" } },
          required: ["target", "value"],
          additionalProperties: false,
        },
      },
      approval: gui("تعبئة حقل داخل البوابة"),
      run: async (input) => {
        const r = await evaluate<{ ok: boolean; message?: string }>(findAndAct("fill", String(input.target ?? ""), String(input.value ?? "")));
        if (r.ok && input.press_enter) {
          await evaluate(PRESS_ENTER_JS);
          await sleep(1200);
          await waitForContent(50, 5000);
        }
        return r;
      },
    },
    {
      label: "تمرير الصفحة",
      tool: {
        name: "portal_scroll",
        description: "يمرّر الصفحة النشطة (أو أول عنصر قابل للتمرير مثل قائمة الرسائل) للأسفل/الأعلى لتحميل مزيد من العناصر، ثم يعيد عدد الأحرف الجديد.",
        input_schema: {
          type: "object",
          properties: { direction: { type: "string", enum: ["down", "up", "top", "bottom"] }, selector: { type: "string" } },
          additionalProperties: false,
        },
      },
      run: async (input) => {
        const dir = String(input.direction ?? "down");
        const sel = typeof input.selector === "string" ? input.selector : "";
        const js = `(() => {
          const sel = ${JSON.stringify(sel)};
          let el = sel ? document.querySelector(sel) : null;
          if (!el) { const cands = [...document.querySelectorAll("*")].filter((e) => { const st = getComputedStyle(e); return /(auto|scroll)/.test(st.overflowY) && e.scrollHeight > e.clientHeight + 40 && e.clientHeight > 200; }); el = cands.sort((a, b) => b.clientHeight * b.clientWidth - a.clientHeight * a.clientWidth)[0] || document.scrollingElement; }
          const h = el.clientHeight || window.innerHeight;
          if ("${dir}" === "top") el.scrollTop = 0; else if ("${dir}" === "bottom") el.scrollTop = el.scrollHeight; else el.scrollTop += ("${dir}" === "up" ? -1 : 1) * h * 0.85;
          return { scrolled: el.tagName + (el.id ? "#" + el.id : ""), top: el.scrollTop, height: el.scrollHeight };
        })()`;
        const r = await evaluate<Record<string, unknown>>(js);
        await sleep(900);
        const len = await evaluate<number>(`(document.body.innerText || "").length`);
        return { ...r, textLength: len };
      },
    },
    {
      label: "لقطة للبوابة",
      tool: {
        name: "portal_screenshot",
        description: "يلتقط صورة للصفحة النشطة في البوابة ويعيدها لك لتراها (مفيد عندما تكون القراءة النصية غير كافية).",
        input_schema: { type: "object", properties: {}, additionalProperties: false },
      },
      run: async () => {
        const shot = await withTimeout(driver.capture(), 20_000, "لقطة البوابة");
        return {
          __blocks: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: shot.jpeg } },
            { type: "text", text: `لقطة البوابة ${shot.width}×${shot.height}` },
          ],
          __preview: `data:image/jpeg;base64,${shot.jpeg}`,
        };
      },
      preview: (_i, out) => (out as { __preview?: string })?.__preview ?? null,
    },
  ];
}
