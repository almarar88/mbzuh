/**
 * المساعد الذكي — يعمل في العملية الرئيسية (أو داخل المتصفح على الجوال) عبر Anthropic SDK.
 *
 * - المفتاح يُخزَّن محليًا مشفّرًا بـ safeStorage (DPAPI على ويندوز) ولا يغادر الجهاز
 *   إلا إلى واجهة Claude API.
 * - المحادثة تدعم «أدوات» تقرأ بيانات التطبيق (الإحصاءات، البحث، التعارضات، المهام،
 *   المحاضر) وتُنشئ مهامًا وتحدّثها، وتتذكّر حقائق عن المستخدم (الذاكرة)، إضافة إلى
 *   أدوات البوابات والتحكم بالكمبيوتر المسجَّلة من المنصة.
 * - كل رد يُبثّ تدريجيًا إلى الواجهة عبر القناة app:ai.
 * - الروتينات: أوامر محفوظة تُنفَّذ يدويًا أو في وقت محدد يوميًا، والموجز اليومي يجمع
 *   البريد والاجتماعات والمهام في نص واحد.
 */
import Anthropic from "@anthropic-ai/sdk";
import { safeStorage } from "electron";
import { getDb, getSetting, logActivity, setSetting } from "../db";
import { dashboardStats, globalSearch } from "./stats";
import { detectAllConflicts } from "./conflicts";
import { createTask, getTask, listTasks, taskStats, updateTask } from "./tasks";
import { todayISO, WEEKDAY_NAMES } from "../../shared/text";
import { LANGUAGE_LABELS, LEVEL_LABELS } from "../../shared/labels";
import type {
  AiBrief,
  AiChatContext,
  AiEffort,
  AiMemoryFact,
  AiRoutine,
  AiSettings,
  AiStreamEvent,
  AiTemplateId,
  AiTemplateInput,
  ExtractedTask,
  TaskPriority,
  TaskStatus,
} from "../../shared/types";

const DEFAULT_MODEL = "claude-opus-5";
const IS_BROWSER = typeof (globalThis as { document?: unknown }).document !== "undefined";
const PLATFORM: AiSettings["platform"] = IS_BROWSER
  ? "mobile"
  : process.platform === "win32"
    ? "windows"
    : process.platform === "darwin"
      ? "mac"
      : "linux";
const KEY_SETTING = "ai_api_key";
const KEY_ENC_SETTING = "ai_api_key_enc";

/* ------------------------------ المفتاح ------------------------------ */

export function saveApiKey(key: string): AiSettings {
  const trimmed = key.trim();
  if (!trimmed) {
    setSetting(KEY_SETTING, "");
    setSetting(KEY_ENC_SETTING, "");
    return getAiSettings();
  }
  if (safeStorage.isEncryptionAvailable()) {
    setSetting(KEY_ENC_SETTING, safeStorage.encryptString(trimmed).toString("base64"));
    setSetting(KEY_SETTING, "");
  } else {
    setSetting(KEY_SETTING, trimmed);
    setSetting(KEY_ENC_SETTING, "");
  }
  return getAiSettings();
}

function readApiKey(): string {
  const enc = getSetting(KEY_ENC_SETTING, "");
  if (enc) {
    try {
      return safeStorage.decryptString(Buffer.from(enc, "base64"));
    } catch {
      return "";
    }
  }
  return getSetting(KEY_SETTING, "") || process.env.ANTHROPIC_API_KEY || "";
}

export function getAiSettings(): AiSettings {
  const key = readApiKey();
  return {
    hasKey: key.length > 0,
    keyHint: key ? `${key.slice(0, 10)}…${key.slice(-4)}` : "",
    model: getSetting("ai_model", DEFAULT_MODEL) || DEFAULT_MODEL,
    effort: (getSetting("ai_effort", "medium") as AiEffort) || "medium",
    adminName: getSetting("ai_admin_name", ""),
    adminTitle: getSetting("ai_admin_title", ""),
    encrypted: getSetting(KEY_ENC_SETTING, "").length > 0,
    computerControl: getSetting("ai_computer", "0") === "1" && !IS_BROWSER && extraToolsProvider !== null,
    computerAvailable: !IS_BROWSER && extraToolsProvider !== null,
    webSearch: getSetting("ai_web", "1") === "1",
    confirmCommands: getSetting("ai_confirm_cmd", "1") === "1",
    confirmGui: getSetting("ai_confirm_gui", "0") === "1",
    platform: PLATFORM,
  };
}

function getClient(): Anthropic {
  const apiKey = readApiKey();
  if (!apiKey) {
    throw new Error("لم يُضبط مفتاح Claude API بعد. أضفه من الإعدادات ← المساعد الذكي.");
  }
  return new Anthropic({ apiKey, maxRetries: 2, timeout: 5 * 60 * 1000, dangerouslyAllowBrowser: IS_BROWSER });
}

/** معاملات التفكير والجهد حسب النموذج (Haiku 4.5 لا يدعم التفكير التكيفي ولا effort). */
function reasoningParams(model: string, effort: AiEffort) {
  if (model.startsWith("claude-haiku")) return {};
  return {
    thinking: { type: "adaptive" as const },
    output_config: { effort },
  };
}

function friendlyError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) return "مفتاح API غير صالح أو منتهٍ. تحقق منه في الإعدادات.";
  if (error instanceof Anthropic.PermissionDeniedError) return "هذا المفتاح لا يملك صلاحية الوصول للنموذج المختار.";
  if (error instanceof Anthropic.RateLimitError) return "تجاوزنا حدّ الطلبات مؤقتًا. انتظر لحظات ثم أعد المحاولة.";
  if (error instanceof Anthropic.BadRequestError) return `طلب غير مقبول: ${error.message}`;
  if (error instanceof Anthropic.APIConnectionError) return "تعذّر الاتصال بخدمة Claude. تحقق من اتصال الإنترنت.";
  if (error instanceof Anthropic.APIError) return `خطأ من الخدمة (${error.status ?? "?"}): ${error.message}`;
  if (error instanceof Error) {
    if (error.name === "AbortError" || /abort/i.test(error.message)) return "أُلغي الطلب.";
    return error.message;
  }
  return String(error);
}

/* ----------------------------- الذاكرة ----------------------------- */

export function listMemory(): AiMemoryFact[] {
  return getDb().prepare("SELECT * FROM ai_memory ORDER BY id DESC LIMIT 200").all() as AiMemoryFact[];
}

export function addMemory(fact: string, source = "user"): AiMemoryFact[] {
  const clean = fact.trim().slice(0, 400);
  if (clean) {
    const dup = getDb().prepare("SELECT id FROM ai_memory WHERE fact = ?").get(clean);
    if (!dup) getDb().prepare("INSERT INTO ai_memory(fact, source) VALUES(?, ?)").run(clean, source);
  }
  return listMemory();
}

export function deleteMemory(id: number): AiMemoryFact[] {
  getDb().prepare("DELETE FROM ai_memory WHERE id = ?").run(id);
  return listMemory();
}

/* ----------------------------- السياق ----------------------------- */

