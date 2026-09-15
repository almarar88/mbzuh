import { contextBridge, ipcRenderer } from "electron";

const ALLOWED_PREFIXES = ["feed:", "sources:", "settings:", "agent:", "system:"];

function assertAllowed(channel: string): void {
  if (!ALLOWED_PREFIXES.some((p) => channel.startsWith(p))) throw new Error(`قناة غير مسموح بها: ${channel}`);
}

contextBridge.exposeInMainWorld("techpulse", {
  invoke: (channel: string, ...args: unknown[]) => {
    assertAllowed(channel);
    return ipcRenderer.invoke(channel, ...args);
  },
  on: (channel: string, listener: (...args: unknown[]) => void) => {
    if (!channel.startsWith("app:")) throw new Error(`قناة غير مسموح بها: ${channel}`);
    const wrapped = (_e: unknown, ...args: unknown[]) => listener(...args);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  },
});
