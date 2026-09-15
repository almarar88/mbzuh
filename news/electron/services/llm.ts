/** عميل Anthropic موحّد للترجمة والتحليل والوكيل. */
import Anthropic from "@anthropic-ai/sdk";
import type { LlmStatus } from "@shared/types";
import { anthropicKey, loadSettings } from "./settings";

let cached: { key: string; client: Anthropic } | null = null;

export function llmStatus(): LlmStatus {
  const s = loadSettings();
  return { configured: Boolean(anthropicKey()), model: s.model, provider: "anthropic" };
}

export function getClient(): Anthropic | null {
  const key = anthropicKey();
  if (!key) return null;
  if (cached && cached.key === key) return cached.client;
  const client = new Anthropic({ apiKey: key, maxRetries: 2, timeout: 10 * 60 * 1000 });
  cached = { key, client };
  return client;
}

export function currentModel(): string {
  return loadSettings().model || "claude-opus-5";
}

/** طلب نصي بسيط (بلا أدوات) مع بث لتفادي المهلات على المخرجات الطويلة. */
export async function complete(system: string, user: string, maxTokens = 8000): Promise<string> {
  const client = getClient();
  if (!client) throw new Error("لم يُضبط مفتاح Anthropic API في الإعدادات");
  const s = loadSettings();
  const stream = client.messages.stream({
    model: currentModel(),
    max_tokens: maxTokens,
    system,
    output_config: { effort: s.effort },
    messages: [{ role: "user", content: user }],
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") throw new Error("رفض النموذج الطلب");
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

export function describeError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return "مفتاح Anthropic API غير صالح";
  if (e instanceof Anthropic.RateLimitError) return "تجاوزت حدّ الطلبات لدى Anthropic — حاول بعد قليل";
  if (e instanceof Anthropic.BadRequestError) return `طلب غير صالح: ${e.message}`;
  if (e instanceof Anthropic.APIConnectionError) return "تعذّر الاتصال بخدمة Anthropic";
  if (e instanceof Anthropic.APIError) return `خطأ من Anthropic (${e.status}): ${e.message}`;
  return (e as Error)?.message ?? String(e);
}