function orgContext(context?: AiChatContext): string {
  const s = getAiSettings();
  const d = new Date();
  const who = [s.adminName && `اسم المستخدم: ${s.adminName}`, s.adminTitle && `المسمى الوظيفي: ${s.adminTitle}`]
    .filter(Boolean)
    .join("، ");
  const memory = listMemory()
    .slice(0, 60)
    .map((m) => `- ${m.fact}`)
    .join("\n");
  const stats = taskStats();
  const lines = [
    `الجهة: ${getSetting("org_name", "جامعة محمد بن زايد للعلوم الإنسانية")}.`,
    who,
    `تاريخ اليوم: ${todayISO()} (${WEEKDAY_NAMES[d.getDay()]})، الساعة ${d.toTimeString().slice(0, 5)}.`,
    `لوحة المهام الآن: ${stats.todo} للتنفيذ، ${stats.doing} قيد العمل، ${stats.overdue} متأخرة، ${stats.dueToday} مستحقة اليوم.`,
    memory ? `ما تتذكره عن المستخدم وعمله (استخدمه دون أن تعيده حرفيًا):\n${memory}` : "",
  ];
  if (context?.portalId) {
    lines.push(
      `المستخدم الآن داخل بوابة «${context.portalName ?? context.portalId}» (المعرّف ${context.portalId}) على الصفحة: ${context.title ?? ""} — ${context.url ?? ""}. ` +
        "نفّذ طلبه على هذه الصفحة مباشرة بأدوات portal_* (اقرأ الصفحة أولًا بـportal_read_page) دون إعادة فتح البوابة إلا إذا احتجت الانتقال لصفحة أخرى. عند إنشاء مهمة من محتوى الصفحة مرّر رابط الصفحة في source_url ومعرّف البوابة في source_portal.",
    );
  }
  if (context?.scope === "routine") lines.push("هذا تنفيذ آلي لروتين محفوظ: نفّذ التعليمات بالكامل بلا أسئلة، وأنهِ بملخص قصير لما فعلته وما يحتاج انتباه المستخدم.");
  if (context?.scope === "brief") lines.push("أنت تُعدّ «موجز اليوم». اجمع المعلومات بالأدوات ثم اكتب الموجز مباشرة بالتنسيق المطلوب دون مقدمات.");
  return lines.filter(Boolean).join("\n");
}

const CHAT_SYSTEM = `أنت «مساعد الإداري» داخل تطبيق «منصّة الإداري» لموظف إداري في جامعة محمد بن زايد للعلوم الإنسانية (MBZUH) في أبوظبي.

دورك: مساعد تنفيذي وشريك تفكير. تكتب بالعربية الفصحى المبسّطة افتراضيًا (وبالإنجليزية إذا كتب المستخدم بها أو طلبها)، بأسلوب مباشر ومهني يليق بالمراسلات الجامعية الرسمية.

لديك أدوات تقرأ بيانات التطبيق المحلية (إحصاءات الدورات والمدربين والقاعات، البحث في السجلات، التعارضات في الجداول، المهام، محاضر الاجتماعات) وتُنشئ مهامًا وتحدّثها، وتحفظ حقائق مفيدة عن المستخدم في الذاكرة (remember_fact) مثل اسم مديره، مسؤولياته، تفضيلاته، أسماء الجهات التي يتعامل معها — احفظ ما يُفيد في المرات القادمة دون إزعاج، واحذف ما يطلب حذفه. استخدم الأدوات عندما يسأل المستخدم عن بياناته أو يطلب متابعة، ولا تخمّن أرقامًا لم تقرأها من الأدوات. عندما تُنشئ مهمة قل ذلك صراحة.

البوابات الجامعية المدمجة في التطبيق (تستطيع فتحها وقراءتها والتحكم فيها بأدوات portal_*): «ums» نظام الجامعة الموحّد (الطلبة والتسجيل)، «cec» لوحة الدورات Hub (مركز التعليم المستمر)، «outlook» البريد (تصل فيه المهام والمراسلات)، «teams» الاجتماعات ومواعيدها، «sharepoint» بوابة الملفات والسياسات، «onehub» الخدمات الحكومية للموظف (الإجازات وغيرها)، «site» موقع الجامعة. عند سؤال عن البريد أو الاجتماعات أو الإجازات أو الملفات أو الدورات: افتح البوابة المناسبة بـportal_open ثم اقرأها بـportal_read_page (وخذ لقطة portal_screenshot إن كان النص غير كافٍ). لا تقل «لا أستطيع» قبل أن تجرّب الأدوات فعلًا. إن أظهرت القراءة صفحة تسجيل دخول (Sign in / Microsoft) اطلب من المستخدم إتمام الدخول من صفحة «البوابات» ثم أعد القراءة. لا تدخل كلمات مرور بنفسك.
إرشادات عملية:
- Outlook: بعد الفتح انتظر حتى تظهر قائمة الرسائل (portal_read_page يعيد «items» لكل رسالة: المرسل والموضوع والمعاينة). لقراءة رسالة كاملة انقر عليها بـportal_click بجزء من موضوعها ثم اقرأ الصفحة مجددًا بمنطقة selector="[role=main]". للرسائل غير المقروءة انتقل إلى https://outlook.office.com/mail/inbox ثم استخدم الفلاتر إن لزم. مرّر بـportal_scroll لتحميل المزيد. للرد على رسالة: انقر «Reply/رد»، ثم عبّئ نص الرسالة بـportal_fill على حقل [role=textbox]، واعرض المسودة على المستخدم؛ لا تنقر «Send/إرسال» إلا إذا طلب المستخدم الإرسال صراحة.
- الاجتماعات: تقويم Outlook يعرض اجتماعات Teams أيضًا: انتقل إلى https://outlook.office.com/calendar/view/day (أو /week) واقرأ الصفحة؛ أو افتح teams ثم https://teams.microsoft.com/v2/#/calendar.
- SharePoint: استخدم مربع البحث في الصفحة (portal_fill على حقل البحث ثم press_enter) أو انتقل إلى رابط البحث ثم اقرأ النتائج، وافتح الملف/الصفحة المناسبة واقرأها.
- Hub/UMS: اقرأ الجداول من «tables» في نتيجة القراءة، وانتقل بين الصفحات بالنقر على «التالي» أو تعديل معاملات الرابط (page=…).
- بعد كل نقر أو انتقال أعد القراءة لأن الصفحة تغيّرت. إذا لم يظهر المحتوى بعد المحاولة الثانية خذ لقطة لتعرف السبب. إذا أعادت أداة خطأ شهادة/اتصال أخبر المستخدم أن يفتح البوابة من صفحة «البوابات» ويعالج التنبيه هناك.
- عندما تستخرج مهامًا من رسائل بريد أو صفحات، أنشئها بـcreate_task مع source_url (رابط الرسالة/الصفحة) وsource_portal (معرّف البوابة) ليتمكن المستخدم من فتح المصدر بنقرة.
- إجراءات لا رجعة فيها (إرسال بريد، حذف، اعتماد طلب، تقديم نموذج): اعرض ما ستفعله أولًا ولا تنفّذه إلا بطلب صريح من المستخدم.

ابدأ بالجواب أو المسودة مباشرة، دون مقدمات أو مجاملات. للمسودات الرسمية استخدم عناوين واضحة وترتيبًا منطقيًا. لا تفبرك سياسات أو أسماء أو أرقامًا؛ إذا كان أمرٌ يحتاج تأكيدًا من نظام الجامعة الرسمي (UMS) أو من جهة مختصة فاذكر ذلك بوضوح في سطر واحد.`;

