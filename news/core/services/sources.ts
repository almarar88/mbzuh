/** المصادر الافتراضية المدمجة. */
import type { Lang, SourceKind } from "@shared/types";
import { getDb } from "../db";

export interface SourceSeed {
  kind: SourceKind;
  name: string;
  target: string;
  lang: Lang;
  techOnly: boolean;
}

export const DEFAULT_SOURCES: SourceSeed[] = [
  // ── عربي ──
  { kind: "rss", name: "البوابة العربية للأخبار التقنية", target: "https://aitnews.com/feed/", lang: "ar", techOnly: true },
  { kind: "rss", name: "عالم التقنية", target: "https://www.tech-wd.com/wd/feed/", lang: "ar", techOnly: true },
  { kind: "rss", name: "عرب هاردوير", target: "https://arabhardware.net/feed", lang: "ar", techOnly: true },
  { kind: "rss", name: "التقنية بلا حدود", target: "https://www.unlimit-tech.com/feed/", lang: "ar", techOnly: true },
  { kind: "gnews", name: "أخبار Google — AI", target: "الذكاء الاصطناعي", lang: "ar", techOnly: false },
  { kind: "gnews", name: "أخبار Google — التقنية", target: "تقنية OR تكنولوجيا OR هواتف OR شركات التقنية", lang: "ar", techOnly: false },
  { kind: "gnews", name: "أخبار Google — OpenAI وChatGPT", target: "OpenAI OR ChatGPT OR جوجل جيميني OR كلود", lang: "ar", techOnly: false },
  // ── ذكاء اصطناعي (إنجليزي) ──
  { kind: "rss", name: "TechCrunch AI", target: "https://techcrunch.com/category/artificial-intelligence/feed/", lang: "en", techOnly: true },
  { kind: "rss", name: "The Verge AI", target: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", lang: "en", techOnly: true },
  { kind: "rss", name: "Ars Technica AI", target: "https://feeds.arstechnica.com/arstechnica/technology-lab", lang: "en", techOnly: true },
  { kind: "rss", name: "VentureBeat AI", target: "https://venturebeat.com/category/ai/feed/", lang: "en", techOnly: true },
  { kind: "rss", name: "MIT Technology Review", target: "https://www.technologyreview.com/feed/", lang: "en", techOnly: true },
  { kind: "rss", name: "Wired AI", target: "https://www.wired.com/feed/tag/ai/latest/rss", lang: "en", techOnly: true },
  { kind: "rss", name: "The Decoder", target: "https://the-decoder.com/feed/", lang: "en", techOnly: true },
  { kind: "rss", name: "OpenAI News", target: "https://openai.com/news/rss.xml", lang: "en", techOnly: true },
  { kind: "rss", name: "Google AI Blog", target: "https://blog.google/technology/ai/rss/", lang: "en", techOnly: true },
  { kind: "rss", name: "Google DeepMind", target: "https://deepmind.google/blog/rss.xml", lang: "en", techOnly: true },
  { kind: "rss", name: "Hugging Face Blog", target: "https://huggingface.co/blog/feed.xml", lang: "en", techOnly: true },
  { kind: "rss", name: "arXiv cs.AI", target: "https://rss.arxiv.org/rss/cs.AI", lang: "en", techOnly: true },
  // ── تقنية عامة (إنجليزي) ──
  { kind: "rss", name: "TechCrunch", target: "https://feeds.feedburner.com/TechCrunch/", lang: "en", techOnly: true },
  { kind: "rss", name: "The Verge", target: "https://www.theverge.com/rss/index.xml", lang: "en", techOnly: true },
  { kind: "rss", name: "Ars Technica", target: "https://feeds.arstechnica.com/arstechnica/index", lang: "en", techOnly: true },
  { kind: "rss", name: "Engadget", target: "https://www.engadget.com/rss.xml", lang: "en", techOnly: true },
  { kind: "rss", name: "Techmeme", target: "https://www.techmeme.com/feed.xml", lang: "en", techOnly: true },
  { kind: "rss", name: "BBC Technology", target: "https://feeds.bbci.co.uk/news/technology/rss.xml", lang: "en", techOnly: true },
  { kind: "rss", name: "Hacker News (AI)", target: "https://hnrss.org/newest?q=AI+OR+LLM+OR+OpenAI+OR+Anthropic&points=50", lang: "en", techOnly: true },
  // ── Reddit ──
  { kind: "reddit", name: "r/artificial", target: "artificial", lang: "en", techOnly: true },
  { kind: "reddit", name: "r/MachineLearning", target: "MachineLearning", lang: "en", techOnly: true },
  { kind: "reddit", name: "r/LocalLLaMA", target: "LocalLLaMA", lang: "en", techOnly: true },
  { kind: "reddit", name: "r/OpenAI", target: "OpenAI", lang: "en", techOnly: true },
  { kind: "reddit", name: "r/ClaudeAI", target: "ClaudeAI", lang: "en", techOnly: true },
  { kind: "reddit", name: "r/singularity", target: "singularity", lang: "en", techOnly: true },
  { kind: "reddit", name: "r/technology", target: "technology", lang: "en", techOnly: true },
  // ── X (تويتر) ──
  { kind: "x", name: "@OpenAI", target: "OpenAI", lang: "en", techOnly: true },
  { kind: "x", name: "@AnthropicAI", target: "AnthropicAI", lang: "en", techOnly: true },
  { kind: "x", name: "@GoogleDeepMind", target: "GoogleDeepMind", lang: "en", techOnly: true },
  { kind: "x", name: "@huggingface", target: "huggingface", lang: "en", techOnly: true },
  { kind: "x", name: "@verge", target: "verge", lang: "en", techOnly: true },
  { kind: "x", name: "@TechCrunch", target: "TechCrunch", lang: "en", techOnly: true },
  { kind: "x", name: "@aitnews", target: "aitnews", lang: "ar", techOnly: true },
  { kind: "x", name: "@TechWD", target: "TechWD", lang: "ar", techOnly: true },
];

export function seedSources(): void {
  const db = getDb();
  const insert = db.prepare(
    "INSERT OR IGNORE INTO sources(kind, name, target, lang, enabled, tech_only, builtin) VALUES (?, ?, ?, ?, 1, ?, 1)",
  );
  db.transaction(() => {
    for (const s of DEFAULT_SOURCES) insert.run(s.kind, s.name, s.target, s.lang, s.techOnly ? 1 : 0);
  });
}
