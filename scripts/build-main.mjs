import { build } from "esbuild";
import { rmSync } from "node:fs";

const watch = process.argv.includes("--watch");
rmSync("dist-electron", { recursive: true, force: true });

const common = {
  bundle: true,
  platform: "node",
  target: "node20",
  sourcemap: true,
  external: ["electron", "exceljs", "@anthropic-ai/sdk"],
  // خطوط Tajawal تُضمَّن كـdata URL لتُحقن داخل صفحات UMS (لا يمكنها تحميل ملفاتنا المحلية).
  loader: { ".woff2": "dataurl" },
  logLevel: "info",
};

await build({
  ...common,
  entryPoints: ["electron/main.ts"],
  outfile: "dist-electron/main.js",
  format: "cjs",
});

await build({
  ...common,
  entryPoints: ["electron/preload.ts"],
  outfile: "dist-electron/preload.js",
  format: "cjs",
});

if (watch) {
  const { context } = await import("esbuild");
  const ctx = await context({
    ...common,
    entryPoints: ["electron/main.ts", "electron/preload.ts"],
    outdir: "dist-electron",
    format: "cjs",
  });
  await ctx.watch();
}
