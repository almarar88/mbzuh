/** تنفيذ Db بوحدة node:sqlite المدمجة في Electron (بلا وحدات أصلية). */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { initSchema, setDb, type Db, type Stmt } from "../../core/db";

class NodeDb implements Db {
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

let current: NodeDb | null = null;

export function openNodeDb(dbPath: string): Db {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const raw = new DatabaseSync(dbPath);
  raw.exec("PRAGMA journal_mode = WAL");
  raw.exec("PRAGMA foreign_keys = ON");
  raw.exec("PRAGMA busy_timeout = 4000");
  current = new NodeDb(raw);
  setDb(current);
  initSchema();
  return current;
}

export function closeNodeDb(): void {
  current?.close();
  current = null;
  setDb(null);
}
