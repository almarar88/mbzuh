import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./lib/api";
import { useUi } from "./components/ui";
import { Icon, type IconName } from "./components/icons";
import type { SearchHit, TaskStats } from "@shared/types";
import { WEEKDAY_NAMES } from "@shared/text";
import { isMobileRuntime } from "./platform/runtime";
import DashboardPage from "./pages/Dashboard";
import PortalsPage from "./pages/Portals";
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
import logoUrl from "./assets/logo.png";

export type PageId =
  | "dashboard" | "portals" | "assistant" | "tasks" | "minutes"
  | "trainers" | "courses" | "schedule" | "rooms"
  | "partners" | "students" | "reports" | "settings";

export interface NavPayload {
  page: PageId;
  focusId?: number;
  query?: string;
}

type NavItem = { id: PageId; label: string; icon: IconName; hint?: string };

const CORE: NavItem[] = [
  { id: "dashboard", label: "الرئيسية", icon: "home" },
  { id: "portals", label: "البوابات", icon: "globe", hint: "Ctrl 2" },
  { id: "assistant", label: "المساعد الذكي", icon: "sparkles", hint: "Ctrl J" },
  { id: "tasks", label: "مهامي", icon: "tasks", hint: "Ctrl 4" },
  { id: "minutes", label: "المحاضر والملاحظات", icon: "minutes" },
];

const COURSES: NavItem[] = [
  { id: "courses", label: "الدورات والمستويات", icon: "book" },
  { id: "trainers", label: "المدربون", icon: "users" },
  { id: "schedule", label: "الجدول وكاشف التعارض", icon: "calendar" },
  { id: "rooms", label: "القاعات والحجوزات", icon: "building" },
  { id: "partners", label: "الجهات الشريكة", icon: "handshake" },
  { id: "students", label: "الطلبة والحضور", icon: "graduate" },
  { id: "reports", label: "التقارير", icon: "chart" },
];

const SYSTEM: NavItem[] = [{ id: "settings", label: "الإعدادات", icon: "settings" }];

const ENTITY_PAGE: Record<SearchHit["entity"], PageId> = { trainer: "trainers", course: "courses", minute: "minutes", partner: "partners", student: "students", room: "rooms" };
const ENTITY_LABEL: Record<SearchHit["entity"], string> = { trainer: "مدرب", course: "دورة", minute: "محضر", partner: "جهة", student: "طالب", room: "قاعة" };

const QUICK_ACTIONS: { label: string; page: PageId; icon: IconName }[] = [
  { label: "افتح البوابات", page: "portals", icon: "globe" },
  { label: "اسأل المساعد الذكي", page: "assistant", icon: "sparkles" },
  { label: "مهامي", page: "tasks", icon: "tasks" },
  { label: "محضر جديد", page: "minutes", icon: "minutes" },
  { label: "إصدار تقرير", page: "reports", icon: "chart" },
];

const COURSE_PAGES = new Set<PageId>(COURSES.map((c) => c.id));

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
  const greg = useMemo(() => new Intl.DateTimeFormat("ar-AE-u-nu-latn", { day: "numeric", month: "long", year: "numeric" }).format(now), [now]);
  const time = useMemo(() => new Intl.DateTimeFormat("ar-AE-u-nu-latn", { hour: "2-digit", minute: "2-digit" }).format(now), [now]);
  return { now, hijri, greg, time, weekday: WEEKDAY_NAMES[now.getDay()] };
}

/** تخطيط متجاوب: شريط جانبي كامل / شريط أيقونات / شريط سفلي (هواتف وشاشات الطي المغلقة). */
function useLayout(): "full" | "rail" | "compact" {
  const calc = () => (window.innerWidth < 720 ? "compact" : window.innerWidth < 1080 ? "rail" : "full");
  const [layout, setLayout] = useState<"full" | "rail" | "compact">(calc);
  useEffect(() => {
    const on = () => setLayout(calc());
    window.addEventListener("resize", on);
    window.addEventListener("mbzuh:posture", on);
    return () => {
      window.removeEventListener("resize", on);
      window.removeEventListener("mbzuh:posture", on);
    };
  }, []);
  useEffect(() => {
    document.documentElement.setAttribute("data-layout", layout);
  }, [layout]);
  return layout;
}

