/**
 * أدوات المساعد الذكي للتحكم في البوابات الجامعية المدمجة (UMS، Hub…):
 * قراءة الصفحة النشطة، التنقّل، النقر على عناصر، تعبئة الحقول، ولقطة للصفحة.
 * تعمل داخل WebContentsView عبر executeJavaScript دون التحكم في نظام التشغيل.
 */
import type { AiSettings } from "../../shared/types";
import { portals } from "./portals";
import type { ToolDef } from "./ai";

const READ_PAGE_JS = `
(() => {
  const clean = (s) => (s || "").replace(/\\s+/g, " ").trim();
  const visible = (el) => { const r = el.getBoundingClientRect(); const st = getComputedStyle(el); return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none"; };
  const links = [...document.querySelectorAll("a[href]")].filter(visible).slice(0, 80).map((a, i) => ({ i, text: clean(a.innerText).slice(0, 80), href: a.href }));
  const buttons = [...document.querySelectorAll("button, input[type=submit], input[type=button], [role=button]")].filter(visible).slice(0, 60).map((b, i) => ({ i, text: clean(b.innerText || b.value || b.getAttribute("aria-label") || b.title).slice(0, 80), id: b.id || null }));
  const fields = [...document.querySelectorAll("input:not([type=hidden]), select, textarea")].filter(visible).slice(0, 60).map((f, i) => ({
    i, tag: f.tagName.toLowerCase(), type: f.type || null, name: f.name || null, id: f.id || null, placeholder: f.placeholder || null,
    label: clean((f.labels && f.labels[0] && f.labels[0].innerText) || f.getAttribute("aria-label") || ""), value: f.type === "password" ? "***" : String(f.value || "").slice(0, 80),
    options: f.tagName === "SELECT" ? [...f.options].slice(0, 30).map((o) => o.text) : undefined,
  }));
  const headings = [...document.querySelectorAll("h1,h2,h3")].filter(visible).slice(0, 30).map((h) => clean(h.innerText));
  const tables = [...document.querySelectorAll("table")].filter(visible).slice(0, 5).map((t) => [...t.querySelectorAll("tr")].slice(0, 40).map((tr) => [...tr.querySelectorAll("th,td")].map((c) => clean(c.innerText).slice(0, 60))));
  return { url: location.href, title: document.title, headings, text: clean(document.body.innerText).slice(0, 12000), links, buttons, fields, tables };
})()`;

function findAndAct(kind: "click" | "fill", target: string, value?: string): string {
  const t = JSON.stringify(target);
  const v = JSON.stringify(value ?? "");
  return `
(() => {
  const target = ${t};
  const clean = (s) => (s || "").replace(/\\s+/g, " ").trim().toLowerCase();
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  let el = null;
  try { el = document.querySelector(target); } catch {}
  if (!el && /^#/.test(target)) el = document.getElementById(target.slice(1));
  if (!el) {
    const pool = ${kind === "click" ? '[...document.querySelectorAll("a, button, input[type=submit], input[type=button], [role=button], [role=tab], [role=menuitem], li, td, label, span, div")]' : '[...document.querySelectorAll("input:not([type=hidden]), select, textarea")]'};
    const want = clean(target);
    const score = (e) => {
      const txt = clean(${kind === "click" ? "e.innerText || e.value || e.getAttribute('aria-label') || e.title" : "(e.labels && e.labels[0] && e.labels[0].innerText) || e.placeholder || e.name || e.id || e.getAttribute('aria-label')"});
      if (!txt) return 0;
      if (txt === want) return 3;
      if (txt.startsWith(want) || txt.endsWith(want)) return 2;
      if (txt.includes(want)) return 1;
      return 0;
    };
    const ranked = pool.filter(visible).map((e) => [score(e), e]).filter(([s]) => s > 0).sort((a, b) => b[0] - a[0] || a[1].innerText.length - b[1].innerText.length);
    el = ranked.length ? ranked[0][1] : null;
  }
  if (!el) return { ok: false, message: "لم يُعثر على عنصر مطابق: " + target };
  el.scrollIntoView({ block: "center" });
  ${
    kind === "click"
      ? `el.focus && el.focus(); el.click(); return { ok: true, clicked: (el.innerText || el.value || el.tagName).trim().slice(0, 80) };`
      : `const setter = Object.getOwnPropertyDescriptor(el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : el.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype, "value");
         el.focus();
         if (el.tagName === "SELECT") { const opt = [...el.options].find((o) => clean(o.text) === clean(${v}) || clean(o.value) === clean(${v}) || clean(o.text).includes(clean(${v}))); if (opt) el.value = opt.value; else return { ok: false, message: "لا يوجد خيار مطابق" }; }
         else if (setter && setter.set) setter.set.call(el, ${v}); else el.value = ${v};
         el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true }));
         return { ok: true, field: el.name || el.id || el.placeholder || el.tagName, value: String(el.value).slice(0, 80) };`
  }
})()`;
}

