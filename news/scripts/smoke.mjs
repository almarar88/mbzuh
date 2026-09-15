/**
 * اختبار دخان للخدمات خارج Electron: يجلب المصادر الحقيقية، يخزّنها في قاعدة
 * مؤقتة، يجلب تفاصيل بعض المقالات ويترجمها ويجرّب البحث.
 * الاستخدام: node scripts/smoke.mjs [dbPath]
 */
import { build } from "esbuild";

if (process.env.HTTPS_PROXY && !process.env.NODE_USE_ENV_PROXY) {
  console.log("ملاحظة: fetch في Node لا يقرأ HTTPS_PROXY تلقائيًا — شغّل مع NODE_USE_ENV_PROXY=1 عند الحاجة.");
}
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const dir = mkdtempSync(path.join(os.tmpdir(), "techpulse-smoke-"));
const out = path.join(dir, "smoke.cjs");
await build({
  entryPoints: ["electron/smoke-entry.ts"],
  outfile: out,
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  external: ["electron"],
  logLevel: "error",
});
const mod = await import(pathToFileURL(out).href);
await mod.run(process.argv[2] ?? path.join(dir, "smoke.db"));
