/**
 * بديل لـ node:sqlite على الجوال/المتصفح مبني على sql.js (SQLite مُترجَم إلى WASM).
 * يوفّر واجهة DatabaseSync المستخدمة في طبقة البيانات (prepare().run/get/all،
 * exec، close) ودالة backup، مع حفظ تلقائي لملف القاعدة في نظام الملفات الافتراضي
 * بعد كل تعديل (مؤجَّل نصف ثانية).
 */
import initSqlJs, { type Database, type SqlJsStatic, type SqlValue } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { existsSync, readBytes, writeFileSync } from "./node-fs";

let SQL: SqlJsStatic | null = null;

/** يُستدعى مرة قبل إنشاء أي قاعدة. */
export async function initSqlite(): Promise<void> {
  if (SQL) return;
  SQL = await initSqlJs({ locateFile: () => wasmUrl });
}

type Params = unknown[];

function bindable(params: Params): SqlValue[] | Record<string, SqlValue> | undefined {
  if (params.length === 0) return undefined;
  if (params.length === 1 && params[0] && typeof params[0] === "object" && !Array.isArray(params[0]) && !(params[0] instanceof Uint8Array)) {
    const obj = params[0] as Record<string, unknown>;
    const out: Record<string, SqlValue> = {};
    for (const [k, v] of Object.entries(obj)) out[k.startsWith("@") || k.startsWith(":") || k.startsWith("$") ? k : `@${k}`] = coerce(v);
    return out;
  }
  return params.map(coerce);
}

function coerce(v: unknown): SqlValue {
  if (v === undefined) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v instanceof Date) return v.toISOString();
  if (v === null || typeof v === "number" || typeof v === "string" || v instanceof Uint8Array) return v;
  return String(v);
}

export class DatabaseSync {
  private db: Database;
  private path: string;
  private saveTimer: number | null = null;
  private writes = 0;

  constructor(path: string) {
    if (!SQL) throw new Error("sql.js لم يُهيَّأ بعد — استدعِ initSqlite() أولًا");
    this.path = path;
    const bytes = existsSync(path) ? readBytes(path) : null;
    this.db = bytes ? new SQL.Database(bytes) : new SQL.Database();
  }

  private scheduleSave(): void {
    this.writes++;
    if (this.saveTimer !== null) return;
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      this.persist();
    }, 500);
  }

  persist(): void {
    try {
      writeFileSync(this.path, this.db.export());
    } catch {
      /* تجاهل */
    }
  }

  exec(sql: string): void {
    this.db.exec(sql);
    if (!/^\s*(PRAGMA|SELECT|BEGIN|COMMIT|ROLLBACK)/i.test(sql) || /CREATE|INSERT|UPDATE|DELETE|DROP|ALTER/i.test(sql)) this.scheduleSave();
  }

  prepare(sql: string) {
    const db = this.db;
    const self = this;
    const isWrite = /^\s*(INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER)/i.test(sql);
    return {
      run(...params: Params) {
        const stmt = db.prepare(sql);
        try {
          stmt.run(bindable(params));
        } finally {
          stmt.free();
        }
        const changes = db.getRowsModified();
        const row = db.exec("SELECT last_insert_rowid() AS id");
        const lastInsertRowid = Number(row[0]?.values[0]?.[0] ?? 0);
        if (isWrite) self.scheduleSave();
        return { changes, lastInsertRowid };
      },
      get(...params: Params) {
        const stmt = db.prepare(sql);
        try {
          const b = bindable(params);
          if (b) stmt.bind(b);
          return stmt.step() ? stmt.getAsObject() : undefined;
        } finally {
          stmt.free();
        }
      },
      all(...params: Params) {
        const stmt = db.prepare(sql);
        const out: Record<string, SqlValue>[] = [];
        try {
          const b = bindable(params);
          if (b) stmt.bind(b);
          while (stmt.step()) out.push(stmt.getAsObject());
        } finally {
          stmt.free();
        }
        return out;
      },
    };
  }

  close(): void {
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.persist();
    this.db.close();
  }

  exportBytes(): Uint8Array {
    return this.db.export();
  }
}

/** نسخة احتياطية: تصدير القاعدة إلى ملف في النظام الافتراضي. */
export async function backup(db: DatabaseSync, target: string): Promise<void> {
  writeFileSync(target, db.exportBytes());
}
