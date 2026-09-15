import type { IpcMain } from "electron";
import { shell } from "electron";
import type { FeedQuery } from "@shared/types";
import { aggregator } from "../services/aggregator";
import { addSource, deleteSource, feedStats, getArticle, listArticles, listSources, updateArticle, updateSource, getSource } from "../services/articles";
import { classify } from "../services/classify";

export function registerNewsIpc(ipc: IpcMain): void {
  ipc.handle("feed:list", (_e, q: FeedQuery) => listArticles(q ?? {}));
  ipc.handle("feed:get", (_e, id: number) => getArticle(Number(id)));
  ipc.handle("feed:stats", () => feedStats({ lastRefreshAt: aggregator.lastRefreshAt, refreshing: aggregator.refreshing }));
  ipc.handle("feed:markRead", (_e, id: number, read: boolean) => updateArticle(Number(id), { read: read ? 1 : 0 }));
  ipc.handle("feed:save", (_e, id: number, saved: boolean) => updateArticle(Number(id), { saved: saved ? 1 : 0 }));
  ipc.handle("feed:details", (_e, id: number, force?: boolean) => aggregator.fetchDetails(Number(id), Boolean(force)));
  ipc.handle("feed:translate", (_e, id: number, includeContent?: boolean) => aggregator.translateArticle(Number(id), Boolean(includeContent)));
  ipc.handle("feed:analyze", (_e, id: number, force?: boolean) => aggregator.analyze(Number(id), Boolean(force)));
  ipc.handle("feed:refresh", (_e, sourceIds?: number[]) => aggregator.refreshAll(sourceIds));
  ipc.handle("feed:related", (_e, id: number) => {
    const a = getArticle(Number(id));
    if (!a) return [];
    const terms = (a.tags.length ? a.tags.slice(0, 2) : [a.title.split(" ").slice(0, 3).join(" ")]).join(" ");
    return listArticles({ search: terms.split(" ")[0], limit: 8 }).filter((x) => x.id !== a.id).slice(0, 6);
  });
  ipc.handle("feed:openExternal", (_e, url: string) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
  });
  ipc.handle("feed:classify", (_e, title: string, body: string) => classify(title, body));

  ipc.handle("sources:list", () => listSources());
  ipc.handle("sources:add", (_e, s: { kind: string; name: string; target: string; lang: string; techOnly: boolean }) => addSource(s));
  ipc.handle("sources:update", (_e, id: number, patch: Record<string, unknown>) => updateSource(Number(id), patch));
  ipc.handle("sources:delete", (_e, id: number) => deleteSource(Number(id)));
  ipc.handle("sources:test", async (_e, id: number) => {
    const s = getSource(Number(id));
    if (!s) throw new Error("المصدر غير موجود");
    const items = await aggregator.fetchSource(s, "");
    return { count: items.length, sample: items.slice(0, 3).map((i) => i.title) };
  });
}
