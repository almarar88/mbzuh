/**
 * تنفيذ Db بـ sql.js (SQLite مُجمَّع إلى WASM) للمتصفح وأندرويد.
 * القاعدة تعيش في الذاكرة وتُحفظ إلى ملف عبر دالة persist مُمرَّرة (Capacitor Filesystem).
 */
import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import { initSchema, setDb, type Db, type RunResult, type Stmt } from "@core/db";

export interface PersistHooks {
  load(): Promise<Uint8Array | null>;
  save(bytes: Uint8Array): Promise<void>;
}

let sqlStatic: SqlJsStatic | null = null;

/* eslint-disable @typescript-eslint/no-explicit-any */
type Params = any[];

class SqlJsDb implements Db {
  private dirty = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private saving: Promise<void> = Promise.resolve();

  constructor(private readonly raw: Database, private readonly hooks: PersistHooks) {}

  exec(sql: string): void {
    this.raw.exec(sql);
    this.markDirty();
  }

  prepare(sql: string): Stmt {
    const raw = this.raw;
    const isWrite = /^\s*(INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER)/i.test(sql);
    const self = this;
    return {
      run(...params: Params): RunResult {
        raw.run(sql, params);
        const changes = raw.getRowsModified();
        const idRow = raw.exec("SELECT last_insert_rowid() AS id");
        const lastInsertRowid = Number(idRow[0]?.values[0]?.[0] ?? 0);
        if (isWrite) self.markDirty();
        return { changes, lastInsertRowid };
      },
      get(...params: Params): any {
        const stmt = raw.prepare(sql);
        try {
          stmt.bind(params);
          return stmt.step() ? stmt.getAsObject() : undefined;
        } finally {
          stmt.free();
        }
      },
      all(...params: Params): any[] {
        const stmt = raw.prepare(sql);
        const rows: any[] = [];
        try {
          stmt.bind(params);
          while (stmt.step()) rows.push(stmt.getAsObject());
        } finally {
          stmt.free();
        }
        return rows;
      },
    };
  }

  transaction<T>(fn: () => T): T {
    this.raw.exec("BEGIN");
    try {
      const r = fn();
      this.raw.exec("COMMIT");
      this.markDirty();
      return r;
    } catch (e) {
      try {
        this.raw.exec("ROLLBACK");
      } catch {
        /* تجاهل */
      }
      throw e;
    }
  }

  close(): void {
    void this.flush();
    this.raw.close();
  }

  private markDirty(): void {
    this.dirty = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), 1500);
  }

  /** يحفظ القاعدة إلى التخزين الدائم إن تغيّرت. */
  flush(): Promise<void> {
    if (!this.dirty) return this.saving;
    this.dirty = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const bytes = this.raw.export();
    this.saving = this.saving.then(() => this.hooks.save(bytes)).catch((e) => console.error("db save failed", e));
    return this.saving;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

let current: SqlJsDb | null = null;

export async function openSqlJsDb(hooks: PersistHooks, wasmUrl: string): Promise<SqlJsDb> {
  if (!sqlStatic) sqlStatic = await initSqlJs({ locateFile: () => wasmUrl });
  const existing = await hooks.load();
  const raw = existing && existing.length > 0 ? new sqlStatic.Database(existing) : new sqlStatic.Database();
  raw.exec("PRAGMA foreign_keys = ON");
  current = new SqlJsDb(raw, hooks);
  setDb(current);
  initSchema();
  return current;
}

export function flushSqlJsDb(): Promise<void> {
  return current ? current.flush() : Promise.resolve();
}
