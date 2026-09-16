/**
 * مرفقات المحادثة: تحويل الملفات (PDF، صور، Word، Excel، CSV، نصوص) إلى كتل محتوى
 * يفهمها Claude. يعمل في العملية الرئيسية وفي المتصفح (الجوال) على حد سواء.
 */
import ExcelJS from "exceljs";
import JSZip from "jszip";
import type Anthropic from "@anthropic-ai/sdk";

export interface AttachmentInput {
  name: string;
  /** المحتوى base64 */
  data: string;
}

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

const IMAGE_TYPES: Record<string, "image/png" | "image/jpeg" | "image/gif" | "image/webp"> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

function ext(name: string): string {
  return name.toLowerCase().split(".").pop() ?? "";
}

function fromBase64(b64: string): Uint8Array {
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(b64, "base64"));
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function utf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8").decode(bytes);
}

async function docxText(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const parts = ["word/document.xml", ...Object.keys(zip.files).filter((f) => /^word\/(header|footer)\d*\.xml$/.test(f))];
  let text = "";
  for (const p of parts) {
    const f = zip.file(p);
    if (!f) continue;
    const xml = await f.async("string");
    text +=
      xml
        .replace(/<w:tab\/>/g, "\t")
        .replace(/<\/w:p>/g, "\n")
        .replace(/<w:br[^>]*\/>/g, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'") + "\n";
  }
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

async function pptxText(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const slides = Object.keys(zip.files)
    .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  let text = "";
  for (const s of slides) {
    const xml = await zip.file(s)!.async("string");
    const t = xml.replace(/<\/a:p>/g, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
    text += `--- شريحة ${s.match(/\d+/)![0]} ---\n${t}\n\n`;
  }
  return text.trim();
}

async function xlsxText(bytes: Uint8Array): Promise<string> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes as unknown as ArrayBuffer);
  let out = "";
  let cells = 0;
  wb.eachSheet((ws) => {
    out += `### ورقة: ${ws.name}\n`;
    ws.eachRow({ includeEmpty: false }, (row) => {
      if (cells > 60_000) return;
      const vals = (row.values as unknown[]).slice(1).map((v) => {
        if (v === null || v === undefined) return "";
        if (typeof v === "object" && v !== null && "result" in (v as Record<string, unknown>)) return String((v as { result: unknown }).result ?? "");
        if (typeof v === "object" && v !== null && "richText" in (v as Record<string, unknown>)) return (v as { richText: { text: string }[] }).richText.map((r) => r.text).join("");
        if (v instanceof Date) return v.toISOString().slice(0, 10);
        return String(v);
      });
      cells += vals.length;
      out += vals.join("\t") + "\n";
    });
    out += "\n";
  });
  return out.trim();
}

/** يحوّل مرفقًا إلى كتلة (أو كتل) محتوى للرسالة. */
export async function attachmentBlocks(att: AttachmentInput): Promise<Anthropic.ContentBlockParam[]> {
  const e = ext(att.name);
  const bytes = fromBase64(att.data);
  if (bytes.byteLength > MAX_ATTACHMENT_BYTES) throw new Error(`الملف ${att.name} أكبر من الحد المسموح (25 م.ب).`);
  const label = (kind: string) => ({ type: "text" as const, text: `[مرفق ${kind}: ${att.name}]` });
  if (IMAGE_TYPES[e]) {
    return [label("صورة"), { type: "image", source: { type: "base64", media_type: IMAGE_TYPES[e], data: att.data } }];
  }
  if (e === "pdf") {
    return [label("PDF"), { type: "document", source: { type: "base64", media_type: "application/pdf", data: att.data }, title: att.name, citations: { enabled: false } }];
  }
  let text: string;
  let kind: string;
  if (e === "docx") {
    text = await docxText(bytes);
    kind = "Word";
  } else if (e === "pptx") {
    text = await pptxText(bytes);
    kind = "PowerPoint";
  } else if (e === "xlsx" || e === "xlsm") {
    text = await xlsxText(bytes);
    kind = "Excel";
  } else if (["txt", "md", "csv", "tsv", "json", "log", "xml", "html", "htm", "eml", "ics", "rtf"].includes(e)) {
    text = utf8(bytes);
    kind = e.toUpperCase();
  } else {
    throw new Error(`نوع الملف غير مدعوم: ${att.name}. المدعوم: PDF، Word، Excel، PowerPoint، صور، نصوص.`);
  }
  if (!text.trim()) throw new Error(`تعذّر استخراج نص من ${att.name}.`);
  return [label(kind), { type: "document", source: { type: "text", media_type: "text/plain", data: text.slice(0, 400_000) }, title: att.name, citations: { enabled: false } }];
}

export function attachmentSummary(atts: AttachmentInput[]): string {
  return atts.map((a) => a.name).join("، ");
}