const COMPUTER_SYSTEM = `

وضع «التحكم بالكمبيوتر» مفعّل: لديك أدوات لفتح البرامج والملفات والروابط، ورؤية الشاشة (لقطة شاشة)، والنقر بالفأرة والكتابة بلوحة المفاتيح، والتبديل بين النوافذ، وتنفيذ أوامر PowerShell، وقراءة الحافظة والملفات. اتبع هذا الأسلوب:
- قبل أي نقر أو كتابة خذ لقطة شاشة لتعرف ما على الشاشة، ونفّذ خطوة واحدة ثم تحقق بلقطة جديدة عند الحاجة. الإحداثيات التي تُعطيها للنقر هي إحداثيات اللقطة نفسها.
- فضّل الطرق المباشرة والآمنة: افتح البرنامج باسمه، أو الملف بمساره، أو الرابط، بدل النقر على الأيقونات إن أمكن. للبوابات الجامعية استخدم أدوات portal_* لا المتصفح الخارجي.
- لا تنفّذ إجراءً لا رجعة فيه (حذف، إرسال، دفع، تغيير إعدادات نظام) دون أن تذكره صراحة وتحصل على موافقة المستخدم. لا تكتب كلمات مرور ولا تتجاوز شاشات الأمان.
- بعد الانتهاء لخّص ما فعلته في سطرين.`;

/* ------------------------------ الأدوات ------------------------------ */

/** نتيجة أداة قد تكون قيمة عادية (تُحوَّل إلى JSON) أو كتل محتوى جاهزة (نص + صور). */
export type ToolOutput = unknown | { __blocks: Anthropic.ToolResultBlockParam["content"] };

export type ToolDef = {
  tool: Anthropic.Tool;
  label: string;
  run: (input: Record<string, unknown>) => ToolOutput | Promise<ToolOutput>;
  /** إن أعادت نصًا، يُطلب من المستخدم تأكيد الإجراء قبل التنفيذ. */
  approval?: (input: Record<string, unknown>, settings: AiSettings) => string | null;
  /** يُلتقط ويُرسل للواجهة كصورة (مثل لقطات الشاشة). */
  preview?: (input: Record<string, unknown>, output: ToolOutput) => string | null;
};

let extraToolsProvider: ((settings: AiSettings) => ToolDef[]) | null = null;

/** يسجّل أدوات إضافية خاصة بالمنصة (البوابات دائمًا، والتحكم بالكمبيوتر عند تفعيله). */
export function registerExtraTools(provider: (settings: AiSettings) => ToolDef[]): void {
  extraToolsProvider = provider;
}

/* ------------------------------ الموافقات ------------------------------ */

type ApprovalEmit = (event: AiStreamEvent) => void;
let approvalEmit: ApprovalEmit | null = null;
const pendingApprovals = new Map<string, (ok: boolean) => void>();

export function setApprovalHandler(emit: ApprovalEmit): void {
  approvalEmit = emit;
}

export function resolveApproval(requestId: string, ok: boolean): boolean {
  const fn = pendingApprovals.get(requestId);
  if (!fn) return false;
  pendingApprovals.delete(requestId);
  fn(ok);
  return true;
}

