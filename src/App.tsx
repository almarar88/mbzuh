import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./lib/api";
import { useUi } from "./components/ui";
import { Icon, type IconName } from "./components/icons";
import type { SearchHit, TaskStats } from "@shared/types";
import { WEEKDAY_NAMES } from "@shared/text";
import DashboardPage from "./pages/Dashboard";
import UmsPage from "./pages/Ums";
import AssistantPage from "./pages/Assistant";
import TasksPage from "./pages/Tasks";
import TrainersPage from "./pages/Trainers";
import CoursesPage from "./pages/Courses";
import SchedulePage from "./pages/Schedule";
import RoomsPage from "./pages/Rooms";
import PartnersPage from "./pages/Partners";
import StudentsPage from "./pages/Students";
import ReportsPage from "./pages/Reports";
import MinutesPage from "./pages/Minutes";
import SettingsPage from "./pages/Settings";

export type PageId =
  | "dashboard" | "ums" | "assistant" | "tasks"
  | "trainers" | "courses" | "schedule" | "rooms"
  | "partners" | "students" | "reports" | "minutes" | "settings";

export interface NavPayload {
  page: PageId;
  focusId?: number;
  query?: string;
}

const MODULES: { title: string; items: { id: PageId; label: string; icon: IconName; hint?: string }[] }[] = [
  {
    title: "مركز العمل",
    items: [
      { id: "dashboard", label: "الرئيسية", icon: "home" },
      { id: "ums", label: "نظام الجامعة الموحّد UMS", icon: "globe", hint: "Ctrl 2" },
      { id: "assistant", label: "المساعد الذكي", icon: "sparkles", hint: "Ctrl J" },
      { id: "tasks", label: "لوحة المهام", icon: "tasks", hint: "Ctrl 4" },
    ],
  },
  {
    title: "الدورات والمدربون",
    items: [
      { id: "trainers", label: "سجل المدربين", icon: "users" },
      { id: "courses", label: "منسق المستويات", icon: "book" },
      { id: "schedule", label: "الجدول وكاشف التعارض", icon: "calendar" },
    ],
  },
  {
    title: "اللوجستيات والشركاء",
    items: [
      { id: "rooms", label: "القاعات والمرافق", icon: "building" },
      { id: "partners", label: "سجل الشركاء", icon: "handshake" },
    ],
  },
  {
    title: "التقارير والأرشيف",
    items: [
      { id: "students", label: "الطلبة والحضور", icon: "graduate" },
      { id: "reports", label: "مولّد التقارير", icon: "chart" },
      { id: "minutes", label: "أرشيف المحاضر", icon: "minutes" },
    ],
  },
  {
    title: "النظام",
    items: [{ id: "settings", label: "الإعدادات", icon: "settings" }],
  },
];

const ENTITY_PAGE: Record<SearchHit["entity"], PageId> = {
  trainer: "trainers",
  course: "courses",
  minute: "minutes",
  partner: "partners",
  student: "students",
  room: "rooms",
};

const ENTITY_LABEL: Record<SearchHit["entity"], string> = {
  trainer: "مدرب",
  course: "دورة",
  minute: "محضر",
  partner: "جهة",
  student: "طالب",
  room: "قاعة",
};

const QUICK_ACTIONS: { label: string; page: PageId; icon: IconName }[] = [
  { label: "فتح لوحة UMS", page: "ums", icon: "globe" },
  { label: "اسأل المساعد الذكي", page: "assistant", icon: "sparkles" },
  { label: "لوحة المهام", page: "tasks", icon: "tasks" },
  { label: "إصدار تقرير", page: "reports", icon: "chart" },
  { label: "محضر جديد", page: "minutes", icon: "minutes" },
];

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  const hijri = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "long", year: "numeric" }).format(now);
    } catch {
      return "";
    }
  }, [now]);
  const greg = useMemo(
    () => new Intl.DateTimeFormat("ar-AE-u-nu-latn", { day: "numeric", month: "long", year: "numeric" }).format(now),
    [now],
  );
  const time = useMemo(() => new Intl.DateTimeFormat("ar-AE-u-nu-latn", { hour: "2-digit", minute: "2-digit" }).format(now), [now]);
  return { now, hijri, greg, time, weekday: WEEKDAY_NAMES[now.getDay()] };
}