export function portalTools(): ToolDef[] {
  const gui = (label: string) => (_i: Record<string, unknown>, s: AiSettings) => (s.confirmGui ? label : null);
  return [
    {
      label: "قائمة البوابات",
      tool: {
        name: "portal_list",
        description: "يعيد البوابات الجامعية المدمجة في التطبيق (UMS، لوحة الدورات Hub، …) والبوابة المفتوحة حاليًا. استخدمها قبل التعامل مع أي نظام جامعي.",
        input_schema: { type: "object", properties: {}, additionalProperties: false },
      },
      run: () => {
        const s = portals.state();
        return { active: s.active, portals: s.portals.map((p) => ({ id: p.id, name: p.name, url: p.url, hint: p.hint })), openTabs: s.tabs };
      },
    },
    {
      label: "فتح بوابة",
      tool: {
        name: "portal_open",
        description: "يفتح بوابة جامعية بمعرّفها داخل التطبيق ويجعلها نشطة (يجب أن يكون المستخدم على صفحة «البوابات» ليراها). إن كانت تحتاج تسجيل دخول اطلب من المستخدم الدخول ثم تابع.",
        input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: false },
      },
      run: async (input) => {
        const s = portals.open(String(input.id ?? ""));
        await new Promise((r) => setTimeout(r, 1500));
        return { ok: true, active: s.active, tab: s.tabs.find((t) => t.id === s.active) };
      },
    },
    {
      label: "قراءة صفحة البوابة",
      tool: {
        name: "portal_read_page",
        description: "يقرأ محتوى الصفحة النشطة في البوابة: العنوان، النص، العناوين، الجداول، الروابط، الأزرار، وحقول الإدخال. استخدمه لجلب المعلومات أو لمعرفة ما يمكن النقر عليه.",
        input_schema: { type: "object", properties: {}, additionalProperties: false },
      },
      run: () => portals.evaluate(READ_PAGE_JS),
    },
    {
      label: "الانتقال داخل البوابة",
      tool: {
        name: "portal_navigate",
        description: "ينتقل إلى رابط داخل نطاق البوابة النشطة (أو back/reload).",
        input_schema: {
          type: "object",
          properties: { url: { type: "string" }, action: { type: "string", enum: ["url", "back", "reload", "home"] } },
          additionalProperties: false,
        },
      },
      run: async (input) => {
        const action = String(input.action ?? "url");
        if (action === "url") await portals.loadUrl(String(input.url ?? ""));
        else portals.navigate(action as "back" | "reload" | "home");
        await new Promise((r) => setTimeout(r, 1200));
        const s = portals.state();
        return s.tabs.find((t) => t.id === s.active);
      },
    },
    {
      label: "نقر في البوابة",
      tool: {
        name: "portal_click",
        description: "ينقر على عنصر في الصفحة النشطة بنصه الظاهر (مثل «تسجيل الدخول» أو «التالي») أو بمحدد CSS.",
        input_schema: { type: "object", properties: { target: { type: "string" } }, required: ["target"], additionalProperties: false },
      },
      approval: gui("نقر داخل البوابة"),
      run: async (input) => {
        const r = await portals.evaluate<{ ok: boolean; message?: string }>(findAndAct("click", String(input.target ?? "")));
        await new Promise((res) => setTimeout(res, 900));
        return r;
      },
    },
    {
      label: "تعبئة حقل في البوابة",
      tool: {
        name: "portal_fill",
        description: "يعبّئ حقل إدخال أو يختار من قائمة في الصفحة النشطة، بتحديد الحقل بعنوانه/placeholder/name أو بمحدد CSS. لا تستخدمه لكلمات المرور.",
        input_schema: {
          type: "object",
          properties: { target: { type: "string" }, value: { type: "string" }, press_enter: { type: "boolean" } },
          required: ["target", "value"],
          additionalProperties: false,
        },
      },
      approval: gui("تعبئة حقل داخل البوابة"),
      run: async (input) => {
        const r = await portals.evaluate<{ ok: boolean; message?: string }>(findAndAct("fill", String(input.target ?? ""), String(input.value ?? "")));
        if (r.ok && input.press_enter) {
          await portals.evaluate(
            `(() => { const el = document.activeElement; if (!el) return; for (const t of ["keydown","keypress","keyup"]) el.dispatchEvent(new KeyboardEvent(t, { key: "Enter", code: "Enter", keyCode: 13, bubbles: true })); const f = el.form; if (f && t === "keyup") f.requestSubmit ? f.requestSubmit() : f.submit(); })()`,
          );
        }
        return r;
      },
    },
    {
      label: "لقطة للبوابة",
      tool: {
        name: "portal_screenshot",
        description: "يلتقط صورة للصفحة النشطة في البوابة ويعيدها لك لتراها.",
        input_schema: { type: "object", properties: {}, additionalProperties: false },
      },
      run: async () => {
        const shot = await portals.capture();
        const b64 = shot.png.toString("base64");
        return {
          __blocks: [
            { type: "image", source: { type: "base64", media_type: "image/png", data: b64 } },
            { type: "text", text: `لقطة البوابة ${shot.width}×${shot.height}` },
          ],
          __preview: `data:image/png;base64,${b64}`,
        };
      },
      preview: (_i, out) => (out as { __preview?: string })?.__preview ?? null,
    },
  ];
}
