/** عميل HTTP موحّد: مهلة، وكيل متصفح، وحدّ لحجم الاستجابة. */

export const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

export interface FetchOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
  maxBytes?: number;
  method?: "GET" | "POST";
  body?: string;
}

type FetchImpl = (input: string, init?: RequestInit) => Promise<Response>;
let fetchImpl: FetchImpl = (input, init) => fetch(input, init);

/** يسمح للعملية الرئيسية باستبدال fetch بـ net.fetch من Electron (شبكة Chromium: بصمة متصفح ووكيل النظام). */
export function setFetchImpl(impl: FetchImpl): void {
  fetchImpl = impl;
}

export interface FetchResult {
  status: number;
  url: string;
  contentType: string;
  text: string;
}

export async function fetchText(url: string, opts: FetchOptions = {}): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20000);
  try {
    const res = await fetchImpl(url, {
      method: opts.method ?? "GET",
      body: opts.body,
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": BROWSER_UA,
        accept: "text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8",
        "accept-language": "ar,en;q=0.8",
        ...(opts.headers ?? {}),
      },
    });
    const contentType = res.headers.get("content-type") ?? "";
    const maxBytes = opts.maxBytes ?? 6 * 1024 * 1024;
    const buf = new Uint8Array(await res.arrayBuffer());
    const sliced = buf.length > maxBytes ? buf.subarray(0, maxBytes) : buf;
    const charset = /charset=([\w-]+)/i.exec(contentType)?.[1]?.toLowerCase();
    let text: string;
    try {
      text = new TextDecoder(charset && charset !== "utf8" ? charset : "utf-8").decode(sliced);
    } catch {
      text = new TextDecoder("utf-8").decode(sliced);
    }
    return { status: res.status, url: res.url || url, contentType, text };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson<T = unknown>(url: string, opts: FetchOptions = {}): Promise<{ status: number; data: T | null; text: string }> {
  const r = await fetchText(url, { ...opts, headers: { accept: "application/json", ...(opts.headers ?? {}) } });
  try {
    return { status: r.status, data: JSON.parse(r.text) as T, text: r.text };
  } catch {
    return { status: r.status, data: null, text: r.text };
  }
}

/** ينفّذ المهام بتوازٍ محدود. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
