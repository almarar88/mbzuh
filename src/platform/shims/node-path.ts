/** بديل مصغّر لـ node:path (نمط POSIX) لبيئة المتصفح/الجوال. */

function normalizeParts(parts: string[]): string[] {
  const out: string[] = [];
  for (const p of parts) {
    if (!p || p === ".") continue;
    if (p === "..") {
      out.pop();
      continue;
    }
    out.push(p);
  }
  return out;
}

export function join(...segments: string[]): string {
  const joined = segments.filter(Boolean).join("/");
  const absolute = joined.startsWith("/");
  const parts = normalizeParts(joined.split("/"));
  return (absolute ? "/" : "") + parts.join("/");
}

export function resolve(...segments: string[]): string {
  let acc = "";
  for (const s of segments) acc = s.startsWith("/") ? s : acc ? `${acc}/${s}` : s;
  const abs = acc.startsWith("/") ? acc : `/${acc}`;
  return "/" + normalizeParts(abs.split("/")).join("/");
}

export function basename(p: string, ext?: string): string {
  const base = p.replace(/[\\/]+$/, "").split(/[\\/]/).pop() ?? "";
  return ext && base.endsWith(ext) ? base.slice(0, -ext.length) : base;
}

export function dirname(p: string): string {
  const clean = p.replace(/[\\/]+$/, "");
  const i = clean.lastIndexOf("/");
  if (i < 0) return ".";
  if (i === 0) return "/";
  return clean.slice(0, i);
}

export function extname(p: string): string {
  const base = basename(p);
  const i = base.lastIndexOf(".");
  return i <= 0 ? "" : base.slice(i);
}

export function isAbsolute(p: string): boolean {
  return p.startsWith("/");
}

export function relative(from: string, to: string): string {
  const a = resolve(from).split("/").filter(Boolean);
  const b = resolve(to).split("/").filter(Boolean);
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return [...a.slice(i).map(() => ".."), ...b.slice(i)].join("/");
}

export const sep = "/";

const path = { join, resolve, basename, dirname, extname, isAbsolute, relative, sep };
export default path;