export default function App() {
  const { toast } = useUi();
  const [nav, setNav] = useState<NavPayload>({ page: "dashboard" });
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [orgName, setOrgName] = useState("جامعة محمد بن زايد للعلوم الإنسانية");
  const [conflictCount, setConflictCount] = useState(0);
  const [taskStats, setTaskStats] = useState<TaskStats | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [cursor, setCursor] = useState(0);
  const [newTaskSignal, setNewTaskSignal] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const clock = useClock();

  const go = useCallback((page: PageId, focusId?: number, q?: string) => {
    setNav({ page, focusId, query: q });
    setPaletteOpen(false);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const refreshChrome = useCallback(async () => {
    try {
      const [settings, conflicts, tasks] = await Promise.all([api.settings.all(), api.conflicts.all(), api.tasks.list()]);
      if (settings.theme === "light" || settings.theme === "dark") setTheme(settings.theme);
      if (settings.org_name) setOrgName(settings.org_name);
      setConflictCount(conflicts.filter((c) => c.severity === "error").length);
      setTaskStats(tasks.stats);
    } catch {
      /* أول تشغيل قد يسبق تهيئة القاعدة */
    }
  }, []);

  useEffect(() => {
    void refreshChrome();
    const timer = window.setInterval(() => void refreshChrome(), 30_000);
    return () => window.clearInterval(timer);
  }, [refreshChrome, nav.page]);

  useEffect(() => {
    const offNav = window.dynamo.on("app:navigate", (page) => go(page as PageId));
    const offCmd = window.dynamo.on("app:command", async (cmd) => {
      if (cmd === "search") setPaletteOpen(true);
      if (cmd === "new-task") {
        go("tasks");
        setNewTaskSignal((n) => n + 1);
      }
      if (cmd === "backup") {
        const info = await api.backup.create();
        toast(`تم إنشاء نسخة احتياطية (${Math.round(info.size / 1024)} ك.ب)`, "ok");
      }
    });
    return () => {
      offNav();
      offCmd();
    };
  }, [go, toast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        go("assistant");
      }
      if (e.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  // لوحة UMS تُرسم فوق الواجهة؛ نخفيها عند فتح لوحة البحث.
  useEffect(() => {
    if (nav.page === "ums") void api.ums.visible(!paletteOpen);
  }, [paletteOpen, nav.page]);

  useEffect(() => {
    if (paletteOpen) {
      setTimeout(() => inputRef.current?.focus(), 30);
    } else {
      setQuery("");
      setHits([]);
      setCursor(0);
    }
  }, [paletteOpen]);

  useEffect(() => {
    if (!paletteOpen) return;
    const t = window.setTimeout(async () => {
      if (query.trim().length < 1) {
        setHits([]);
        return;
      }
      setHits(await api.search.global(query.trim()));
      setCursor(0);
    }, 140);
    return () => window.clearTimeout(t);
  }, [query, paletteOpen]);

  const toggleTheme = async () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    await api.settings.set("theme", next);
  };

  const page = useMemo(() => {
    switch (nav.page) {
      case "ums":
        return <UmsPage />;
      case "assistant":
        return <AssistantPage onNavigate={go} initialPrompt={nav.query} />;
      case "tasks":
        return <TasksPage newTaskSignal={newTaskSignal} onNavigate={go} />;
      case "trainers":
        return <TrainersPage focusId={nav.focusId} onNavigate={go} />;
      case "courses":
        return <CoursesPage focusId={nav.focusId} onNavigate={go} />;
      case "schedule":
        return <SchedulePage onNavigate={go} />;
      case "rooms":
        return <RoomsPage focusId={nav.focusId} />;
      case "partners":
        return <PartnersPage focusId={nav.focusId} />;
      case "students":
        return <StudentsPage focusId={nav.focusId} />;
      case "reports":
        return <ReportsPage />;
      case "minutes":
        return <MinutesPage focusId={nav.focusId} trainerId={nav.query ? Number(nav.query) : undefined} onNavigate={go} />;
      case "settings":
        return <SettingsPage onThemeChange={setTheme} onOrgChange={setOrgName} />;
      default:
        return <DashboardPage onNavigate={go} />;
    }
  }, [nav, go, newTaskSignal]);

  const openTasks = taskStats ? taskStats.todo + taskStats.doing : 0;
  const isUms = nav.page === "ums";

  return (
    <div className="h-full flex">
      <aside
        className="w-[268px] shrink-0 flex flex-col glass"
        style={{ borderInlineEnd: "1px solid var(--border)" }}
      >
        <div className="px-4 pt-4 pb-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center shrink-0"
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: "var(--gold-grad)",
                color: "#1a1305",
                boxShadow: "0 8px 20px color-mix(in srgb, var(--accent) 35%, transparent)",
              }}
            >
              <Icon name="book" size={22} />
            </div>
            <div className="min-w-0">
              <div className="font-extrabold leading-tight text-[15px]">منصّة الإداري</div>
              <div className="text-[11px] truncate leading-tight mt-0.5" style={{ color: "var(--muted)" }} title={orgName}>
                {orgName}
              </div>
            </div>
          </div>
          <button
            className="btn btn-sm w-full mt-3 justify-between"
            onClick={() => setPaletteOpen(true)}
            style={{ color: "var(--muted)" }}
          >
            <span className="flex items-center gap-2">
              <Icon name="search" size={14} /> بحث فوري…
            </span>
            <span className="text-[11px] opacity-70">Ctrl K</span>
          </button>
        </div>

        <nav className="flex-1 scroll-y px-3 py-2">
          {MODULES.map((group) => (
            <div key={group.title} className="mb-1">
              <div className="nav-group-title">{group.title}</div>
              {group.items.map((item) => {
                const on = nav.page === item.id;
                const badge =
                  item.id === "schedule" && conflictCount > 0
                    ? { n: conflictCount, tone: "var(--danger)" }
                    : item.id === "tasks" && openTasks > 0
                      ? { n: openTasks, tone: taskStats && taskStats.overdue > 0 ? "var(--danger)" : "var(--accent)" }
                      : null;
                return (
                  <button key={item.id} onClick={() => go(item.id)} className={`nav-item mb-0.5 ${on ? "on" : ""}`}>
                    <span className="nav-icon">
                      <Icon name={item.icon} />
                    </span>
                    <span className="flex-1 truncate text-[13.5px]">{item.label}</span>
                    {badge && (
                      <span
                        className="text-[11px] px-1.5 rounded-full font-bold"
                        style={{ background: badge.tone, color: "#fff", minWidth: 20, textAlign: "center" }}
                      >
                        {badge.n}
                      </span>
                    )}
                    {!badge && item.hint && !on && (
                      <span className="text-[10px] opacity-50">{item.hint}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="px-3 py-3" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="min-w-0">
              <div className="text-[12.5px] font-bold truncate">
                {clock.weekday} · {clock.time}
              </div>
              <div className="text-[11px] truncate" style={{ color: "var(--muted)" }}>
                {clock.greg}
              </div>
              {clock.hijri && (
                <div className="text-[11px] truncate" style={{ color: "var(--muted)" }}>
                  {clock.hijri}
                </div>
              )}
            </div>
            <button className="btn btn-icon" onClick={toggleTheme} title={theme === "dark" ? "الوضع الفاتح" : "الوضع الداكن"}>
              <Icon name={theme === "dark" ? "sun" : "moon"} />
            </button>
          </div>
          <div className="text-center text-[11px]" style={{ color: "var(--muted)" }}>
            تطوير <span style={{ color: "var(--accent)", fontWeight: 700 }}>Alcode</span> · v2.0
          </div>
        </div>
      </aside>

      <main className={`flex-1 min-w-0 ${isUms ? "flex flex-col" : "scroll-y"}`}>
        {isUms ? page : <div className="p-6 max-w-[1560px] mx-auto">{page}</div>}
      </main>

      {paletteOpen && (
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setPaletteOpen(false)}>
          <div className="panel pop w-full" style={{ maxWidth: 680, boxShadow: "var(--shadow)" }}>
            <div className="flex items-center gap-2 px-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <Icon name="search" size={18} style={{ color: "var(--muted)" }} />
              <input
                ref={inputRef}
                className="input"
                style={{ border: "none", background: "transparent", padding: "14px 6px", boxShadow: "none" }}
                placeholder="ابحث في المدربين، الدورات، المحاضر، الشركاء، الطلبة… أو اختر إجراءً سريعًا"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") setCursor((c) => Math.min(c + 1, hits.length - 1));
                  if (e.key === "ArrowUp") setCursor((c) => Math.max(c - 1, 0));
                  if (e.key === "Enter" && hits[cursor]) {
                    const hit = hits[cursor];
                    go(ENTITY_PAGE[hit.entity], hit.id);
                  }
                  if (e.key === "Enter" && !hits.length && query.trim()) {
                    go("assistant", undefined, query.trim());
                  }
                }}
              />
              <span className="text-[11px] opacity-60">Esc</span>
            </div>
            <div className="scroll-y" style={{ maxHeight: 440 }}>
              {!query && (
                <div className="p-3 flex flex-wrap gap-2">
                  {QUICK_ACTIONS.map((a) => (
                    <button key={a.page} className="chip" onClick={() => go(a.page)}>
                      <Icon name={a.icon} size={14} /> {a.label}
                    </button>
                  ))}
                </div>
              )}
              {hits.length === 0 ? (
                <p className="p-6 pt-2 text-center text-sm" style={{ color: "var(--muted)" }}>
                  {query ? (
                    <>
                      لا توجد نتائج مطابقة. اضغط Enter لسؤال{" "}
                      <span style={{ color: "var(--accent)" }}>المساعد الذكي</span> عن «{query}».
                    </>
                  ) : (
                    "اكتب كلمة للبحث في كل وحدات النظام."
                  )}
                </p>
              ) : (
                hits.map((hit, i) => (
                  <button
                    key={`${hit.entity}-${hit.id}`}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => go(ENTITY_PAGE[hit.entity], hit.id)}
                    className="w-full text-start px-4 py-2.5 flex items-start gap-3"
                    style={{
                      background: i === cursor ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent",
                      border: "none",
                      cursor: "pointer",
                      borderBottom: "1px solid color-mix(in srgb, var(--border) 60%, transparent)",
                    }}
                  >
                    <span className="badge badge-accent mt-0.5">{ENTITY_LABEL[hit.entity]}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-sm truncate" style={{ color: "var(--ink)" }}>
                        {hit.title}
                      </span>
                      <span className="block text-xs truncate" style={{ color: "var(--muted)" }}>
                        {hit.subtitle}
                        {hit.snippet ? ` — ${hit.snippet}` : ""}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
