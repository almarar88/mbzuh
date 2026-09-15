import type { IpcMain } from "electron";
import type { Settings } from "@shared/types";
import { loadSettings, saveSettings } from "../../core/services/settings";

export function registerSettingsIpc(ipc: IpcMain, onChange: (s: Settings) => void): void {
  ipc.handle("settings:get", () => loadSettings());
  ipc.handle("settings:set", (_e, patch: Partial<Settings>) => {
    const s = saveSettings(patch);
    onChange(s);
    return s;
  });
}
