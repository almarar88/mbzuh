/**
 * المساعد الذكي — يعمل في العملية الرئيسية عبر Anthropic SDK.
 *
 * - المفتاح يُخزَّن محليًا مشفّرًا بـ safeStorage (DPAPI على ويندوز) ولا يغادر الجهاز
 *   إلا إلى واجهة Claude API.
 * - المحادثة تدعم «أدوات» تقرأ بيانات التطبيق (الإحصاءات، البحث، التعارضات، المهام،
 *   المحاضر) وتُنشئ مهامًا — بموافقة ضمنية لأن المستخدم هو من يطلب.
 * - كل رد يُبثّ تدريجيًا إلى الواجهة عبر القناة app:ai.
 */
import Anthropic from "@anthropic-ai/sdk";
import { safeStorage } from "electron";
import { getDb, getSetting, logActivity, setSetting } from "../db";
import { dashboardStats, globalSearch } from "./stats";
import { detectAllConflicts } from "./conflicts";
import { createTask, listTasks, taskStats } from "./tasks";
import { todayISO, WEEKDAY_NAMES } from "../../shared/text";
import { LANGUAGE_LABELS, LEVEL_LABELS } from "../../shared/labels";
import type {
  AiEffort,
  AiSettings,
  AiStreamEvent,
  AiTemplateId,
  AiTemplateInput,
  ExtractedTask,
  TaskPriority,
} from "../../shared/types";

const DEFAULT_MODEL = "claude-opus-5";
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
  };
}

function getClient(): Anthropic {
  const apiKey = readApiKey();
  if (!apiKey) {
    throw new Error("لم يُضبط مفتاح Claude API بعد. أضفه من الإعدادات ← المساعد الذكي.");
  }
  return new Anthropic({ apiKey, maxRetries: 2, timeout: 10 * 60 * 1000 });
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

/* ----------------------------- السياق ----------------------------- */

function orgContext(): string {
  const s = getAiSettings();
  const d = new Date();
  const who = [s.adminName && `اسم المستخدم: ${s.adminName}`, s.adminTitle && `المسمى الوظيفي: ${s.adminTitle}`]
    .filter(Boolean)
    .join("، ");
  return [
    `الجهة: ${getSetting("org_name", "جامعة محمد بن زايد للعلوم الإنسانية")}.`,
    who,
    `تاريخ اليوم: ${todayISO()} (${WEEKDAY_NAMES[d.getDay()]}).`,
  ]
    .filter(Boolean)
    .join("\n");
}

const CHAT_SYSTEM = `أنت «مساعد الإداري» داخل تطبيق سطح مكتب لموظف إداري في جامعة محمد بن زايد للعلوم الإنسانية (MBZUH) في أبوظبي.

دورك: مساعد تنفيذي وشريك تفكير. تكتب بالعربية الفصحى المبسّطة افتراضيًا (وبالإنجليزية إذا كتب المستخدم بها أو طلبها)، بأسلوب مباشر ومهني يليق بالمراسلات الجامعية الرسمية.

لديك أدوات تقرأ بيانات التطبيق المحلية (إحصاءات الدورات والمدربين والقاعات، البحث في السجلات، التعارضات في الجداول، المهام، محاضر الاجتماعات) وتُنشئ مهامًا. استخدمها عندما يسأل المستخدم عن بياناته أو يطلب متابعة، ولا تخمّن أرقامًا لم تقرأها من الأدوات. عندما تُنشئ مهمة قل ذلك صراحة.

ابدأ بالجواب أو المسودة مباشرة، دون مقدمات أو مجاملات. للمسودات الرسمية استخدم عناوين واضحة وترتيبًا منطقيًا. لا تفبرك سياسات أو أسماء أو أرقامًا؛ إذا كان أمرٌ يحتاج تأكيدًا من نظام الجامعة الرسمي (UMS) أو من جهة مختصة فاذكر ذلك بوضوح في سطر واحد.`;

/* ------------------------------ الأدوات ------------------------------ */

type ToolDef = { tool: Anthropic.Tool; label: string; run: (input: Record<string, unknown>) => unknown };

const PRIORITIES: TaskPriority[] = ["low", "normal", "high", "urgent"];

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
      description: "يعيد مهام الإداري في لوحة المهام مع حالتها وأولويتها وتاريخ استحقاقها، وملخص الأعداد (متأخرة، مستحقة اليوم).",
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
      description: "ينشئ مهمة جديدة في لوحة مهام الإداري. استخدمه عندما يطلب المستخدم تذكيرًا أو متابعة أو إضافة مهمة.",
      input_schema: {
        type: "object",
        properties: {
          title: { type: "string", description: "عنوان المهمة (قصير وواضح)" },
          description: { type: "string", description: "تفاصيل اختيارية" },
          priority: { type: "string", enum: PRIORITIES },
          due_date: { type: "string", description: "تاريخ الاستحقاق بصيغة YYYY-MM-DD أو فارغ" },
          tags: { type: "string", description: "وسوم مفصولة بفاصلة عربية «،»" },
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
      });
      return { ok: true, task };
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

const TOOL_BY_NAME = new Map(TOOLS.map((t) => [t.tool.name, t]));

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

function persistHistory(chatId: string, title: string, transcriptPatch?: unknown[]): void {
  const messages = histories.get(chatId) ?? [];
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
    .prepare("SELECT id, title, created_at, updated_at FROM ai_chats ORDER BY updated_at DESC LIMIT 50")
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

/**
 * يرسل رسالة في محادثة ويبثّ الرد تدريجيًا. حلقة يدوية: نص → أدوات → نص… حتى ينتهي الدور.
 */
export async function chat(chatId: string, jobId: string, userText: string, emit: Emit): Promise<void> {
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
    return;
  }

  let fullText = "";
  let usage = { input: 0, output: 0 };
  try {
    for (let round = 0; round < 12; round++) {
      const stream = client.messages.stream(
        {
          model: settings.model,
          max_tokens: 16000,
          system: [
            { type: "text", text: CHAT_SYSTEM, cache_control: { type: "ephemeral" } },
            { type: "text", text: orgContext() },
          ],
          tools: TOOLS.map((t) => t.tool),
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
        break;
      }

      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const use of toolUses) {
        const def = TOOL_BY_NAME.get(use.name);
        const label = def?.label ?? use.name;
        emit({ jobId, type: "tool", name: use.name, label, phase: "start" });
        try {
          if (!def) throw new Error(`أداة غير معروفة: ${use.name}`);
          const input = (use.input && typeof use.input === "object" ? use.input : {}) as Record<string, unknown>;
          const out = def.run(input);
          results.push({ type: "tool_result", tool_use_id: use.id, content: JSON.stringify(out).slice(0, 60_000) });
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
    logActivity("ai", null, "محادثة مع المساعد", userText.slice(0, 80));
  } catch (error) {
    // نُبقي السجل متسقًا: نحذف رسالة المستخدم اليتيمة إن لم يكتمل أي رد.
    if (history[history.length - 1]?.role === "user") history.pop();
    emit({ jobId, type: "error", message: friendlyError(error) });
  } finally {
    jobs.delete(jobId);
    persistHistory(chatId, isFirst ? userText : "");
  }
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
