/**
 * الترجمة إلى العربية بسلسلة مزوّدين:
 *  llm (Claude) → Google (نقطة gtx العامة بلا مفتاح) → MyMemory (مجاني، نصوص قصيرة).
 * النتائج تُخزَّن مؤقتًا في جدول translations.
 */
import type { TranslationProvider } from "@shared/types";
import { getDb, nowIso } from "../db";
import { fetchJson } from "./http";
import { getClient, complete } from "./llm";
import { loadSettings } from "./settings";
import { chunkText, isArabic, sha1 } from "./text";

export interface TranslateResult {
  text: string;
  provider: "llm" | "google" | "mymemory" | "none";
}

function cacheGet(hash: string): TranslateResult | null {
  const row = getDb().prepare("SELECT text, provider FROM translations WHERE hash = ?").get(hash) as { text: string; provider: TranslateResult["provider"] } | undefined;
  return row ? { text: row.text, provider: row.provider } : null;
}

function cachePut(hash: string, r: TranslateResult): void {
  getDb().prepare("INSERT OR REPLACE INTO translations(hash, text, provider, created_at) VALUES (?, ?, ?, ?)").run(hash, r.text, r.provider, nowIso());
}

async function googleOnce(text: string): Promise<string> {
  const endpoints = [
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ar&dt=t&q=${encodeURIComponent(text)}`,
    `https://translate.googleapis.com/translate_a/single?client=dict-chrome-ex&sl=auto&tl=ar&dt=t&q=${encodeURIComponent(text)}`,
    `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=ar&q=${encodeURIComponent(text)}`,
  ];
  let lastErr = "";
  for (const url of endpoints) {
    const r = await fetchJson<unknown>(url, { timeoutMs: 15000 });
    if (r.status !== 200 || r.data == null) {
      lastErr = `Google ${r.status}`;
      continue;
    }
    const data = r.data;
    // الصيغة 1: [[["ترجمة","أصل",...],...],null,"en",...]
    if (Array.isArray(data) && Array.isArray(data[0]) && Array.isArray(data[0][0])) {
      return (data[0] as unknown[][]).map((seg) => String(seg[0] ?? "")).join("");
    }
    // الصيغة 2: [["ترجمة","en"]]
    if (Array.isArray(data) && Array.isArray(data[0]) && typeof data[0][0] === "string") return String(data[0][0]);
    if (Array.isArray(data) && typeof data[0] === "string") return String(data[0]);
    lastErr = "صيغة غير متوقعة";
  }
  throw new Error(lastErr || "فشل Google");
}

async function googleTranslate(text: string): Promise<string> {
  const chunks = chunkText(text, 4000);
  const out: string[] = [];
  for (const c of chunks) out.push(await googleOnce(c));
  return out.join("\n\n");
}

async function myMemoryTranslate(text: string): Promise<string> {
  const chunks = chunkText(text, 480);
  if (chunks.length > 12) throw new Error("النص أطول من حدّ MyMemory");
  const out: string[] = [];
  for (const c of chunks) {
    const r = await fetchJson<{ responseStatus: number; responseData?: { translatedText?: string } }>(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(c)}&langpair=en|ar`,
      { timeoutMs: 15000 },
    );
    const t = r.data?.responseData?.translatedText;
    if (r.status !== 200 || !t || r.data?.responseStatus !== 200) throw new Error(`MyMemory ${r.status}`);
    out.push(t);
  }
  return out.join("\n\n");
}

async function llmTranslate(text: string): Promise<string> {
  return complete(
    "أنت مترجم محترف متخصص في أخبار التقنية والذكاء الاصطناعي. ترجم النص التالي إلى العربية الفصحى المعاصرة بأسلوب صحفي واضح. " +
      "حافظ على أسماء الشركات والمنتجات والنماذج (مثل OpenAI, GPT-5, Claude, Nvidia) بحروفها اللاتينية عند أول ذكر، واحتفظ بتقسيم الفقرات كما هو. " +
      "أخرج الترجمة فقط بلا مقدمات أو تعليقات.",
    text,
    Math.min(16000, Math.max(1000, Math.ceil(text.length * 1.2))),
  );
}

export async function translateToArabic(text: string, providerOverride?: TranslationProvider): Promise<TranslateResult> {
  const src = (text || "").trim();
  if (!src) return { text: "", provider: "none" };
  if (isArabic(src)) return { text: src, provider: "none" };
  const provider = providerOverride ?? loadSettings().translationProvider;
  if (provider === "none") return { text: src, provider: "none" };

  const hash = sha1(`${provider}|${src}`);
  const cached = cacheGet(hash);
  if (cached) return cached;

  const order: ("llm" | "google" | "mymemory")[] =
    provider === "llm" ? ["llm", "google", "mymemory"] : provider === "google" ? ["google", "mymemory"] : provider === "mymemory" ? ["mymemory", "google"] : ["google", "mymemory", "llm"];

  const errors: string[] = [];
  for (const p of order) {
    try {
      if (p === "llm" && !getClient()) continue;
      const t = p === "llm" ? await llmTranslate(src) : p === "google" ? await googleTranslate(src) : await myMemoryTranslate(src);
      if (t && t.trim()) {
        const result: TranslateResult = { text: t.trim(), provider: p };
        cachePut(hash, result);
        return result;
      }
    } catch (e) {
      errors.push(`${p}: ${(e as Error).message}`);
    }
  }
  throw new Error(`تعذّرت الترجمة (${errors.join(" | ")})`);
}
