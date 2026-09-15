import { build } from "esbuild";
import { rmSync } from "node:fs";

rmSync("dist-electron", { recursive: true, force: true });

const common = {
  bundle: true,
  platform: "node",
  target: "node20",
  sourcemap: true,
  external: ["electron"],
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