function requestApproval(jobId: string, label: string, detail: string, signal: AbortSignal, emit: Emit): Promise<boolean> {
  const requestId = `${jobId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      pendingApprovals.delete(requestId);
      resolve(false);
    }, 180_000);
    const onAbort = () => {
      pendingApprovals.delete(requestId);
      clearTimeout(timer);
      resolve(false);
    };
    signal.addEventListener("abort", onAbort, { once: true });
    pendingApprovals.set(requestId, (ok) => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      resolve(ok);
    });
    const ev: AiStreamEvent = { jobId, type: "approval", requestId, label, detail };
    emit(ev);
    if (approvalEmit && approvalEmit !== emit) approvalEmit(ev);
  });
}

const PRIORITIES: TaskPriority[] = ["low", "normal", "high", "urgent"];
const STATUSES: TaskStatus[] = ["todo", "doing", "done"];

const TOOLS: ToolDef[] = [
  {
    label: "قراءة لوحة المؤشرات",
    tool: {
      name: "get_dashboard_stats",
      description:
        "يعيد إحصاءات التطبيق الحالية: أعداد الدورات والمدربين والطلبة والقاعات والشركاء، التعارضات، نسبة الحضور، توزيع الدورات حسب اللغة والمستوى والحالة، والمواعيد القادمة خلال أسبوع.",
      input_schema: { type: "object", properties: {}, additionalProperties: false },
    },
    run: () => dashboardStats(),
  },
  {
    label: "البحث في السجلات",
    tool: {
      name: "search_records",
      description:
        "بحث فوري في كل سجلات التطبيق (مدربون، دورات، محاضر، شركاء، طلبة، قاعات) بكلمة أو اسم. يعيد حتى 25 نتيجة.",
      input_schema: {
        type: "object",
        properties: { query: { type: "string", description: "كلمة البحث (عربي أو إنجليزي)" } },
        required: ["query"],
        additionalProperties: false,
      },
    },
    run: (input) => globalSearch(String(input.query ?? ""), 25),
  },
  {
    label: "فحص تعارضات الجدول",
    tool: {
      name: "list_schedule_conflicts",
      description: "يعيد كل التعارضات المكتشفة في الجدول الأسبوعي وحجوزات القاعات (قاعة أو مدرب في وقتين متزامنين) مع تنبيهات الفراغ والصيانة.",
      input_schema: { type: "object", properties: {}, additionalProperties: false },
    },
    run: () =>
      detectAllConflicts().map((c) => ({
        severity: c.severity,
        type: c.type,
        message: c.message,
        weekday: c.weekday === null ? null : WEEKDAY_NAMES[c.weekday],
        refs: c.refs.map((r) => r.label),
      })),
  },
  {
    label: "قراءة المهام",
    tool: {
      name: "list_tasks",
      description: "يعيد مهام الإداري في لوحة المهام (المعرّف، العنوان، الحالة، الأولوية، الاستحقاق، المصدر) وملخص الأعداد (متأخرة، مستحقة اليوم).",
      input_schema: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["todo", "doing", "done", "all"], description: "تصفية حسب الحالة (افتراضي: كل غير المنجز)" },
        },
        additionalProperties: false,
      },
    },
    run: (input) => {
      const status = String(input.status ?? "open");
      const rows = listTasks().filter((t) => (status === "all" ? true : status === "open" ? t.status !== "done" : t.status === status));
      return { stats: taskStats(), tasks: rows.slice(0, 60) };
    },
  },
  {
    label: "إنشاء مهمة",
    tool: {
      name: "create_task",
      description: "ينشئ مهمة جديدة في لوحة مهام الإداري. استخدمه عندما يطلب المستخدم تذكيرًا أو متابعة أو إضافة مهمة، أو عند استخراج مهام من بريد/صفحة (مع رابط المصدر).",
      input_schema: {
        type: "object",
        properties: {
          title: { type: "string", description: "عنوان المهمة (قصير وواضح)" },
          description: { type: "string", description: "تفاصيل اختيارية" },
          priority: { type: "string", enum: PRIORITIES },
          due_date: { type: "string", description: "تاريخ الاستحقاق بصيغة YYYY-MM-DD أو فارغ" },
          tags: { type: "string", description: "وسوم مفصولة بفاصلة عربية «،»" },
          source_url: { type: "string", description: "رابط الرسالة/الصفحة التي جاءت منها المهمة (إن وُجد)" },
          source_portal: { type: "string", description: "معرّف البوابة المصدر مثل outlook أو cec (إن وُجد)" },
        },
        required: ["title"],
        additionalProperties: false,
      },
    },
    run: (input) => {
      const title = String(input.title ?? "").trim();
      if (!title) throw new Error("عنوان المهمة مطلوب");
      const priority = PRIORITIES.includes(input.priority as TaskPriority) ? (input.priority as TaskPriority) : "normal";
      const due = typeof input.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.due_date) ? input.due_date : null;
      const task = createTask({
        title,
        description: typeof input.description === "string" ? input.description : null,
        priority,
        due_date: due,
        tags: typeof input.tags === "string" ? input.tags : null,
        source: "ai",
        source_url: typeof input.source_url === "string" && /^https?:\/\//.test(input.source_url) ? input.source_url : null,
        source_portal: typeof input.source_portal === "string" ? input.source_portal : null,
      });
      return { ok: true, task };
    },
  },
  {
    label: "تحديث مهمة",
    tool: {
      name: "update_task",
      description: "يحدّث مهمة موجودة بمعرّفها: الحالة (todo/doing/done)، الأولوية، الاستحقاق، العنوان أو التفاصيل. استخدمه عندما يقول المستخدم إنه أنجز مهمة أو يريد تأجيلها.",
      input_schema: {
        type: "object",
        properties: {
          id: { type: "integer" },
          status: { type: "string", enum: STATUSES },
          priority: { type: "string", enum: PRIORITIES },
          due_date: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
        },
        required: ["id"],
        additionalProperties: false,
      },
    },
    run: (input) => {
      const id = Number(input.id);
      if (!getTask(id)) throw new Error("لا توجد مهمة بهذا المعرّف");
      const patch: Record<string, unknown> = {};
      if (STATUSES.includes(input.status as TaskStatus)) patch.status = input.status;
      if (PRIORITIES.includes(input.priority as TaskPriority)) patch.priority = input.priority;
      if (typeof input.due_date === "string") patch.due_date = /^\d{4}-\d{2}-\d{2}$/.test(input.due_date) ? input.due_date : null;
      if (typeof input.title === "string" && input.title.trim()) patch.title = input.title;
      if (typeof input.description === "string") patch.description = input.description;
      return { ok: true, task: updateTask(id, patch) };
    },
  },
  {
    label: "حفظ في الذاكرة",
    tool: {
      name: "remember_fact",
      description: "يحفظ حقيقة قصيرة ومفيدة عن المستخدم أو عمله لتُستخدم في المحادثات القادمة (مثل: مديره المباشر، الجهات التي يتابعها، تفضيلات الصياغة). لا تحفظ كلمات مرور أو بيانات حسّاسة.",
      input_schema: { type: "object", properties: { fact: { type: "string" } }, required: ["fact"], additionalProperties: false },
    },
    run: (input) => ({ ok: true, memory: addMemory(String(input.fact ?? ""), "ai").length }),
  },
  {
    label: "حذف من الذاكرة",
    tool: {
      name: "forget_fact",
      description: "يحذف حقيقة من الذاكرة بمعرّفها أو بنصها (جزء منه).",
      input_schema: { type: "object", properties: { id: { type: "integer" }, text: { type: "string" } }, additionalProperties: false },
    },
    run: (input) => {
      if (input.id) deleteMemory(Number(input.id));
      else if (typeof input.text === "string" && input.text.trim()) {
        const q = input.text.trim().toLowerCase();
        for (const m of listMemory()) if (m.fact.toLowerCase().includes(q)) deleteMemory(m.id);
      }
      return { ok: true, remaining: listMemory().map((m) => ({ id: m.id, fact: m.fact })) };
    },
  },
  {
    label: "قراءة محاضر الاجتماعات",
    tool: {
      name: "list_meeting_minutes",
      description: "يعيد آخر محاضر الاجتماعات (العنوان، التاريخ، الأطراف، القرارات، المتابعة). يمكن التصفية بكلمة بحث.",
      input_schema: {
        type: "object",
        properties: { query: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 20 } },
        additionalProperties: false,
      },
    },
    run: (input) => {
      const limit = Math.min(20, Math.max(1, Number(input.limit ?? 8)));
      const q = typeof input.query === "string" && input.query.trim() ? `%${input.query.trim()}%` : null;
      return getDb()
        .prepare(
          `SELECT id, title, meeting_date, location, parties, attendees, agenda, decisions, follow_up, tags
             FROM minutes ${q ? "WHERE search LIKE ? OR title LIKE ?" : ""} ORDER BY meeting_date DESC LIMIT ?`,
        )
        .all(...(q ? [q, q, limit] : [limit]));
    },
  },
  {
    label: "قراءة الدورات",
    tool: {
      name: "list_courses",
      description: "يعيد الدورات مع اللغة والمستوى والمدرب والقاعة والتواريخ والحالة وعدد المسجلين. يمكن التصفية بالحالة.",
      input_schema: {
        type: "object",
        properties: { status: { type: "string", enum: ["planned", "active", "completed", "cancelled", "all"] } },
        additionalProperties: false,
      },
    },
    run: (input) => {
      const status = String(input.status ?? "all");
      const rows = getDb()
        .prepare(
          `SELECT c.id, c.code, c.title, c.language, c.level, c.start_date, c.end_date, c.capacity, c.status,
                  t.name AS trainer, r.name AS room,
                  (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id AND e.status <> 'withdrawn') AS enrolled
             FROM courses c LEFT JOIN trainers t ON t.id = c.trainer_id LEFT JOIN rooms r ON r.id = c.room_id
            ${status === "all" ? "" : "WHERE c.status = ?"} ORDER BY c.start_date DESC LIMIT 80`,
        )
        .all(...(status === "all" ? [] : [status])) as Record<string, unknown>[];
      return rows.map((r) => ({
        ...r,
        language: LANGUAGE_LABELS[r.language as keyof typeof LANGUAGE_LABELS] ?? r.language,
        level: LEVEL_LABELS[r.level as keyof typeof LEVEL_LABELS] ?? r.level,
      }));
    },
  },
];

/** أدوات الخادم (بحث وقراءة صفحات) حسب إعداد المستخدم ونوع النموذج. */
function serverTools(settings: AiSettings): Anthropic.Messages.ToolUnion[] {
  if (!settings.webSearch) return [];
  if (settings.model.startsWith("claude-haiku")) {
    return [
      { type: "web_search_20250305", name: "web_search", max_uses: 5 },
      { type: "web_fetch_20250910", name: "web_fetch", max_uses: 5 },
    ];
  }
  return [
    { type: "web_search_20260209", name: "web_search", max_uses: 5 },
    { type: "web_fetch_20260209", name: "web_fetch", max_uses: 5 },
  ];
}

/* ------------------------------ المحادثة ------------------------------ */

type Emit = (event: AiStreamEvent) => void;

const jobs = new Map<string, AbortController>();

export function cancelJob(jobId: string): boolean {
  const c = jobs.get(jobId);
  if (!c) return false;
  c.abort();
  jobs.delete(jobId);
  return true;
}

/** ذاكرة المحادثات: سجل الرسائل الكامل (بما فيه استدعاءات الأدوات) لكل محادثة. */
const histories = new Map<string, Anthropic.MessageParam[]>();

export function loadHistory(chatId: string): Anthropic.MessageParam[] {
  if (histories.has(chatId)) return histories.get(chatId)!;
  const row = getDb().prepare("SELECT messages FROM ai_chats WHERE id = ?").get(chatId) as { messages: string } | undefined;
  const parsed = row ? (JSON.parse(row.messages) as Anthropic.MessageParam[]) : [];
  histories.set(chatId, parsed);
  return parsed;
}

type Block = { type?: string; content?: unknown };

/**
 * يستبدل الصور القديمة في نتائج الأدوات بنص قصير: تبقى آخر `keep` صور فقط.
 * هذا يمنع تضخّم كل طلب (ميغابايتات لكل جولة) وبطء الحفظ — السبب الأول لتعليق المحادثات الطويلة.
 */
function pruneImages(history: Anthropic.MessageParam[], keep = 2): void {
  let seen = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg.role !== "user" || !Array.isArray(msg.content)) continue;
    for (const block of msg.content as Block[]) {
      if (block.type !== "tool_result" || !Array.isArray(block.content)) continue;
      const inner = block.content as Block[];
      for (let k = 0; k < inner.length; k++) {
        if (inner[k].type !== "image") continue;
        seen++;
        if (seen > keep) inner[k] = { type: "text", text: "[لقطة سابقة حُذفت لتوفير المساحة — خذ لقطة جديدة إن احتجت]" } as Block;
      }
    }
  }
}

function stripImages(history: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
  const copy = JSON.parse(JSON.stringify(history)) as Anthropic.MessageParam[];
  pruneImages(copy, 0);
  return copy;
}

function persistHistory(chatId: string, title: string, transcriptPatch?: unknown[]): void {
  const messages = stripImages(histories.get(chatId) ?? []);
  const db = getDb();
  const existing = db.prepare("SELECT id FROM ai_chats WHERE id = ?").get(chatId) as { id: string } | undefined;
  if (existing) {
    db.prepare(
      "UPDATE ai_chats SET messages = ?, transcript = COALESCE(?, transcript), updated_at = datetime('now') WHERE id = ?",
    ).run(JSON.stringify(messages), transcriptPatch ? JSON.stringify(transcriptPatch) : null, chatId);
  } else {
    db.prepare("INSERT INTO ai_chats(id, title, messages, transcript) VALUES(?,?,?,?)").run(
      chatId,
      title.slice(0, 80),
      JSON.stringify(messages),
      JSON.stringify(transcriptPatch ?? []),
    );
  }
}

export function saveTranscript(chatId: string, title: string, transcript: unknown[]): void {
  loadHistory(chatId);
  persistHistory(chatId, title, transcript);
}

export function listChats() {
  return getDb()
    .prepare("SELECT id, title, created_at, updated_at FROM ai_chats WHERE id NOT LIKE 'routine-%' AND id NOT LIKE 'brief-%' ORDER BY updated_at DESC LIMIT 50")
    .all() as { id: string; title: string; created_at: string; updated_at: string }[];
}

export function getChatTranscript(chatId: string): unknown[] {
  const row = getDb().prepare("SELECT transcript FROM ai_chats WHERE id = ?").get(chatId) as { transcript: string } | undefined;
  return row ? (JSON.parse(row.transcript) as unknown[]) : [];
}

export function deleteChat(chatId: string): void {
  histories.delete(chatId);
  getDb().prepare("DELETE FROM ai_chats WHERE id = ?").run(chatId);
}

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    p.finally(() => clearTimeout(timer)),
    new Promise<T>((_r, reject) => {
      timer = setTimeout(() => reject(new Error(`${what}: انتهت المهلة (${Math.round(ms / 1000)} ث) دون استجابة.`)), ms);
    }),
  ]);
}

/**
 * يرسل رسالة في محادثة ويبثّ الرد تدريجيًا. حلقة يدوية: نص → أدوات → نص… حتى ينتهي الدور.
 * يعيد النص الكامل للرد (أو null عند الخطأ).
 */
export async function chat(chatId: string, jobId: string, userText: string, emit: Emit, context?: AiChatContext): Promise<string | null> {
  const settings = getAiSettings();
  const controller = new AbortController();
  jobs.set(jobId, controller);
  const history = loadHistory(chatId);
  const isFirst = history.length === 0;
  history.push({ role: "user", content: userText });

  let client: Anthropic;
  try {
    client = getClient();
  } catch (error) {
    history.pop();
    emit({ jobId, type: "error", message: friendlyError(error) });
    jobs.delete(jobId);
    return null;
  }

  const localTools: ToolDef[] = [...TOOLS, ...(extraToolsProvider ? extraToolsProvider(settings) : [])];
  const toolByName = new Map(localTools.map((t) => [t.tool.name, t]));

  let fullText = "";
  let usage = { input: 0, output: 0 };
  let ok = false;
  try {
    for (let round = 0; round < (extraToolsProvider ? 40 : 12); round++) {
      pruneImages(history);
      const stream = client.messages.stream(
        {
          model: settings.model,
          max_tokens: 16000,
          system: [
            { type: "text", text: CHAT_SYSTEM + (settings.computerControl ? COMPUTER_SYSTEM : ""), cache_control: { type: "ephemeral" } },
            { type: "text", text: orgContext(context) },
          ],
          tools: [...localTools.map((t) => t.tool), ...serverTools(settings)],
          messages: history,
          ...reasoningParams(settings.model, settings.effort),
        },
        { signal: controller.signal },
      );
      stream.on("text", (delta) => {
        fullText += delta;
        emit({ jobId, type: "text", text: delta });
      });
      const message = await stream.finalMessage();
      usage = {
        input: usage.input + message.usage.input_tokens + (message.usage.cache_read_input_tokens ?? 0),
        output: usage.output + message.usage.output_tokens,
      };
      history.push({ role: "assistant", content: message.content });
      for (const block of message.content) {
        if (block.type === "server_tool_use") {
          const label = block.name === "web_fetch" ? "قراءة صفحة من الإنترنت" : "بحث في الإنترنت";
          emit({ jobId, type: "tool", name: block.name, label, phase: "start" });
          emit({ jobId, type: "tool", name: block.name, label, phase: "end", ok: true });
        }
      }

      if (message.stop_reason === "refusal") {
        emit({
          jobId,
          type: "refusal",
          message: "اعتذر النموذج عن إكمال هذا الطلب لأسباب تتعلق بسياسة الاستخدام.",
        });
        break;
      }
      if (message.stop_reason === "pause_turn") continue;

      const toolUses = message.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      if (toolUses.length === 0 || message.stop_reason !== "tool_use") {
        if (message.stop_reason === "max_tokens") fullText += "\n\n…(اقتُطع الرد لبلوغ الحد الأقصى للطول)";
        ok = true;
        break;
      }

      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const use of toolUses) {
        const def = toolByName.get(use.name);
        const label = def?.label ?? use.name;
        emit({ jobId, type: "tool", name: use.name, label, phase: "start" });
        try {
          if (!def) throw new Error(`أداة غير معروفة: ${use.name}`);
          if (controller.signal.aborted) throw new Error("أُلغي الطلب.");
          const input = (use.input && typeof use.input === "object" ? use.input : {}) as Record<string, unknown>;
          const ask = def.approval?.(input, settings);
          if (ask) {
            const approved = await requestApproval(jobId, label, ask, controller.signal, emit);
            if (!approved) {
              results.push({ type: "tool_result", tool_use_id: use.id, is_error: true, content: "رفض المستخدم تنفيذ هذا الإجراء. لا تكرره؛ اسأله عن البديل." });
              emit({ jobId, type: "tool", name: use.name, label, phase: "end", ok: false });
              continue;
            }
          }
          const out = await withTimeout(Promise.resolve(def.run(input)), 120_000, label);
          const blocks = (out as { __blocks?: Anthropic.ToolResultBlockParam["content"] })?.__blocks;
          results.push({
            type: "tool_result",
            tool_use_id: use.id,
            content: blocks ?? JSON.stringify(out).slice(0, 60_000),
          });
          const preview = def.preview?.(input, out);
          if (preview) emit({ jobId, type: "screenshot", dataUrl: preview, label });
          emit({ jobId, type: "tool", name: use.name, label, phase: "end", ok: true });
        } catch (error) {
          results.push({
            type: "tool_result",
            tool_use_id: use.id,
            is_error: true,
            content: error instanceof Error ? error.message : String(error),
          });
          emit({ jobId, type: "tool", name: use.name, label, phase: "end", ok: false });
        }
      }
      history.push({ role: "user", content: results });
      if (fullText) {
        fullText += "\n\n";
        emit({ jobId, type: "text", text: "\n\n" });
      }
    }
    emit({ jobId, type: "done", text: fullText, usage });
    logActivity("ai", null, context?.scope === "routine" ? "تنفيذ روتين" : context?.portalId ? `أمر داخل بوابة ${context.portalId}` : "محادثة مع المساعد", userText.slice(0, 80));
  } catch (error) {
    // نُبقي السجل متسقًا: نحذف رسالة المستخدم اليتيمة إن لم يكتمل أي رد.
    if (history[history.length - 1]?.role === "user") history.pop();
    emit({ jobId, type: "error", message: friendlyError(error) });
    return null;
  } finally {
    jobs.delete(jobId);
    try {
      persistHistory(chatId, isFirst ? userText : "");
    } catch {
      /* الحفظ ثانوي */
    }
  }
  return ok ? fullText : null;
}

/* ------------------------------ الروتينات ------------------------------ */

export function listRoutines(): AiRoutine[] {
  return getDb().prepare("SELECT * FROM ai_routines ORDER BY id").all() as AiRoutine[];
}

export function saveRoutine(input: Partial<AiRoutine> & { name: string; prompt: string }): AiRoutine[] {
  const db = getDb();
  const time = typeof input.schedule_time === "string" && /^\d{2}:\d{2}$/.test(input.schedule_time) ? input.schedule_time : null;
  const weekdays = typeof input.weekdays === "string" && input.weekdays.trim() ? input.weekdays : "0,1,2,3,4";
  if (input.id) {
    db.prepare("UPDATE ai_routines SET name=?, prompt=?, schedule_time=?, weekdays=?, enabled=? WHERE id=?").run(
      input.name.trim(),
      input.prompt.trim(),
      time,
      weekdays,
      input.enabled === undefined ? 1 : input.enabled ? 1 : 0,
      input.id,
    );
  } else {
    db.prepare("INSERT INTO ai_routines(name, prompt, schedule_time, weekdays, enabled) VALUES(?,?,?,?,?)").run(
      input.name.trim(),
      input.prompt.trim(),
      time,
      weekdays,
      input.enabled === undefined ? 1 : input.enabled ? 1 : 0,
    );
  }
  return listRoutines();
}

export function deleteRoutine(id: number): AiRoutine[] {
  getDb().prepare("DELETE FROM ai_routines WHERE id = ?").run(id);
  return listRoutines();
}

const runningRoutines = new Set<number>();

/** ينفّذ روتينًا الآن (يدويًا أو من المجدول) ويحفظ ملخص النتيجة. */
export async function runRoutine(id: number, jobId: string, emit: Emit): Promise<{ ok: boolean; text: string }> {
  const r = getDb().prepare("SELECT * FROM ai_routines WHERE id = ?").get(id) as AiRoutine | undefined;
  if (!r) {
    emit({ jobId, type: "error", message: "الروتين غير موجود." });
    return { ok: false, text: "" };
  }
  if (runningRoutines.has(id)) {
    emit({ jobId, type: "error", message: "هذا الروتين قيد التنفيذ الآن." });
    return { ok: false, text: "" };
  }
  runningRoutines.add(id);
  try {
    const chatId = `routine-${id}-${Date.now().toString(36)}`;
    const text = await chat(chatId, jobId, r.prompt, emit, { scope: "routine" });
    getDb()
      .prepare("UPDATE ai_routines SET last_run_at = datetime('now'), last_ok = ?, last_result = ? WHERE id = ?")
      .run(text === null ? 0 : 1, (text ?? "").slice(0, 8000), id);
    return { ok: text !== null, text: text ?? "" };
  } finally {
    runningRoutines.delete(id);
  }
}

let schedulerTimer: ReturnType<typeof setInterval> | null = null;

/** يفحص كل دقيقة الروتينات المجدولة ويشغّل ما حان وقته (مرة واحدة يوميًا لكل روتين). */
export function startRoutineScheduler(emit: Emit, onDone: (r: { id: number; name: string; ok: boolean; summary?: string }) => void): void {
  if (schedulerTimer) return;
  const tick = () => {
    let list: AiRoutine[];
    try {
      list = listRoutines();
    } catch {
      return;
    }
    const now = new Date();
    const hhmm = now.toTimeString().slice(0, 5);
    const today = todayISO();
    for (const r of list) {
      if (!r.enabled || !r.schedule_time || r.schedule_time !== hhmm) continue;
      if (!r.weekdays.split(",").map((x) => Number(x.trim())).includes(now.getDay())) continue;
      if (r.last_run_at && r.last_run_at.slice(0, 10) === today) continue;
      if (runningRoutines.has(r.id)) continue;
      const jobId = `routine-${r.id}-${Date.now().toString(36)}`;
      void runRoutine(r.id, jobId, emit).then((res) => onDone({ id: r.id, name: r.name, ok: res.ok, summary: res.text.slice(0, 200) }));
    }
  };
  schedulerTimer = setInterval(tick, 60_000);
}

/* ------------------------------ الموجز اليومي ------------------------------ */

export function getBrief(day = todayISO()): AiBrief | null {
  return (getDb().prepare("SELECT * FROM ai_briefs WHERE day = ?").get(day) as AiBrief | undefined) ?? null;
}

const BRIEF_PROMPT = `أعدّ «موجز اليوم» للإداري. اجمع أولًا:
1) المهام من list_tasks (المتأخرة والمستحقة اليوم والعاجلة).
2) إن كانت أدوات البوابات متاحة: افتح outlook واقرأ آخر الرسائل غير المقروءة (أول 10) وحدّد ما فيها من طلبات أو مواعيد نهائية؛ ثم افتح تقويم اليوم https://outlook.office.com/calendar/view/day واقرأ اجتماعات اليوم. إن ظهرت صفحة تسجيل دخول أو خطأ فاذكر ذلك في سطر واحد وتابع بما توفر.
ثم اكتب الموجز بهذا التنسيق فقط، بلا مقدمة:
## أهم 3 أولويات اليوم
- …
## اجتماعات اليوم
- الوقت — العنوان (أو «لا توجد اجتماعات» / «لم أتمكن من قراءة التقويم»)
## بريد يحتاج ردًا أو إجراءً
- المرسل — الموضوع — المطلوب
## المهام المتأخرة والمستحقة اليوم
- …
## اقتراح
سطر أو سطران بما يُنصح البدء به.`;

/** يولّد موجز اليوم ويحفظه (chatId ثابت لليوم). */
export async function runBrief(jobId: string, emit: Emit): Promise<AiBrief | null> {
  const day = todayISO();
  const chatId = `brief-${day}-${Date.now().toString(36)}`;
  const text = await chat(chatId, jobId, BRIEF_PROMPT, emit, { scope: "brief" });
  if (text === null || !text.trim()) return null;
  getDb()
    .prepare("INSERT INTO ai_briefs(day, text, created_at) VALUES(?,?,datetime('now')) ON CONFLICT(day) DO UPDATE SET text = excluded.text, created_at = excluded.created_at")
    .run(day, text.trim());
  return getBrief(day);
}

/* ------------------------------ القوالب ------------------------------ */

const TEMPLATES: Record<AiTemplateId, { label: string; system: string; build: (i: AiTemplateInput) => string }> = {
  letter: {
    label: "خطاب / مذكرة رسمية",
    system:
      "تكتب مراسلات رسمية لجامعة إماراتية حكومية. الصيغة: البسملة اختيارية حسب الطلب، ثم الجهة/المرسل إليه، التحية الرسمية («السلام عليكم ورحمة الله وبركاته» أو «تحية طيبة وبعد»)، الموضوع في سطر مستقل، ثم المتن بفقرات قصيرة، ثم الخاتمة («وتفضلوا بقبول فائق الاحترام والتقدير») والتوقيع باسم المستخدم ومسماه إن وُجدا. لا تفبرك أرقام مرجع أو تواريخ إلا إن أُعطيت.",
    build: (i) =>
      `اكتب ${i.options?.kind === "memo" ? "مذكرة داخلية" : "خطابًا رسميًا"} ${i.options?.lang === "en" ? "باللغة الإنجليزية" : "باللغة العربية"}${i.options?.to ? ` موجّهًا إلى: ${i.options.to}` : ""}${i.options?.tone ? ` بنبرة ${i.options.tone}` : ""}.\n\nالنقاط المطلوب تغطيتها:\n${i.text}`,
  },
  email: {
    label: "بريد إلكتروني",
    system:
      "تكتب رسائل بريد إلكتروني مهنية وموجزة لموظف إداري جامعي. أعطِ سطر الموضوع أولًا (Subject:) ثم النص. جمل قصيرة، وطلب واضح، وخاتمة مناسبة.",
    build: (i) =>
      `اكتب بريدًا إلكترونيًا ${i.options?.lang === "en" ? "بالإنجليزية" : i.options?.lang === "both" ? "بالعربية ثم نسخة بالإنجليزية" : "بالعربية"}${i.options?.to ? ` إلى ${i.options.to}` : ""}${i.options?.tone ? ` بنبرة ${i.options.tone}` : ""}.\n\n${i.options?.reply === "1" ? "هذا ردّ على الرسالة التالية / أو هذه النقاط المطلوب الرد بها:" : "المحتوى المطلوب:"}\n${i.text}`,
  },
  summary: {
    label: "تلخيص",
    system: "تلخّص نصوصًا إدارية بدقة دون إضافة معلومات. ابدأ بملخص من سطرين، ثم النقاط الأساسية، ثم «القرارات/الإجراءات المطلوبة» إن وُجدت، ثم «أسئلة مفتوحة» إن وُجدت.",
    build: (i) => `لخّص النص التالي${i.options?.length === "short" ? " في أقل من 120 كلمة" : ""}:\n\n${i.text}`,
  },
  translate: {
    label: "ترجمة رسمية",
    system: "مترجم محترف للمراسلات الأكاديمية والإدارية بين العربية والإنجليزية. حافظ على المصطلحات الرسمية والأسماء كما هي، وعلى التنسيق (فقرات، نقاط). أعطِ الترجمة فقط دون تعليق.",
    build: (i) => `ترجم النص التالي إلى ${i.options?.target === "ar" ? "العربية" : "الإنجليزية"}:\n\n${i.text}`,
  },
  proofread: {
    label: "تدقيق لغوي",
    system: "مدقق لغوي عربي/إنجليزي. أعد النص مصحّحًا إملائيًا ونحويًا وأسلوبيًا مع الحفاظ على المعنى والنبرة، ثم أضف قسمًا قصيرًا بعنوان «أهم التعديلات» يعدّد ما غُيّر باختصار.",
    build: (i) => `دقّق النص التالي${i.options?.style === "formal" ? " واجعله رسميًا أكثر" : ""}:\n\n${i.text}`,
  },
  minutes: {
    label: "تنظيم محضر اجتماع",
    system:
      "تحوّل ملاحظات اجتماع خام إلى محضر منظّم بالأقسام: عنوان الاجتماع، التاريخ والمكان (إن ذُكرا)، الحضور، جدول الأعمال، النقاط التي نوقشت، القرارات المتخذة، المهام (المسؤول — المهمة — الموعد) في جدول، والمتابعة. لا تضف قرارات لم تُذكر.",
    build: (i) => `نظّم ملاحظات الاجتماع التالية في محضر رسمي:\n\n${i.text}`,
  },
  weekly_plan: {
    label: "خطة أسبوعية",
    system: "تساعد إداريًا جامعيًا على تخطيط أسبوعه. رتّب الأولويات (عاجل/مهم)، ووزّع المهام على أيام الأسبوع (الاثنين–الجمعة، أبوظبي)، واقترح كتل زمنية واقعية، وحدّد ما يمكن تفويضه أو تأجيله. أنهِ بثلاث نصائح تنفيذية قصيرة.",
    build: (i) => `هذه مهامي والتزاماتي لهذا الأسبوع:\n\n${i.text}`,
  },
  report_narrative: {
    label: "صياغة تقرير من أرقام",
    system: "تحوّل أرقامًا وإحصاءات إدارية إلى تقرير سردي قصير للإدارة العليا: ملخص تنفيذي (3 أسطر)، أبرز المؤشرات، الملاحظات، والتوصيات. لا تفسّر أسبابًا غير مذكورة كحقائق؛ اجعل التفسيرات مشروطة.",
    build: (i) => `اكتب تقريرًا سرديًا من البيانات التالية:\n\n${i.text}`,
  },
  announcement: {
    label: "تعميم / إعلان",
    system: "تكتب تعميمات وإعلانات جامعية واضحة للموظفين أو الطلبة: عنوان جذّاب مهني، الجملة الأولى تحمل الخبر، التفاصيل (ماذا/متى/أين/من)، ثم ما المطلوب من القارئ، وجهة التواصل.",
    build: (i) => `اكتب تعميمًا ${i.options?.lang === "en" ? "بالإنجليزية" : i.options?.lang === "both" ? "بالعربية ثم الإنجليزية" : "بالعربية"} للفئة: ${i.options?.audience || "الموظفين"}.\n\nالمحتوى:\n${i.text}`,
  },
};

export const TEMPLATE_LABELS = Object.fromEntries(Object.entries(TEMPLATES).map(([k, v]) => [k, v.label]));

export async function runTemplate(jobId: string, input: AiTemplateInput, emit: Emit): Promise<void> {
  const tpl = TEMPLATES[input.template];
  if (!tpl) {
    emit({ jobId, type: "error", message: "قالب غير معروف." });
    return;
  }
  if (!input.text.trim()) {
    emit({ jobId, type: "error", message: "أدخل النص أو النقاط أولًا." });
    return;
  }
  const settings = getAiSettings();
  const controller = new AbortController();
  jobs.set(jobId, controller);
  let text = "";
  try {
    const client = getClient();
    const stream = client.messages.stream(
      {
        model: settings.model,
        max_tokens: 16000,
        system: [
          { type: "text", text: `${tpl.system}\n\nابدأ بالمخرج مباشرة دون مقدمة أو تعليق ختامي.`, cache_control: { type: "ephemeral" } },
          { type: "text", text: orgContext() },
        ],
        messages: [{ role: "user", content: tpl.build(input) }],
        ...reasoningParams(settings.model, settings.effort),
      },
      { signal: controller.signal },
    );
    stream.on("text", (delta) => {
      text += delta;
      emit({ jobId, type: "text", text: delta });
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") {
      emit({ jobId, type: "refusal", message: "اعتذر النموذج عن إكمال هذا الطلب." });
      return;
    }
    emit({
      jobId,
      type: "done",
      text,
      usage: { input: message.usage.input_tokens + (message.usage.cache_read_input_tokens ?? 0), output: message.usage.output_tokens },
    });
    logActivity("ai", null, `أداة: ${tpl.label}`, input.text.slice(0, 60));
  } catch (error) {
    emit({ jobId, type: "error", message: friendlyError(error) });
  } finally {
    jobs.delete(jobId);
  }
}

/* -------------------------- استخراج المهام -------------------------- */

const TASKS_SCHEMA = {
  type: "object",
  properties: {
    tasks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          priority: { type: "string", enum: PRIORITIES },
          due_date: { type: ["string", "null"], description: "YYYY-MM-DD أو null" },
          tags: { type: "array", items: { type: "string" } },
        },
        required: ["title", "description", "priority", "due_date", "tags"],
        additionalProperties: false,
      },
    },
  },
  required: ["tasks"],
  additionalProperties: false,
};

/** يحوّل هدفًا أو نصًا (محضر، بريد…) إلى قائمة مهام منظّمة عبر المخرجات المهيكلة. */
export async function extractTasks(text: string, mode: "goal" | "text"): Promise<ExtractedTask[]> {
  const settings = getAiSettings();
  const client = getClient();
  const prompt =
    mode === "goal"
      ? `فكّك الهدف التالي إلى مهام تنفيذية صغيرة وواضحة (3 إلى 10 مهام) مرتبة منطقيًا، مع أولوية واقعية وتاريخ استحقاق مقترح بصيغة YYYY-MM-DD بناءً على تاريخ اليوم عندما يكون ذلك منطقيًا، وإلا null. الوسوم بالعربية وقصيرة.\n\nالهدف:\n${text}`
      : `استخرج من النص التالي كل المهام والإجراءات المطلوبة (ما يجب على الإداري فعله أو متابعته). لكل مهمة عنوان قصير، ووصف يذكر السياق أو المسؤول إن وُجد، وأولوية، وتاريخ استحقاق بصيغة YYYY-MM-DD إن ذُكر أو يمكن استنتاجه وإلا null. لا تخترع مهامًا غير موجودة.\n\nالنص:\n${text}`;
  const response = await client.messages.create({
    model: settings.model,
    max_tokens: 8000,
    system: [{ type: "text", text: `أنت مساعد إداري في جامعة. أجب بالعربية.\n${orgContext()}` }],
    messages: [{ role: "user", content: prompt }],
    output_config: { format: { type: "json_schema", schema: TASKS_SCHEMA }, ...(settings.model.startsWith("claude-haiku") ? {} : { effort: settings.effort }) },
    ...(settings.model.startsWith("claude-haiku") ? {} : { thinking: { type: "adaptive" as const } }),
  });
  if (response.stop_reason === "refusal") throw new Error("اعتذر النموذج عن هذا الطلب.");
  const block = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!block) throw new Error("لم يصل رد من النموذج.");
  const parsed = JSON.parse(block.text) as { tasks: ExtractedTask[] };
  return (parsed.tasks ?? []).map((t) => ({
    title: String(t.title ?? "").trim(),
    description: String(t.description ?? ""),
    priority: PRIORITIES.includes(t.priority) ? t.priority : "normal",
    due_date: typeof t.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.due_date) ? t.due_date : null,
    tags: Array.isArray(t.tags) ? t.tags.map(String).slice(0, 5) : [],
  })).filter((t) => t.title);
}

/** فحص المفتاح والاتصال بطلب قصير جدًا. */
export async function testConnection(): Promise<{ ok: boolean; message: string; model: string }> {
  const settings = getAiSettings();
  try {
    const client = getClient();
    const res = await client.messages.create({
      model: settings.model,
      max_tokens: 40,
      messages: [{ role: "user", content: "أجب بكلمة واحدة: جاهز" }],
    });
    const text = res.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "";
    return { ok: true, message: `الاتصال ناجح — رد النموذج: ${text.trim().slice(0, 40)}`, model: res.model };
  } catch (error) {
    return { ok: false, message: friendlyError(error), model: settings.model };
  }
}
