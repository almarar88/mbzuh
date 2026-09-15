import { parseHTML } from "linkedom";
import { setPlatform } from "../core/platform";
import { openNodeDb } from "./db/sqlite-node";
import { aggregator } from "../core/services/aggregator";
import { feedStats, listArticles, listSources } from "../core/services/articles";
import { searchNews, searchWeb } from "../core/services/search";
import { seedSources } from "../core/services/sources";
import { translateToArabic } from "../core/services/translate";

export async function run(dbPath: string): Promise<void> {
  setPlatform({ name: "electron", parseHtml: (html) => parseHTML(html).document as unknown as Document, env: (n) => process.env[n] });
  openNodeDb(dbPath);
  seedSources();
  console.log("sources:", listSources().length);
  const t0 = Date.now();
  const summary = await aggregator.refreshAll();
  console.log(`refresh: +${summary.added} in ${((Date.now() - t0) / 1000).toFixed(1)}s, errors=${summary.errors.length}`);
  for (const e of summary.errors) console.log("  ✗", e.source, "→", e.error);
  console.log("stats:", feedStats({ lastRefreshAt: null, refreshing: false }));
  const latest = listArticles({ limit: 8 });
  for (const a of latest) console.log(" •", a.category, a.lang, a.sourceName, "|", a.title.slice(0, 70), "| img:", Boolean(a.imageUrl));

  const en = listArticles({ limit: 40 }).filter((a) => a.lang === "en" && a.sourceKind === "rss").slice(0, 2);
  for (const a of en) {
    const d = await aggregator.fetchDetails(a.id, true);
    console.log("details:", a.sourceName, "| text:", d.contentText?.length ?? 0, "| images:", d.images.length, "| err:", d.detailsError);
    const tr = await aggregator.translateArticle(a.id, true);
    console.log("  titleAr:", tr.titleAr?.slice(0, 80), "| contentAr:", tr.contentAr?.length ?? 0);
    const an = await aggregator.analyze(a.id);
    console.log("  analysis:", an.engine, "| points:", an.keyPoints.length, "| tags:", an.tags.join("،"));
  }
  const gn = listArticles({ kind: "gnews", limit: 1 })[0];
  if (gn) {
    const d = await aggregator.fetchDetails(gn.id, true);
    console.log("gnews details:", d.url.slice(0, 80), "| text:", d.contentText?.length ?? 0, "| err:", d.detailsError);
  }
  console.log("translate:", (await translateToArabic("Nvidia unveils a new chip for AI inference in data centers.")).text);
  try {
    const w = await searchWeb("OpenAI GPT news", 3);
    console.log("web search:", w.engine, w.results.map((r) => r.title.slice(0, 50)));
  } catch (e) {
    console.log("web search failed:", (e as Error).message);
  }
  console.log("news search:", (await searchNews("الذكاء الاصطناعي", "ar", 3)).map((r) => r.title.slice(0, 50)));
}
