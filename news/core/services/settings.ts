import type { Settings } from "@shared/types";
import { getDb, getSetting, setSetting } from "../db";
import { getPlatform } from "../platform";

export const DEFAULT_SETTINGS: Settings = {
  interests: [],
  mutedKeywords: [],
  fontScale: 1,
  showImages: true,
  compactView: false,
  notifyNew: true,
  notifyInterestsOnly: false,
  backgroundRefresh: true,
  onboarded: false,
  anthropicApiKey: "",
  model: "claude-opus-5",
  effort: "medium",
  translationProvider: "auto",
  autoTranslate: true,
  autoFetchDetails: true,
  refreshMinutes: 30,
  xBearerToken: "",
  useServerWebSearch: true,
  theme: "light",
  maxArticleAgeDays: 30,
};

export function loadSettings(): Settings {
  const raw = getSetting("settings", "");
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const next = { ...loadSettings(), ...patch };
  setSetting("settings", JSON.stringify(next));
  return next;
}

/** قيمة مفتاح Anthropic: من الإعدادات أولًا ثم من متغير البيئة. */
export function anthropicKey(): string {
  const s = loadSettings();
  return s.anthropicApiKey.trim() || getPlatform().env("ANTHROPIC_API_KEY")?.trim() || "";
}

export function ensureDbReady(): void {
  getDb();
}
