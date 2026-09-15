/** جسر إلى الكود الأصلي (أندرويد): مزامنة الويدجت والإعدادات وجدولة الجلب في الخلفية. */
import { registerPlugin } from "@capacitor/core";

export interface WidgetItem {
  id: number;
  title: string;
  url: string;
  source: string;
  category: "ai" | "tech";
  publishedAt: string;
  image: string;
}

export interface NativeSettings {
  notifyNew: boolean;
  notifyInterestsOnly: boolean;
  interests: string[];
  muted: string[];
  sources: { name: string; url: string; techOnly: boolean; lang: string }[];
}

export interface TechPulseNativePlugin {
  sync(options: { items: WidgetItem[]; settings: NativeSettings; seenUrls: string[] }): Promise<void>;
  configureBackground(options: { enabled: boolean; minutes: number }): Promise<{ minutes?: number }>;
  runOnceNow(): Promise<void>;
  widgetCount(): Promise<{ count: number }>;
}

export const TechPulseNative = registerPlugin<TechPulseNativePlugin>("TechPulseNative");
