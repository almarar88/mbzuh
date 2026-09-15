/**
 * وكيل الذكاء الاصطناعي: حلقة أدوات يدوية على Anthropic Messages API مع بث،
 * يبحث في الأخبار المحلية وعلى الويب وReddit وX، ويقرأ الصفحات ويترجم ويحلّل.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { AgentEvent, AgentMessage, AgentToolCall, Conversation } from "@shared/types";
import { getDb, nowIso } from "../db";
import { aggregator } from "./aggregator";
import { analytics, getArticle, listArticles, trendingTags } from "./articles";
import { getClient, currentModel, describeError } from "./llm";
import { fetchSubreddit, searchReddit } from "./reddit";
import { searchNews, searchWeb } from "./search";
import { loadSettings } from "./settings";
import { truncate } from "./text";
import { translateToArabic } from "./translate";
import { extractPage } from "./web";
import { fetchXTimeline } from "./x";

const MAX_TOOL_RESULT = 14000;
const MAX_ITERATIONS = 16;

const SYSTEM_PROMPT = `أنت «محلل نبض التقنية»: وكيل ذكاء اصطناعي داخل تطبيق أخبار متخصص في التقنية والذكاء الاصطناعي فقط.

مهمتك: البحث عن الأخبار وجلبها وتحليلها وتلخيصها للمستخدم بالعربية الفصحى المعاصرة.

قواعدك:
- ابدأ بالجواب أو الخلاصة، ثم التفاصيل. كن مباشرًا ودقيقًا بلا حشو.
- استخدم الأدوات كلما احتجت معلومات حديثة: ابدأ بـ search_news (قاعدة الأخبار المحلية في التطبيق)، ثم search_web / search_news_web / search_reddit / fetch_x للويب، وfetch_url لقراءة صفحة كاملة.
- ميّز دائمًا بين: مؤكد رسميًا، منقول عن مصادر، وتخمين/شائعة. لا تقدّم استنتاجًا على أنه حقيقة.
- اذكر المصادر بروابطها (Markdown) عند الاستشهاد بأي معلومة من الأدوات.
- إذا كان المصدر بالإنجليزية، فترجم المعلومات المهمة إلى العربية بنفسك، مع إبقاء أسماء الشركات والمنتجات والنماذج باللاتينية.
- عند طلب تحليل: قدّم الملخص، النقاط الرئيسية، لماذا يهم، الأثر المتوقع، والمخاطر أو ما ينبغي مراقبته.
- لا تخرج عن نطاق التقنية والذكاء الاصطناعي؛ إن سُئلت عن غيره فاعتذر بجملة واحدة وأعد التوجيه.
- استخدم Markdown بسيطًا (عناوين قصيرة، قوائم، جداول عند المقارنة).

تاريخ اليوم: ${new Date().toISOString().slice(0, 10)}.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "search_news",
    description: "يبحث في قاعدة الأخبار المحلية للتطبيق (أخبار مجمّعة من RSS وReddit وX وGoogle News خلال الأيام الماضية). استخدمه أولًا لأي سؤال عن أخبار حديثة.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "كلمات البحث (عربي أو إنجليزي). اتركه فارغًا لأحدث الأخبار." },
        category: { type: "string", enum: ["all", "ai", "tech"], description: "التصنيف" },
        kind: { type: "string", enum: ["all", "rss", "reddit", "x", "gnews"], description: "نوع المصدر" },
        limit: { type: "integer", description: "عدد النتائج (1-40)" },
      },
      required: [],
    },
  },
  {
    name: "get_article",
    description: "يجلب التفاصيل الكاملة لخبر من قاعدة التطبيق بمعرّفه (النص الكامل، الصور، التحليل السابق إن وُجد). يجلب التفاصيل من الموقع الأصلي إن لم تكن محفوظة.",
    input_schema: { type: "object", properties: { id: { type: "integer", description: "معرّف الخبر من search_news" } }, required: ["id"] },
  },
  {
    name: "fetch_url",
    description: "يقرأ صفحة ويب ويستخلص نصها الرئيسي وصورها وتاريخ نشرها. استخدمه لقراءة مقال أو تدوينة أو صفحة إعلان رسمي.",
    input_schema: { type: "object", properties: { url: { type: "string", description: "الرابط الكامل" } }, required: ["url"] },
  },
  {
    name: "search_web",
    description: "بحث عام في الويب (Bing/DuckDuckGo) يعيد عناوين وروابط ومقتطفات.",
    input_schema: { type: "object", properties: { query: { type: "string" }, limit: { type: "integer" } }, required: ["query"] },
  },
  {
    name: "search_news_web",
    description: "بحث في أخبار Google الحديثة (عربي أو إنجليزي) يعيد أحدث المقالات من الصحف والمواقع.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" }, lang: { type: "string", enum: ["ar", "en"], description: "لغة الأخبار" }, limit: { type: "integer" } },
      required: ["query"],
    },
  },
  {
    name: "search_reddit",
    description: "يبحث في Reddit عن منشورات حديثة، أو يجلب أحدث منشورات مجتمع (subreddit) معيّن.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "كلمات البحث" }, subreddit: { type: "string", description: "اسم المجتمع بدون r/ (بديل عن query)" }, limit: { type: "integer" } },
      required: [],
    },
  },
  {
    name: "fetch_x",
    description: "يجلب أحدث تغريدات حساب على X (تويتر) مثل OpenAI أو AnthropicAI. أفضل جهد بلا مفتاح؛ أدقّ مع Bearer Token في الإعدادات.",
    input_schema: { type: "object", properties: { handle: { type: "string", description: "اسم الحساب بدون @" }, limit: { type: "integer" } }, required: ["handle"] },
  },
  {
    name: "translate",
    description: "يترجم نصًا إلى العربية عبر مزوّد الترجمة المضبوط في التطبيق (للنصوص الطويلة التي لا تريد ترجمتها بنفسك).",
    input_schema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
  },
  {
    name: "trending_topics",
    description: "يعيد الوسوم والمواضيع الأكثر تداولًا في أخبار التطبيق خلال آخر 48 ساعة مع إحصاءات الأسبوع (عدد الأخبار يوميًا، أهم المصادر، نسبة AI).",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "refresh_feeds",
    description: "يشغّل تحديثًا فوريًا لكل مصادر الأخبار في التطبيق ثم يعيد عدد الأخبار الجديدة. استخدمه إذا بدت قاعدة الأخبار قديمة.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
];

function fmtArticleBrief(a: ReturnType<typeof getArticle>): string {
  if (!a) return "";
  return `#${a.id} | ${a.publishedAt.slice(0, 16).replace("T", " ")} | ${a.sourceName} | ${a.category === "ai" ? "ذكاء اصطناعي" : "تقنية"}\n` +
    `العنوان: ${a.titleAr && a.titleAr !== a.title ? `${a.titleAr} (${a.title})` : a.title}\n` +
    (a.summaryAr || a.summary ? `الملخص: ${truncate(a.summaryAr || a.summary || "", 300)}\n` : "") +
    `الرابط: ${a.url}`;
}

async function runTool(name: string, input: Record<string, unknown>): Promise<string> {
  switch (name) {
    case "search_news": {
      const items = listArticles({
        search: typeof input.query === "string" ? input.query : "",
        category: (input.category as "all" | "ai" | "tech") ?? "all",
        kind: (input.kind as "all" | "rss" | "reddit" | "x" | "gnews") ?? "all",
        limit: Math.min(Number(input.limit) || 15, 40),
      });
      if (!items.length) return "لا نتائج في القاعدة المحلية. جرّب search_news_web أو search_web.";
      return items.map((a) => fmtArticleBrief(a)).join("\n\n");
    }
    case "get_article": {
      const id = Number(input.id);
      let a = getArticle(id);
      if (!a) return `لا يوجد خبر بالمعرّف ${id}`;
      if (!a.detailsFetched) a = await aggregator.fetchDetails(id);
      const body = a.contentAr || a.contentText || a.summaryAr || a.summary || "";
      return `${fmtArticleBrief(a)}\nالكاتب: ${a.author ?? "-"}\nالوسوم: ${a.tags.join("، ")}\nالصور: ${a.images.slice(0, 5).join(" , ") || "-"}\n` +
        (a.analysis ? `تحليل سابق: ${a.analysis.summary}\n` : "") +
        `\nالنص:\n${truncate(body, MAX_TOOL_RESULT - 800)}`;
    }
    case "fetch_url": {
      const page = await extractPage(String(input.url));
      return `العنوان: ${page.title}\nالموقع: ${page.siteName ?? "-"}\nالكاتب: ${page.byline ?? "-"}\nالتاريخ: ${page.publishedAt ?? "-"}\nالصور: ${page.images.slice(0, 5).join(" , ") || "-"}\n\n${truncate(page.contentText || page.excerpt, MAX_TOOL_RESULT - 500)}`;
    }
    case "search_web": {
      const { results, engine } = await searchWeb(String(input.query), Math.min(Number(input.limit) || 8, 15));
      return `محرك: ${engine}\n\n` + results.map((r, i) => `${i + 1}. ${r.title}\n${r.url}\n${r.snippet}`).join("\n\n");
    }
    case "search_news_web": {
      const results = await searchNews(String(input.query), input.lang === "en" ? "en" : "ar", Math.min(Number(input.limit) || 10, 20));
      if (!results.length) return "لا نتائج.";
      return results.map((r, i) => `${i + 1}. ${r.title} — ${r.source} (${r.publishedAt?.slice(0, 10) ?? "-"})\n${r.url}\n${r.snippet}`).join("\n\n");
    }
    case "search_reddit": {
      const limit = Math.min(Number(input.limit) || 10, 25);
      const posts = typeof input.subreddit === "string" && input.subreddit
        ? await fetchSubreddit(input.subreddit, "hot", limit)
        : await searchReddit(String(input.query ?? "AI"), limit);
      return posts.map((p) => `r/${p.subreddit} | ▲${p.ups} | 💬${p.numComments} | ${p.createdAt.slice(0, 10)}\n${p.title}\n${p.url}\n${truncate(p.selftext, 300)}`).join("\n\n");
    }
    case "fetch_x": {
      const { tweets, via } = await fetchXTimeline(String(input.handle), loadSettings().xBearerToken, Math.min(Number(input.limit) || 10, 25));
      return `المصدر: ${via}\n\n` + tweets.map((t) => `${t.createdAt.slice(0, 16)} | ♥${t.likes} | ${t.url}\n${t.text}${t.links.length ? `\nروابط: ${t.links.join(" , ")}` : ""}`).join("\n\n");
    }
    case "translate": {
      const r = await translateToArabic(truncate(String(input.text), 12000));
      return `[${r.provider}] ${r.text}`;
    }
    case "trending_topics": {
      const t = trendingTags(48, 12);
      const an = analytics();
      return `الأكثر تداولًا (48 ساعة): ${t.map((x) => `${x.tag} (${x.count})`).join("، ") || "-"}\n` +
        `هذا الأسبوع: ${an.weekTotal} خبر (الأسبوع السابق ${an.prevWeekTotal})، نسبة AI ${Math.round(an.aiShare * 100)}%\n` +
        `يوميًا: ${an.days.map((d) => `${d.label}: ${d.total}`).join("، ")}\n` +
        `أهم المصادر: ${an.topSources.map((s) => `${s.name} (${s.count})`).join("، ")}`;
    }
    case "refresh_feeds": {
      const s = await aggregator.refreshAll();
      return `تم التحديث: ${s.added} خبر جديد من ${s.sources} مصدر.` + (s.errors.length ? `\nأخطاء: ${s.errors.map((e) => `${e.source}: ${e.error}`).join("; ")}` : "");
    }
    default:
      throw new Error(`أداة غير معروفة: ${name}`);
  }
}

/* ── تخزين المحادثات ── */

