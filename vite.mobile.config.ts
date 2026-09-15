/**
 * بناء نسخة الجوال/المتصفح: نفس واجهة React مع تشغيل طبقة البيانات داخل المتصفح
 * عبر بدائل لوحدات Electron وNode (انظر src/platform/shims).
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };
const shim = (name: string) => fileURLToPath(new URL(`./src/platform/shims/${name}.ts`, import.meta.url));

export default defineConfig({
  root: ".",
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
      { find: "@shared", replacement: fileURLToPath(new URL("./shared", import.meta.url)) },
      { find: /^electron$/, replacement: shim("electron") },
      { find: /^node:sqlite$/, replacement: shim("node-sqlite") },
      { find: /^node:fs$/, replacement: shim("node-fs") },
      { find: /^node:path$/, replacement: shim("node-path") },
      { find: /^node:os$/, replacement: shim("node-os") },
    ],
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __MOBILE__: "true",
    "process.env": "{}",
    "process.versions": JSON.stringify({ electron: "WebView" }),
    "process.platform": JSON.stringify("android"),
  },
  optimizeDeps: { exclude: ["sql.js"] },
  build: {
    outDir: "dist-mobile",
    emptyOutDir: true,
    assetsInlineLimit: 32 * 1024,
    chunkSizeWarningLimit: 3000,
    target: "es2020",
  },
  server: { port: 5600, strictPort: true },
});