export default function App() {
  const { toast } = useUi();
  const mobile = isMobileRuntime();
  const layout = useLayout();
  const [nav, setNav] = useState<NavPayload>({ page: "dashboard" });
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [orgName, setOrgName] = useState("جامعة محمد بن زايد للعلوم الإنسانية");
  const [conflictCount, setConflictCount] = useState(0);
  const [taskStats, setTaskStats] = useState<TaskStats | null>(null);
  const [coursesOpen, setCoursesOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [cursor, setCursor] = useState(0);
  const [newTaskSignal, setNewTaskSignal] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const clock = useClock();

  const go = useCallback((page: PageId, focusId?: number, q?: string) => {
    setNav({ page, focusId, query: q });
    setPaletteOpen(false);
    setMoreOpen(false);
    if (COURSE_PAGES.has(page)) setCoursesOpen(true);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const refreshChrome = useCallback(async () => {
    try {
      const [settings, conflicts, tasks] = await Promise.all([api.settings.all(), api.conflicts.all(), api.tasks.list()]);
      if (settings.theme === "light" || settings.theme === "dark") setTheme(settings.theme);
      if (settings.org_name) setOrgName(settings.org_name);
      if (settings.courses_open === "1") setCoursesOpen(true);
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
      if (e.key === "Escape") {
        setPaletteOpen(false);
        setMoreOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  // البوابة المدمجة تُرسم فوق الواجهة؛ نخفيها عند فتح لوحة البحث أو القائمة.
  useEffect(() => {
    if (nav.page === "portals" && !mobile) void api.portal.visible(!(paletteOpen || moreOpen));
  }, [paletteOpen, moreOpen, nav.page, mobile]);

  useEffect(() => {
    if (paletteOpen) setTimeout(() => inputRef.current?.focus(), 30);
    else {
      setQuery("");
      setHits([]);
      setCursor(0);
    }
  }, [paletteOpen]);

  useEffect(() => {
    if (!paletteOpen) return;
    const t = window.setTimeout(async () => {
      if (query.trim().length < 1) return setHits([]);
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
      case "portals":
        return <PortalsPage initialId={nav.query} onNavigate={go} />;
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
  const isPortals = nav.page === "portals";
  const badgeFor = (id: PageId) =>
    id === "schedule" && conflictCount > 0
      ? { n: conflictCount, tone: "var(--danger)" }
      : id === "tasks" && openTasks > 0
        ? { n: openTasks, tone: taskStats && taskStats.overdue > 0 ? "var(--danger)" : "var(--c-purple)" }
        : null;

  const renderItem = (item: NavItem) => {
    const on = nav.page === item.id;
    const badge = badgeFor(item.id);
    return (
      <button key={item.id} onClick={() => go(item.id)} className={`nav-item mb-1 ${on ? "on" : ""}`} title={item.label}>
        <span className="nav-icon">
          <Icon name={item.icon} />
        </span>
        <span className="nav-label flex-1 truncate text-[13.5px]">{item.label}</span>
        {badge && (
          <span className="nav-badge" style={{ background: badge.tone }}>
            {badge.n}
          </span>
        )}
        {!badge && item.hint && !on && <span className="nav-hint text-[10px] opacity-50">{item.hint}</span>}
      </button>
    );
  };

  const bottomItems: NavItem[] = [CORE[0], CORE[1], CORE[2], CORE[3]];
  const moreItems: NavItem[] = [CORE[4], ...COURSES, ...SYSTEM];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="px-4 pt-4 pb-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center shrink-0"
              style={{ width: 46, height: 46, borderRadius: 16, background: "linear-gradient(135deg,#ffffff,#f3eee3)", padding: 3 }}
            >
              <img src={logoUrl} alt="شعار الجامعة" width={40} height={40} style={{ display: "block" }} />
            </div>
            <div className="min-w-0 brand-text">
              <div className="font-extrabold leading-tight text-[15px]">منصّة الإداري</div>
              <div className="text-[11px] truncate leading-tight mt-0.5" style={{ color: "var(--muted)" }} title={orgName}>
                {orgName}
              </div>
            </div>
          </div>
          <button className="search-pill mt-3 brand-text" onClick={() => setPaletteOpen(true)} style={{ padding: "9px 14px" }}>
            <Icon name="search" size={15} />
            <span className="flex-1 text-[13px]">بحث أو إجراء سريع…</span>
            <span className="text-[10.5px] opacity-70">Ctrl K</span>
          </button>
        </div>

        <nav className="flex-1 scroll-y px-3 py-2">
          <div className="nav-group-title">مركز العمل</div>
          {CORE.map(renderItem)}
          <button
            className="nav-group-title w-full"
            style={{ background: "none", border: "none", cursor: "pointer" }}
            onClick={async () => {
              const next = !coursesOpen;
              setCoursesOpen(next);
              await api.settings.set("courses_open", next ? "1" : "0");
            }}
          >
            <span>إدارة الدورات</span>
            <Icon name="chevronDown" size={14} style={{ transform: coursesOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
          </button>
          {(coursesOpen || layout === "rail") && COURSES.map(renderItem)}
          <div className="nav-group-title">النظام</div>
          {SYSTEM.map(renderItem)}
        </nav>

        <div className="px-3 py-3" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 sidebar-footer-text">
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
        </div>
      </aside>

      <main className={`flex-1 min-w-0 flex flex-col ${isPortals && !mobile ? "" : "main-scroll scroll-y"}`}>
        {/* شريط علوي للهاتف */}
        <div className="topbar glass items-center gap-2 px-4 py-2.5 sticky top-0 z-40" style={{ borderBottom: "1px solid var(--border)" }}>
          <img src={logoUrl} alt="" width={30} height={30} style={{ background: "#fff", borderRadius: 10, padding: 2 }} />
          <div className="min-w-0 flex-1">
            <div className="font-extrabold text-[14px] leading-tight">منصّة الإداري</div>
            <div className="text-[10.5px] truncate" style={{ color: "var(--muted)" }}>
              {clock.weekday} · {clock.greg}
            </div>
          </div>
          <button className="btn btn-icon btn-sm" onClick={() => setPaletteOpen(true)} title="بحث">
            <Icon name="search" size={16} />
          </button>
          <button className="btn btn-icon btn-sm" onClick={toggleTheme} title="المظهر">
            <Icon name={theme === "dark" ? "sun" : "moon"} size={16} />
          </button>
        </div>
        {isPortals && !mobile ? page : <div className="p-4 md:p-6 max-w-[1560px] mx-auto w-full">{page}</div>}
      </main>

      {/* شريط سفلي للهاتف */}
      <nav className="bottom-nav">
        {bottomItems.map((item) => {
          const on = nav.page === item.id;
          const badge = badgeFor(item.id);
          return (
            <button key={item.id} className={`bottom-item ${on ? "on" : ""}`} onClick={() => go(item.id)}>
              <span className="bi">
                <Icon name={item.icon} size={20} />
              </span>
              <span>{item.label}</span>
              {badge && (
                <span className="nav-badge" style={{ background: badge.tone }}>
                  {badge.n}
                </span>
              )}
            </button>
          );
        })}
        <button className={`bottom-item ${moreItems.some((m) => m.id === nav.page) ? "on" : ""}`} onClick={() => setMoreOpen(true)}>
          <span className="bi">
            <Icon name="more" size={20} />
          </span>
          <span>المزيد</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setMoreOpen(false)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="nav-group-title">مركز العمل</div>
            {[CORE[4]].map(renderItem)}
            <div className="nav-group-title">إدارة الدورات</div>
            {COURSES.map(renderItem)}
            <div className="nav-group-title">النظام</div>
            {SYSTEM.map(renderItem)}
            <div className="text-center text-[11px] mt-3" style={{ color: "var(--muted)" }}>
              {clock.greg} · {clock.hijri} · تطوير Alcode
            </div>
          </div>
        </div>
      )}

      {paletteOpen && (
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setPaletteOpen(false)}>
          <div className="panel modal-card pop w-full" style={{ maxWidth: 680 }}>
            <div className="flex items-center gap-2 px-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <Icon name="search" size={18} style={{ color: "var(--muted)" }} />
              <input
                ref={inputRef}
                className="input"
                style={{ border: "none", background: "transparent", padding: "14px 6px", boxShadow: "none" }}
                placeholder="ابحث في السجلات… أو اكتب سؤالًا للمساعد"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") setCursor((c) => Math.min(c + 1, hits.length - 1));
                  if (e.key === "ArrowUp") setCursor((c) => Math.max(c - 1, 0));
                  if (e.key === "Enter" && hits[cursor]) go(ENTITY_PAGE[hits[cursor].entity], hits[cursor].id);
                  if (e.key === "Enter" && !hits.length && query.trim()) go("assistant", undefined, query.trim());
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
                      لا توجد نتائج مطابقة. اضغط Enter لسؤال <span style={{ color: "var(--accent)" }}>المساعد الذكي</span> عن «{query}».
                    </>
                  ) : (
                    "اكتب كلمة للبحث في كل السجلات، أو اختر إجراءً سريعًا."
                  )}
                </p>
              ) : (
                hits.map((hit, i) => (
                  <button
                    key={`${hit.entity}-${hit.id}`}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => go(ENTITY_PAGE[hit.entity], hit.id)}
                    className="w-full text-start px-4 py-2.5 flex items-start gap-3"
                    style={{ background: i === cursor ? "var(--panel-2)" : "transparent", border: "none", cursor: "pointer", borderBottom: "1px solid color-mix(in srgb, var(--border) 60%, transparent)" }}
                  >
                    <span className="badge badge-info mt-0.5">{ENTITY_LABEL[hit.entity]}</span>
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