export function listConversations(): Conversation[] {
  return getDb()
    .prepare("SELECT c.*, (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count FROM conversations c ORDER BY c.updated_at DESC")
    .all()
    .map((r: { id: number; title: string; created_at: string; updated_at: string; message_count: number }) => ({
      id: r.id, title: r.title, createdAt: r.created_at, updatedAt: r.updated_at, messageCount: r.message_count,
    }));
}

export function createConversation(title: string): Conversation {
  const now = nowIso();
  const id = getDb().prepare("INSERT INTO conversations(title, created_at, updated_at) VALUES (?, ?, ?)").run(truncate(title, 80), now, now).lastInsertRowid;
  return { id, title: truncate(title, 80), createdAt: now, updatedAt: now, messageCount: 0 };
}

export function deleteConversation(id: number): void {
  getDb().prepare("DELETE FROM conversations WHERE id = ?").run(id);
}

export function listMessages(conversationId: number): AgentMessage[] {
  return getDb()
    .prepare("SELECT id, conversation_id, role, content, tool_calls, created_at FROM messages WHERE conversation_id = ? ORDER BY id")
    .all(conversationId)
    .map((r: { id: number; conversation_id: number; role: "user" | "assistant"; content: string; tool_calls: string; created_at: string }) => ({
      id: r.id, conversationId: r.conversation_id, role: r.role, content: r.content, toolCalls: JSON.parse(r.tool_calls || "[]"), createdAt: r.created_at,
    }));
}

