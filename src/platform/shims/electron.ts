/**
 * بديل لوحدة electron داخل المتصفح/الجوال: يوفّر الحد الأدنى الذي تستخدمه طبقة
 * البيانات (app, dialog, shell, safeStorage, BrowserWindow كهيكل فقط).
 */
import { mimeFor, nativeOpenExternal, nativeOpenFile, pickFile } from "../native";
import { importPickedFile, readBytes, EXPORTS_DIR } from "./node-fs";
import { basename } from "./node-path";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type IpcMain = { handle: (channel: string, fn: (event: any, ...args: any[]) => unknown) => void };

export const app = {
  getPath(name: string): string {
    return name === "userData" ? "/app/data" : name === "documents" || name === "downloads" || name === "desktop" ? EXPORTS_DIR : "/tmp";
  },
  getVersion(): string {
    return __APP_VERSION__;
  },
  relaunch(): void {
    window.location.reload();
  },
  exit(_code?: number): void {
    window.location.reload();
  },
};

export const dialog = {
  async showOpenDialog(opts: { filters?: { name: string; extensions: string[] }[]; properties?: string[] } = {}): Promise<{ canceled: boolean; filePaths: string[] }> {
    const accept = opts.filters?.flatMap((f) => f.extensions.map((e) => `.${e}`)).join(",");
    const picked = await pickFile(accept);
    if (!picked) return { canceled: true, filePaths: [] };
    return { canceled: false, filePaths: [importPickedFile(picked.name, picked.bytes)] };
  },
  async showSaveDialog(opts: { defaultPath?: string; filters?: unknown } = {}): Promise<{ canceled: boolean; filePath?: string }> {
    const name = basename(opts.defaultPath ?? "ملف");
    return { canceled: false, filePath: `${EXPORTS_DIR}/${name}` };
  },
  async showMessageBox(opts: { message: string; detail?: string; buttons?: string[]; cancelId?: number; type?: string; title?: string; defaultId?: number }): Promise<{ response: number }> {
    const ok = window.confirm(`${opts.message}${opts.detail ? `\n\n${opts.detail}` : ""}`);
    return { response: ok ? 0 : (opts.cancelId ?? 1) };
  },
};

export const shell = {
  async openExternal(url: string): Promise<void> {
    nativeOpenExternal(url);
  },
  async openPath(p: string): Promise<string> {
    const bytes = readBytes(p);
    if (!bytes) return "الملف غير موجود";
    nativeOpenFile(basename(p), bytes);
    return "";
  },
  showItemInFolder(p: string): void {
    void shell.openPath(p);
  },
};

export const safeStorage = {
  isEncryptionAvailable(): boolean {
    return false;
  },
  encryptString(_s: string): { toString(_enc: string): string } {
    throw new Error("غير مدعوم");
  },
  decryptString(_b: unknown): string {
    throw new Error("غير مدعوم");
  },
};

export const clipboard = {
  readText(): string {
    return "";
  },
  writeText(t: string): void {
    void navigator.clipboard?.writeText(t);
  },
};

/** هيكل فقط — لا يُستدعى على الجوال (pdf.ts يتفرّع قبل استخدامه). */
export class BrowserWindow {
  webContents = {
    printToPDF: async (_o: unknown) => new Uint8Array(),
    send: (_c: string, _p?: unknown) => undefined,
  };
  constructor(_opts?: unknown) {}
  async loadFile(_p: string): Promise<void> {}
  destroy(): void {}
  isDestroyed(): boolean {
    return false;
  }
  static getAllWindows(): BrowserWindow[] {
    return [];
  }
}

export const desktopCapturer = { getSources: async () => [] as unknown[] };
export const screen = { getPrimaryDisplay: () => ({ id: 0, size: { width: window.innerWidth, height: window.innerHeight }, bounds: { x: 0, y: 0 } }) };
export const nativeImage = { createFromPath: () => null };
export const Menu = { buildFromTemplate: () => null, setApplicationMenu: () => undefined };
export const ipcMain = { handle: () => undefined };
export { mimeFor };
