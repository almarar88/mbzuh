/**
 * أجندة اليوم: تجمع في قائمة واحدة مهام الإداري (المستحقة والمتأخرة)، حصص الدورات،
 * وحجوزات القاعات لتاريخ معيّن — تُعرض على الرئيسية ويقرأها المساعد.
 */
import { getDb } from "../db";
import { todayISO } from "../../shared/text";
import type { AgendaItem } from "../../shared/types";

const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

export function agendaFor(date = todayISO()): AgendaItem[] {
  const db = getDb();
  const weekday = new Date(`${date}T00:00:00`).getDay();
  const items: AgendaItem[] = [];

  const tasks = db
    .prepare("SELECT id, title, priority, due_date FROM tasks WHERE status <> 'done' AND due_date IS NOT NULL AND due_date <= ? ORDER BY due_date, priority DESC")
    .all(date) as { id: number; title: string; priority: string; due_date: string }[];
  for (const t of tasks) {
    items.push({
      kind: "task",
      id: t.id,
      title: t.title,
      time: null,
      subtitle: t.due_date < date ? `متأخرة منذ ${t.due_date}` : "مستحقة اليوم",
      tone: t.due_date < date || t.priority === "urgent" ? "danger" : t.priority === "high" ? "warn" : "default",
    });
  }

  const sessions = db
    .prepare(
      `SELECT s.start_min, s.end_min, c.id, c.code, c.title, t.name AS trainer, r.name AS room
         FROM course_sessions s JOIN courses c ON c.id = s.course_id
         LEFT JOIN trainers t ON t.id = c.trainer_id LEFT JOIN rooms r ON r.id = c.room_id
        WHERE s.weekday = ? AND c.status IN ('active','planned') AND c.start_date <= ? AND c.end_date >= ?
        ORDER BY s.start_min`,
    )
    .all(weekday, date, date) as { start_min: number; end_min: number; id: number; code: string; title: string; trainer: string | null; room: string | null }[];
  for (const s of sessions) {
    items.push({
      kind: "session",
      id: s.id,
      title: `${s.code} · ${s.title}`,
      time: `${hhmm(s.start_min)}–${hhmm(s.end_min)}`,
      subtitle: [s.trainer, s.room].filter(Boolean).join(" · "),
      tone: "info",
    });
  }

  const bookings = db
    .prepare(
      `SELECT b.id, b.title, b.start_min, b.end_min, b.kind, r.name AS room
         FROM bookings b JOIN rooms r ON r.id = b.room_id WHERE b.date = ? AND b.status <> 'cancelled' ORDER BY b.start_min`,
    )
    .all(date) as { id: number; title: string; start_min: number; end_min: number; kind: string; room: string }[];
  for (const b of bookings) {
    items.push({ kind: "booking", id: b.id, title: b.title, time: `${hhmm(b.start_min)}–${hhmm(b.end_min)}`, subtitle: `${b.room}${b.kind === "external" ? " · جهة خارجية" : ""}`, tone: "default" });
  }

  return items.sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));
}
