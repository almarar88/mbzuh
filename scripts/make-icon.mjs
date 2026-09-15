/** يولّد أيقونة التطبيق (build/icon.png + build/icon.ico) من رسم SVG أصلي. */
// Generates build/icon.png (1024) and build/icon.ico (multi-size, PNG-compressed entries).
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#14264a"/>
      <stop offset="1" stop-color="#071228"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f3d27a"/>
      <stop offset="0.55" stop-color="#c9a24a"/>
      <stop offset="1" stop-color="#8f6427"/>
    </linearGradient>
    <linearGradient id="page" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff8e6"/>
      <stop offset="1" stop-color="#e9d6a8"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.35" r="0.6">
      <stop offset="0" stop-color="#c9a24a" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#c9a24a" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect x="0" y="0" width="1024" height="1024" rx="224" fill="url(#bg)"/>
  <rect x="0" y="0" width="1024" height="1024" rx="224" fill="url(#glow)"/>
  <!-- pointed arch -->
  <path d="M512 150 C 380 220, 250 330, 250 520 L 250 860 L 774 860 L 774 520 C 774 330, 644 220, 512 150 Z"
        fill="none" stroke="url(#gold)" stroke-width="46" stroke-linejoin="round"/>
  <!-- open book -->
  <path d="M300 620 C 380 590, 460 600, 512 640 C 564 600, 644 590, 724 620 L 724 790 C 644 760, 564 770, 512 810 C 460 770, 380 760, 300 790 Z"
        fill="url(#page)"/>
  <path d="M512 640 L 512 810" stroke="#8f6427" stroke-width="14" stroke-linecap="round"/>
  <path d="M340 665 C 400 648, 450 655, 490 680 M340 715 C 400 698, 450 705, 490 730 M340 765 C 400 748, 450 755, 490 780
           M684 665 C 624 648, 574 655, 534 680 M684 715 C 624 698, 574 705, 534 730 M684 765 C 624 748, 574 755, 534 780"
        stroke="#8f6427" stroke-opacity="0.55" stroke-width="10" stroke-linecap="round" fill="none"/>
  <!-- star -->
  <g transform="translate(512 420)">
    <polygon points="0,-90 26,-36 88,-28 42,14 54,76 0,46 -54,76 -42,14 -88,-28 -26,-36" fill="url(#gold)"/>
  </g>
</svg>`;

const png1024 = await sharp(Buffer.from(svg)).png().toBuffer();
writeFileSync("build/icon.png", png1024);

// ICO with PNG-encoded entries (supported since Vista).
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


console.log("ok", png1024.length);
