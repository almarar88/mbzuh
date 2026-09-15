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
    // بدائل وحدات Node/Electron حتى يُبنى فرع الجوال (لا يُنفَّذ داخل Electron لكنه يُضمَّن في الحزمة).
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
    __MOBILE__: "false",
    "process.env": "{}",
    "process.versions": JSON.stringify({ electron: "renderer" }),
    "process.platform": JSON.stringify("browser"),
  },
  optimizeDeps: { exclude: ["sql.js"] },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
  },
  server: { port: 5599, strictPort: true },
});
