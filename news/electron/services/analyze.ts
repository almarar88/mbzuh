/**
 * تحليل خبر: بالنموذج (JSON منظّم) إن وُجد مفتاح، وإلا تلخيص استخلاصي محلي.
 */
import type { Analysis, Article } from "@shared/types";
import { nowIso } from "../db";
import { classify } from "./classify";
import { complete, getClient } from "./llm";
import { isArabic, stripHtml } from "./text";

const STOP = new Set(
  "the a an and or of to in on for with by from at as is are was were be been this that these those it its into than then their they them he she we you our your his her not no but if so do does did has have had will would can could should may might about over under after before more most less least very also just new said says according".split(" ")
    .concat("في من على إلى عن أن إن ما لا لم لن هذا هذه ذلك تلك التي الذي الذين هو هي هم نحن أنا أنت كان كانت يكون تكون قد وقد كما بعد قبل بين حتى إذا أو ثم لكن بل مع كل بعض غير عند لدى منذ حول خلال ضمن وفق وفقا حيث أي أيضا ذات ذو".split(" ")),
);

export function localAnalysis(article: Article): Analysis {
  const text = stripHtml(article.contentAr || "").replace(/\s+/g, " ").trim() || (article.contentText || article.summaryAr || article.summary || "").replace(/\s+/g, " ").trim();
  const title = article.titleAr || article.title;
  const sentences = text.split(/(?<=[.!?؟])\s+/).filter((s) => s.length > 30 && s.length < 500);
  const freq = new Map<string, number>();
  for (const word of (title + " " + text).toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (word.length < 3 || STOP.has(word)) continue;
    freq.set(word, (freq.get(word) ?? 0) + 1);
  }
  const scored = sentences.map((s, i) => {
    let score = 0;
    for (const word of s.toLowerCase().split(/[^\p{L}\p{N}]+/u)) score += freq.get(word) ?? 0;
    return { s, i, score: score / Math.sqrt(s.length) - i * 0.02 };
  });
  const top = scored.sort((x, y) => y.score - x.score).slice(0, 4).sort((x, y) => x.i - y.i).map((x) => x.s.trim());
  const c = classify(title, text);
  const entities = [...new Set((title + " " + text.slice(0, 3000)).match(/\b[A-Z][A-Za-z0-9.-]{2,}(?:\s[A-Z][A-Za-z0-9.-]{2,})?\b/g) ?? [])].filter((e) => !STOP.has(e.toLowerCase())).slice(0, 8);
  return {
    summary: top.slice(0, 2).join(" ") || (article.summaryAr || article.summary || "").slice(0, 400),
    keyPoints: top,
    whyItMatters: "",
    entities,
    sentiment: "neutral",
    confidence: "reported",
    tags: c.tags,
    engine: "local",
    createdAt: nowIso(),
  };
}

export async function llmAnalysis(article: Article): Promise<Analysis> {
  const body = (article.contentText || article.summary || "").slice(0, 24000);
  const prompt = `حلّل الخبر التقني التالي وأخرج JSON فقط (بلا أي نص آخر) بالمفاتيح:
{
  "summary": "ملخص عربي من 2-3 جمل",
  "keyPoints": ["نقطة 1", "نقطة 2", "..."],
  "whyItMatters": "لماذا يهم هذا الخبر (جملتان)",
  "entities": ["الشركات والمنتجات والأشخاص المذكورون"],
  "sentiment": "positive|negative|neutral|mixed",
  "confidence": "confirmed|reported|speculation",
  "tags": ["وسوم عربية قصيرة (3-6)"]
}
ميّز بين ما هو مؤكد رسميًا وما هو منقول أو تخمين. اكتب كل القيم النصية بالعربية مع الإبقاء على أسماء المنتجات والشركات باللاتينية.

العنوان: ${article.title}
المصدر: ${article.sourceName} — ${article.url}
التاريخ: ${article.publishedAt}
النص:
${body}`;
  const raw = await complete("أنت محلل أخبار تقنية وذكاء اصطناعي دقيق. تُخرج JSON صالحًا فقط.", prompt, 4000);
  const json = raw.replace(/^```(?:json)?/m, "").replace(/```$/m, "").trim();
  const start = json.indexOf("{");
  const end = json.lastIndexOf("}");
  const parsed = JSON.parse(json.slice(start, end + 1)) as Partial<Analysis>;
  return {
    summary: String(parsed.summary ?? ""),
    keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints.map(String) : [],
    whyItMatters: String(parsed.whyItMatters ?? ""),
    entities: Array.isArray(parsed.entities) ? parsed.entities.map(String) : [],
    sentiment: (["positive", "negative", "neutral", "mixed"] as const).includes(parsed.sentiment as never) ? (parsed.sentiment as Analysis["sentiment"]) : "neutral",
    confidence: (["confirmed", "reported", "speculation"] as const).includes(parsed.confidence as never) ? (parsed.confidence as Analysis["confidence"]) : "reported",
    tags: Array.isArray(parsed.tags) ? parsed.tags.map(String).slice(0, 6) : [],
    engine: "llm",
    createdAt: nowIso(),
  };
}

export async function analyzeArticle(article: Article, forceLocal = false): Promise<Analysis> {
  if (!forceLocal && getClient()) {
    try {
      return await llmAnalysis(article);
    } catch {
      /* نعود إلى التحليل المحلي */
    }
  }
  const a = localAnalysis(article);
  if (!isArabic(a.summary) && article.summaryAr) a.summary = article.summaryAr;
  return a;
}
