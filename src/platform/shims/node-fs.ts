/**
 * نظام ملفات افتراضي (VFS) في الذاكرة بديلًا لـ node:fs على الجوال/المتصفح.
 *
 * - كل الملفات (قاعدة البيانات، النسخ الاحتياطية، المرفقات، الملفات المختارة)
 *   تُحفظ في IndexedDB وتُحمَّل عند الإقلاع (loadVfs) لأن واجهة fs متزامنة.
 * - الملفات المكتوبة تحت /app/exports تُسلَّم للنظام الأصلي (حفظ في التنزيلات)
 *   عبر جسر الأندرويد أو تنزيل المتصفح.
 */
import { nativeSaveFile } from "../native";

type Entry = { kind: "file"; data: Uint8Array; mtime: number } | { kind: "dir"; mtime: number };

const DB_NAME = "mbzuh-vfs";
const STORE = "files";
const files = new Map<string, Entry>();
const dirty = new Set<string>();
let flushTimer: number | null = null;

export const EXPORTS_DIR = "/app/exports";

function norm(p: string): string {
  const abs = p.startsWith("/") ? p : `/${p}`;
  const parts: string[] = [];
  for (const seg of abs.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return "/" + parts.join("/");
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** يحمّل كل الملفات من IndexedDB إلى الذاكرة (يُستدعى مرة قبل تشغيل التطبيق). */
export async function loadVfs(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).openCursor();
      req.onsuccess = () => {
        const cur = req.result;
        if (!cur) return resolve();
        const v = cur.value as Entry;
        files.set(String(cur.key), v);
        cur.continue();
      };
      req.onerror = () => reject(req.error);
    });
    db.close();
  } catch {
    /* بيئة بلا IndexedDB: نعمل في الذاكرة فقط */
  }
  for (const d of ["/app", "/app/data", "/app/data/files", "/app/data/backups", "/app/picked", EXPORTS_DIR, "/tmp"]) {
    if (!files.has(d)) files.set(d, { kind: "dir", mtime: Date.now() });
  }
}

function scheduleFlush(p: string): void {
  dirty.add(p);
  if (flushTimer !== null) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    void flush();
  }, 400);
}

export async function flush(): Promise<void> {
  if (!dirty.size) return;
  const keys = [...dirty];
  dirty.clear();
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      for (const k of keys) {
        const e = files.get(k);
        if (e) store.put(e, k);
        else store.delete(k);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* تجاهل — البيانات تبقى في الذاكرة */
  }
}

class VfsError extends Error {
  code: string;
  constructor(code: string, msg: string) {
    super(msg);
    this.code = code;
  }
}

function toBytes(data: unknown): Uint8Array {
  if (typeof data === "string") return new TextEncoder().encode(data);
  if (data instanceof Uint8Array) return new Uint8Array(data);
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice();
  return new TextEncoder().encode(String(data));
}

export function existsSync(p: string): boolean {
  return files.has(norm(p));
}

export function mkdirSync(p: string, _opts?: { recursive?: boolean }): void {
  const n = norm(p);
  const parts = n.split("/").filter(Boolean);
  let acc = "";
  for (const seg of parts) {
    acc += `/${seg}`;
    if (!files.has(acc)) {
      files.set(acc, { kind: "dir", mtime: Date.now() });
      scheduleFlush(acc);
    }
  }
}

export function writeFileSync(p: string, data: unknown, _enc?: unknown): void {
  const n = norm(p);
  mkdirSync(n.slice(0, n.lastIndexOf("/")) || "/");
  const bytes = toBytes(data);
  files.set(n, { kind: "file", data: bytes, mtime: Date.now() });
  scheduleFlush(n);
  if (n.startsWith(`${EXPORTS_DIR}/`)) nativeSaveFile(n.slice(EXPORTS_DIR.length + 1), bytes);
}

/** يعيد Uint8Array (يعمل كـBuffer لأغراضنا) أو نصًا عند تمرير ترميز. */
export function readFileSync(p: string, enc?: unknown): Uint8Array & { toString(): string } {
  const e = files.get(norm(p));
  if (!e || e.kind !== "file") throw new VfsError("ENOENT", `no such file: ${p}`);
  const bytes = new Uint8Array(e.data) as Uint8Array & { toString(): string };
  if (enc) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new TextDecoder("utf-8").decode(bytes) as any;
  }
  bytes.toString = () => new TextDecoder("utf-8").decode(bytes);
  return bytes;
}

export function readdirSync(p: string, opts?: { withFileTypes?: boolean }): unknown[] {
  const n = norm(p);
  const prefix = n === "/" ? "/" : `${n}/`;
  const names = new Set<string>();
  for (const k of files.keys()) {
    if (k.startsWith(prefix) && k !== n) {
      const rest = k.slice(prefix.length);
      names.add(rest.split("/")[0]);
    }
  }
  const list = [...names].sort();
  if (opts?.withFileTypes) {
    return list.map((name) => {
      const e = files.get(`${prefix}${name}`);
      return { name, isDirectory: () => e?.kind === "dir", isFile: () => e?.kind === "file" };
    });
  }
  return list;
}

export function statSync(p: string): { size: number; mtime: Date; mtimeMs: number; isDirectory(): boolean; isFile(): boolean } {
  const e = files.get(norm(p));
  if (!e) throw new VfsError("ENOENT", `no such file: ${p}`);
  return {
    size: e.kind === "file" ? e.data.byteLength : 0,
    mtime: new Date(e.mtime),
    mtimeMs: e.mtime,
    isDirectory: () => e.kind === "dir",
    isFile: () => e.kind === "file",
  };
}

export function rmSync(p: string, opts?: { force?: boolean; recursive?: boolean }): void {
  const n = norm(p);
  const e = files.get(n);
  if (!e) {
    if (opts?.force) return;
    throw new VfsError("ENOENT", `no such file: ${p}`);
  }
  if (e.kind === "dir") {
    for (const k of [...files.keys()]) {
      if (k.startsWith(`${n}/`)) {
        files.delete(k);
        scheduleFlush(k);
      }
    }
  }
  files.delete(n);
  scheduleFlush(n);
}

export function unlinkSync(p: string): void {
  rmSync(p, { force: true });
}

export function copyFileSync(from: string, to: string): void {
  const e = files.get(norm(from));
  if (!e || e.kind !== "file") throw new VfsError("ENOENT", `no such file: ${from}`);
  writeFileSync(to, e.data);
}

export function renameSync(from: string, to: string): void {
  copyFileSync(from, to);
  rmSync(from, { force: true });
}

/** يُستخدم من واجهة اختيار الملفات لإدخال ملف حقيقي إلى النظام الافتراضي. */
export function importPickedFile(name: string, bytes: Uint8Array): string {
  const safe = name.replace(/[\\/]/g, "_");
  const p = `/app/picked/${Date.now()}-${safe}`;
  writeFileSync(p, bytes);
  return p;
}

export function readBytes(p: string): Uint8Array | null {
  const e = files.get(norm(p));
  return e && e.kind === "file" ? e.data : null;
}

const fs = {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  statSync,
  rmSync,
  unlinkSync,
  copyFileSync,
  renameSync,
};
export default fs;
