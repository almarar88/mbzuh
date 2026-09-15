import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.alcode.techpulse",
  appName: "نبض التقنية",
  webDir: "dist",
  android: {
    // يضبط هوامش المحتوى تلقائيًا مع شريط الحالة والتنقل في وضع الحافة إلى الحافة (Android 15+)
    adjustMarginsForEdgeToEdge: "auto",
    allowMixedContent: false,
  },
  server: {
    androidScheme: "https",
  },
};

export default config;
