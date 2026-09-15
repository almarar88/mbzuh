/** قنوات البوابات المدمجة (سطح المكتب). على الجوال تُسجَّل بدائل من طبقة الجوال. */
import type { IpcMain } from "electron";
import { dialog } from "electron";
import { credentialSummary, portals, readCredentials, writeCredentials } from "../services/portals";
import type { PortalConfig, PortalCredential } from "../../shared/portals";

export function registerPortalsIpc(ipcMain: IpcMain): void {
  ipcMain.handle("portal:state", () => portals.state());
  ipcMain.handle("portal:save", (_e, list: PortalConfig[]) => portals.save(list));
  ipcMain.handle("portal:open", (_e, id: string, bounds?: { x: number; y: number; width: number; height: number }) => portals.open(id, bounds));
  ipcMain.handle("portal:bounds", (_e, bounds: { x: number; y: number; width: number; height: number }) => portals.setBounds(bounds));
  ipcMain.handle("portal:hide", () => {
    portals.hide();
    return true;
  });
  ipcMain.handle("portal:visible", (_e, visible: boolean) => {
    portals.setVisible(visible);
    return true;
  });
  ipcMain.handle("portal:navigate", (_e, action: "back" | "forward" | "reload" | "home" | "stop" | "url", url?: string) =>
    portals.navigate(action, url),
  );
  ipcMain.handle("portal:zoom", (_e, direction: "in" | "out" | "reset") => portals.setZoom(direction));
  ipcMain.handle("portal:theme", (_e, id: string, theme: "modern" | "original", dark: boolean) => portals.setTheme(id, theme, dark));
  ipcMain.handle("portal:openExternal", (_e, id?: string) => {
    portals.openExternal(id);
    return true;
  });
  ipcMain.handle("portal:credentials", () => credentialSummary());
  ipcMain.handle("portal:setCredential", (_e, id: string, cred: PortalCredential | null) => {
    const all = readCredentials();
    if (!cred || !cred.username) delete all[id];
    else all[id] = { username: cred.username, password: cred.password ?? all[id]?.password ?? "", autofill: !!cred.autofill, autoSubmit: !!cred.autoSubmit };
    writeCredentials(all);
    return credentialSummary();
  });
  ipcMain.handle("portal:clearSession", async () => {
    const confirm = await dialog.showMessageBox({
      type: "question",
      buttons: ["تسجيل الخروج ومسح الجلسة", "إلغاء"],
      defaultId: 1,
      cancelId: 1,
      title: "مسح جلسة البوابات",
      message: "سيتم حذف ملفات تعريف الارتباط وبيانات الجلسة لكل البوابات وستحتاج لتسجيل الدخول مجددًا.",
    });
    if (confirm.response !== 0) return false;
    await portals.clearSession();
    return true;
  });
}
