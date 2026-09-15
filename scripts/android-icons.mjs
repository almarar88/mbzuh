/** يولّد أيقونة أندرويد التكيفية (الطبقة الأمامية) من شعار الجامعة. */
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const SIZE = 432; // الحجم القياسي للطبقة الأمامية (108dp × 4)
const LOGO = Math.round(SIZE * 0.62);
const outDir = "android/app/src/main/res/drawable-nodpi";
mkdirSync(outDir, { recursive: true });

const logo = await sharp("build/logo-source.png").resize(LOGO, LOGO, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: logo, left: Math.round((SIZE - LOGO) / 2), top: Math.round((SIZE - LOGO) / 2) }])
  .png()
  .toFile(`${outDir}/ic_launcher_foreground.png`);
console.log("ok android foreground icon");