function saveMessage(conversationId: number, role: "user" | "assistant", content: string, toolCalls: AgentToolCall[], apiContent: Anthropic.MessageParam[] | null): AgentMessage {
  const now = nowIso();
  const id = getDb()
    .prepare("INSERT INTO messages(conversation_id, role, content, tool_calls, api_content, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(conversationId, role, content, JSON.stringify(toolCalls), apiContent ? JSON.stringify(apiContent) : null, now).lastInsertRowid;
  getDb().prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(now, conversationId);
  return { id, conversationId, role, content, toolCalls, createdAt: now };
}

/** يبني سجل الرسائل لواجهة API من آخر N رسالة محفوظة. */
function buildHistory(conversationId: number, sameModel: boolean): Anthropic.MessageParam[] {
  const rows = getDb()
    .prepare("SELECT role, content, api_content FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 24")
    .all(conversationId)
    .reverse() as { role: "user" | "assistant"; content: string; api_content: string | null }[];
  const out: Anthropic.MessageParam[] = [];
  for (const r of rows) {
    if (r.role === "user") {
      out.push({ role: "user", content: r.content });
      continue;
    }
    if (r.api_content) {
      try {
        const parts = JSON.parse(r.api_content) as Anthropic.MessageParam[];
        for (const p of parts) {
          if (!sameModel && Array.isArray(p.content)) {
            p.content = (p.content as Anthropic.ContentBlockParam[]).filter((b) => b.type !== "thinking" && b.type !== "redacted_thinking");
          }
          if (Array.isArray(p.content) && p.content.length === 0) continue;
          out.push(p);
        }
        continue;
      } catch {
        /* نعود إلى النص */
      }
    }
    if (r.content.trim()) out.push({ role: "assistant", content: r.content });
  }
  // يجب أن يبدأ السجل برسالة مستخدم
  while (out.length && out[0].role !== "user") out.shift();
  return repairToolPairs(out);
}

/** يزيل استدعاءات أدوات بلا نتائج (من محادثة أُوقفت) حتى لا ترفضها الواجهة. */
function repairToolPairs(msgs: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
  const out: Anthropic.MessageParam[] = [];
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    if (m.role === "assistant" && Array.isArray(m.content)) {
      const next = msgs[i + 1];
      const resultIds = new Set(
        next && next.role === "user" && Array.isArray(next.content)
          ? (next.content as Anthropic.ContentBlockParam[]).filter((b) => b.type === "tool_result").map((b) => (b as Anthropic.ToolResultBlockParam).tool_use_id)
          : [],
      );
      const content = (m.content as Anthropic.ContentBlockParam[]).filter((b) => b.type !== "tool_use" || resultIds.has((b as Anthropic.ToolUseBlockParam).id));
      if (content.length === 0) continue;
      out.push({ role: "assistant", content });
      continue;
    }
    if (m.role === "user" && Array.isArray(m.content)) {
      const prev = out[out.length - 1];
      const useIds = new Set(
        prev && prev.role === "assistant" && Array.isArray(prev.content)
          ? (prev.content as Anthropic.ContentBlockParam[]).filter((b) => b.type === "tool_use").map((b) => (b as Anthropic.ToolUseBlockParam).id)
          : [],
      );
      const content = (m.content as Anthropic.ContentBlockParam[]).filter((b) => b.type !== "tool_result" || useIds.has((b as Anthropic.ToolResultBlockParam).tool_use_id));
      if (content.length === 0) continue;
      out.push({ role: "user", content });
      continue;
    }
    out.push(m);
  }
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

const running = new Map<number, AbortController>();

export function stopAgent(conversationId: number): void {
  running.get(conversationId)?.abort();
}

export function isAgentRunning(conversationId: number): boolean {
  return running.has(conversationId);
}

export async function runAgent(conversationId: number, userText: string, emit: (e: AgentEvent) => void): Promise<AgentMessage> {
  const client = getClient();
  if (!client) throw new Error("لم يُضبط مفتاح Anthropic API. أضِفه من الإعدادات لتفعيل الوكيل.");
  if (running.has(conversationId)) throw new Error("الوكيل يعمل على هذه المحادثة الآن");
  const settings = loadSettings();
  const model = currentModel();
  const controller = new AbortController();
  running.set(conversationId, controller);

  saveMessage(conversationId, "user", userText, [], null);
  const lastModel = getDb().prepare("SELECT value FROM meta WHERE key = ?").get(`agent_model_${conversationId}`) as { value: string } | undefined;
  const messages = buildHistory(conversationId, !lastModel || lastModel.value === model);
  getDb().prepare("INSERT OR REPLACE INTO meta(key, value) VALUES (?, ?)").run(`agent_model_${conversationId}`, model);

  const turnParts: Anthropic.MessageParam[] = [];
  const toolCalls: AgentToolCall[] = [];
  let fullText = "";
  let jsonRetries = 0;

  const tools: Anthropic.Messages.ToolUnion[] = [...TOOLS];
  if (settings.useServerWebSearch) tools.push({ type: "web_search_20260209", name: "web_search", max_uses: 5 });

  try {
    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      if (controller.signal.aborted) break;
      const stream = client.messages.stream(
        {
          model,
          max_tokens: 16000,
          system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
          output_config: { effort: settings.effort },
          tools,
          messages,
        },
        { signal: controller.signal },
      );
      stream.on("text", (delta) => {
        fullText += delta;
        emit({ type: "text", conversationId, delta });
      });

      let message: Anthropic.Message;
      try {
        message = await stream.finalMessage();
        jsonRetries = 0;
      } catch (err) {
        if (controller.signal.aborted) break;
        if (err instanceof Anthropic.APIError || jsonRetries++ >= 2) throw err;
        continue;
      }

      if (message.stop_reason === "refusal") {
        emit({ type: "status", conversationId, message: "رفض النموذج إكمال هذا الطلب." });
        break;
      }
      if (message.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: message.content });
        turnParts.push({ role: "assistant", content: message.content });
        continue;
      }
      const toolUses = message.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      messages.push({ role: "assistant", content: message.content });
      turnParts.push({ role: "assistant", content: message.content });
      if (message.stop_reason !== "tool_use" || toolUses.length === 0) break;

      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        const call: AgentToolCall = { id: tu.id, name: tu.name, input: (tu.input ?? {}) as Record<string, unknown> };
        emit({ type: "tool_start", conversationId, call });
        const started = Date.now();
        try {
          const out = await runTool(tu.name, call.input);
          call.result = truncate(out, MAX_TOOL_RESULT);
          results.push({ type: "tool_result", tool_use_id: tu.id, content: call.result });
        } catch (e) {
          call.result = (e as Error).message;
          call.error = true;
          results.push({ type: "tool_result", tool_use_id: tu.id, content: `خطأ: ${call.result}`, is_error: true });
        }
        call.durationMs = Date.now() - started;
        toolCalls.push(call);
        emit({ type: "tool_end", conversationId, call });
        if (fullText && !fullText.endsWith("\n")) {
          fullText += "\n\n";
          emit({ type: "text", conversationId, delta: "\n\n" });
        }
      }
      messages.push({ role: "user", content: results });
      turnParts.push({ role: "user", content: results });
    }
  } catch (e) {
    running.delete(conversationId);
    const msg = describeError(e);
    // نحفظ ما وصل حتى الآن كي لا تضيع المحادثة
    if (fullText.trim()) saveMessage(conversationId, "assistant", fullText, toolCalls, turnParts);
    emit({ type: "error", conversationId, message: msg });
    throw new Error(msg);
  }
  running.delete(conversationId);
  const finalText = fullText.trim() || (controller.signal.aborted ? "(أُوقف الرد)" : "(لا يوجد رد نصي)");
  const saved = saveMessage(conversationId, "assistant", finalText, toolCalls, turnParts);
  emit({ type: "done", conversationId, message: saved });
  return saved;
}
