/**
 * يولّد أيقونة التطبيق (build/icon.png + build/icon.ico) من شعار الجامعة
 * build/logo-source.png (خلفية شفافة) موضوعًا على بلاطة بيضاء بزوايا ناعمة.
 */
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const SIZE = 1024;
const LOGO = Math.round(SIZE * 0.8);

const tile = `
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#f3eee3"/>
    </linearGradient>
    <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#d9bb6a"/>
      <stop offset="1" stop-color="#956a28"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${SIZE}" height="${SIZE}" rx="224" fill="url(#bg)"/>
  <rect x="14" y="14" width="${SIZE - 28}" height="${SIZE - 28}" rx="212" fill="none" stroke="url(#ring)" stroke-width="16" opacity="0.9"/>
</svg>`;

const logo = await sharp("build/logo-source.png")
  .resize(LOGO, LOGO, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();

const png1024 = await sharp(Buffer.from(tile))
  .composite([{ input: logo, left: Math.round((SIZE - LOGO) / 2), top: Math.round((SIZE - LOGO) / 2) }])
  .png()
  .toBuffer();
writeFileSync("build/icon.png", png1024);

// ICO بمدخلات PNG (مدعوم منذ Vista).
const sizes = [256, 128, 64, 48, 32, 16];
const entries = [];
for (const s of sizes) {
  entries.push({ s, buf: await sharp(png1024).resize(s, s).png().toBuffer() });
}
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(entries.length, 4);
const dir = [];
let offset = 6 + 16 * entries.length;
for (const e of entries) {
  const d = Buffer.alloc(16);
  d.writeUInt8(e.s === 256 ? 0 : e.s, 0);
  d.writeUInt8(e.s === 256 ? 0 : e.s, 1);
  d.writeUInt8(0, 2);
  d.writeUInt8(0, 3);
  d.writeUInt16LE(1, 4);
  d.writeUInt16LE(32, 6);
  d.writeUInt32LE(e.buf.length, 8);
  d.writeUInt32LE(offset, 12);
  offset += e.buf.length;
  dir.push(d);
}
writeFileSync("build/icon.ico", Buffer.concat([header, ...dir, ...entries.map((e) => e.buf)]));
console.log("ok icon.png", png1024.length, "bytes; icon.ico", offset, "bytes");
