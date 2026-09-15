/**
 * طبقة قاعدة البيانات المحلية (SQLite عبر node:sqlite المدمجة في Electron).
 * مسار الملف قابل للتهيئة كي تعمل الخدمات خارج Electron في اختبارات الدخان.
 */
import path from "node:path";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { SCHEMA_SQL, SCHEMA_VERSION } from "./schema";

export interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

export interface Stmt {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  run(...params: any[]): RunResult;
  get(...params: any[]): any;
  all(...params: any[]): any[];
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

export class Db {
  constructor(private readonly raw: DatabaseSync) {}

  exec(sql: string): void {
    this.raw.exec(sql);
  }

  prepare(sql: string): Stmt {
    const stmt = this.raw.prepare(sql);
    return {
      run: (...params) => {
        const res = stmt.run(...params);
        return { changes: Number(res.changes), lastInsertRowid: Number(res.lastInsertRowid) };
      },
      get: (...params) => stmt.get(...params),
      all: (...params) => stmt.all(...params),
    };
  }

  transaction<T>(fn: () => T): T {
    this.raw.exec("BEGIN");
    try {
      const result = fn();
      this.raw.exec("COMMIT");
      return result;
    } catch (error) {
      try {
        this.raw.exec("ROLLBACK");
      } catch {
        /* المعاملة أُغلقت مسبقًا */
      }
      throw error;
    }
  }

  close(): void {
    this.raw.close();
  }
}

let db: Db | null = null;
let dbPath: string | null = null;

export function configureDbPath(p: string): void {
  dbPath = p;
}

export function getDb(): Db {
  if (db) return db;
  if (!dbPath) throw new Error("لم يُحدَّد مسار قاعدة البيانات");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const raw = new DatabaseSync(dbPath);
  raw.exec("PRAGMA journal_mode = WAL");
  raw.exec("PRAGMA foreign_keys = ON");
  raw.exec("PRAGMA busy_timeout = 4000");
  db = new Db(raw);
  db.exec(SCHEMA_SQL);
  db.prepare("INSERT OR IGNORE INTO meta(key, value) VALUES ('schema_version', ?)").run(String(SCHEMA_VERSION));
  return db;
}

export function closeDb(): void {
  db?.close();
  db = null;
}

export function getSetting(key: string, fallback = ""): string {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row ? row.value : fallback;
}

export function setSetting(key: string, value: string): void {
  getDb()
    .prepare("INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, value);
}

export function nowIso(): string {
  return new Date().toISOString();
}
