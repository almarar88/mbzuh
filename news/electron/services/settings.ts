import type { Settings } from "@shared/types";
import { getDb, getSetting, setSetting } from "../db";

export const DEFAULT_SETTINGS: Settings = {
  anthropicApiKey: "",
  model: "claude-opus-5",
  effort: "medium",
  translationProvider: "auto",
  autoTranslate: true,
  autoFetchDetails: true,
  refreshMinutes: 30,
  xBearerToken: "",
  useServerWebSearch: true,
  theme: "dark",
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
  return s.anthropicApiKey.trim() || process.env.ANTHROPIC_API_KEY?.trim() || "";
}

export function ensureDbReady(): void {
  getDb();
}
