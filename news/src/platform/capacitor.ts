/**
 * مهايئات Capacitor: الشبكة عبر CapacitorHttp (يتجاوز CORS ويعمل من الطبقة الأصلية)،
 * التخزين عبر Filesystem، وفتح الروابط في المتصفح الخارجي.
 */
import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import type { PersistHooks } from "./db-sqljs";

export const isNative = Capacitor.isNativePlatform();

/** يُمرَّر إلى setFetchImpl في core/services/http. */
export async function nativeFetch(input: string, init?: RequestInit): Promise<Response> {
  if (!isNative) return fetch(input, init);
  const headers: Record<string, string> = {};
  if (init?.headers) {
    const h = init.headers as Record<string, string> | Headers;
    if (h instanceof Headers) h.forEach((v, k) => (headers[k] = v));
    else Object.assign(headers, h);
  }
  const res = await CapacitorHttp.request({
    url: input,
    method: init?.method ?? "GET",
    headers,
    data: typeof init?.body === "string" ? init.body : undefined,
    responseType: "text",
    connectTimeout: 20000,
    readTimeout: 25000,
  });
  const body = typeof res.data === "string" ? res.data : JSON.stringify(res.data ?? "");
  const ct = Object.entries(res.headers ?? {}).find(([k]) => k.toLowerCase() === "content-type")?.[1] ?? "";
  const response = new Response(body, { status: res.status, headers: { "content-type": ct } });
  Object.defineProperty(response, "url", { value: res.url || input });
  return response;
}

const DB_FILE = "techpulse.db";

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export const persistHooks: PersistHooks = {
  async load() {
    if (!isNative) {
      try {
        const b64 = localStorage.getItem(DB_FILE);
        return b64 ? base64ToBytes(b64) : null;
      } catch {
        return null;
      }
    }
    try {
      const r = await Filesystem.readFile({ path: DB_FILE, directory: Directory.Data });
      return typeof r.data === "string" ? base64ToBytes(r.data) : new Uint8Array(await (r.data as Blob).arrayBuffer());
    } catch {
      return null;
    }
  },
  async save(bytes) {
    const b64 = bytesToBase64(bytes);
    if (!isNative) {
      try {
        localStorage.setItem(DB_FILE, b64);
      } catch {
        /* تخزين المتصفح ممتلئ أو محظور */
      }
      return;
    }
    await Filesystem.writeFile({ path: DB_FILE, directory: Directory.Data, data: b64 });
  },
};

export async function openExternal(url: string): Promise<void> {
  if (!/^https?:\/\//.test(url)) return;
  if (isNative) await Browser.open({ url });
  else window.open(url, "_blank", "noopener");
}

export async function readTextAsset(path: string): Promise<string> {
  const r = await Filesystem.readFile({ path, directory: Directory.Data, encoding: Encoding.UTF8 });
  return String(r.data);
}
