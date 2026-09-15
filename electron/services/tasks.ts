/** لوحة مهام الإداري (Kanban): إنشاء وتحديث وترتيب المهام وإحصاءاتها. */
import { getDb, logActivity } from "../db";
import { todayISO } from "../../shared/text";
import type { Task, TaskPriority, TaskStats, TaskStatus } from "../../shared/types";

const STATUSES: TaskStatus[] = ["todo", "doing", "done"];
const PRIORITIES: TaskPriority[] = ["low", "normal", "high", "urgent"];

export function listTasks(): Task[] {
  return getDb()
    .prepare("SELECT * FROM tasks ORDER BY CASE status WHEN 'todo' THEN 0 WHEN 'doing' THEN 1 ELSE 2 END, position, id")
    .all() as Task[];
}

export function getTask(id: number): Task | null {
  return (getDb().prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Task | undefined) ?? null;
}

export function createTask(input: Partial<Task> & { title: string }): Task {
  const db = getDb();
  const status = STATUSES.includes(input.status as TaskStatus) ? (input.status as TaskStatus) : "todo";
  const priority = PRIORITIES.includes(input.priority as TaskPriority) ? (input.priority as TaskPriority) : "normal";
  const maxPos = (db.prepare("SELECT COALESCE(MAX(position), 0) AS p FROM tasks WHERE status = ?").get(status) as { p: number }).p;
  const id = Number(
    db
      .prepare(
        `INSERT INTO tasks(title, description, status, priority, due_date, tags, source, source_url, source_portal, position, completed_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        input.title.trim(),
        input.description ?? null,
        status,
        priority,
        input.due_date || null,
        input.tags || null,
        input.source ?? null,
        input.source_url || null,
        input.source_portal || null,
        maxPos + 1,
        status === "done" ? new Date().toISOString() : null,
      ).lastInsertRowid,
  );
  logActivity("task", id, "إضافة مهمة", input.title.trim());
  return getTask(id)!;
}

export function updateTask(id: number, patch: Partial<Task>): Task | null {
  const db = getDb();
  const current = getTask(id);
  if (!current) return null;
  const status = STATUSES.includes(patch.status as TaskStatus) ? (patch.status as TaskStatus) : current.status;
  const priority = PRIORITIES.includes(patch.priority as TaskPriority) ? (patch.priority as TaskPriority) : current.priority;
  const completed =
    status === "done" ? current.completed_at ?? new Date().toISOString() : null;
  db.prepare(
    `UPDATE tasks SET title=@title, description=@description, status=@status, priority=@priority, due_date=@due_date,
            tags=@tags, source_url=@source_url, source_portal=@source_portal, position=@position, completed_at=@completed_at, updated_at=datetime('now') WHERE id=@id`,
  ).run({
    id,
    title: (patch.title ?? current.title).trim() || current.title,
    description: patch.description === undefined ? current.description : patch.description,
    status,
    priority,
    due_date: patch.due_date === undefined ? current.due_date : patch.due_date || null,
    tags: patch.tags === undefined ? current.tags : patch.tags || null,
    source_url: patch.source_url === undefined ? current.source_url : patch.source_url || null,
    source_portal: patch.source_portal === undefined ? current.source_portal : patch.source_portal || null,
    position: patch.position ?? current.position,
    completed_at: completed,
  });
  if (status !== current.status) logActivity("task", id, status === "done" ? "إنجاز مهمة" : "نقل مهمة", current.title);
  return getTask(id);
}

/** يعيد ترتيب عمود كامل بعد السحب والإفلات. */
export function reorderTasks(status: TaskStatus, orderedIds: number[]): void {
  const db = getDb();
  const stmt = db.prepare(
    "UPDATE tasks SET status = ?, position = ?, completed_at = CASE WHEN ? = 'done' THEN COALESCE(completed_at, datetime('now')) ELSE NULL END, updated_at = datetime('now') WHERE id = ?",
  );
  db.transaction(() => {
    orderedIds.forEach((id, i) => stmt.run(status, i + 1, status, id));
  })();
}

export function deleteTask(id: number): boolean {
  getDb().prepare("DELETE FROM tasks WHERE id = ?").run(id);
  return true;
}

export function taskStats(): TaskStats {
  const db = getDb();
  const today = todayISO();
  const row = (sql: string, ...p: unknown[]) => (db.prepare(sql).get(...p) as { n: number }).n;
  return {
    todo: row("SELECT COUNT(*) AS n FROM tasks WHERE status = 'todo'"),
    doing: row("SELECT COUNT(*) AS n FROM tasks WHERE status = 'doing'"),
    done: row("SELECT COUNT(*) AS n FROM tasks WHERE status = 'done'"),
    overdue: row("SELECT COUNT(*) AS n FROM tasks WHERE status <> 'done' AND due_date IS NOT NULL AND due_date < ?", today),
    dueToday: row("SELECT COUNT(*) AS n FROM tasks WHERE status <> 'done' AND due_date = ?", today),
  };
}
