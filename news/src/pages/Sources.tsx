import { useEffect, useState } from "react";
import type { Source, SourceKind } from "@shared/types";
import { api } from "@/lib/api";
import { Spinner, Toggle, useToast, KindIcon } from "@/components/ui";
import { timeAgo } from "@/lib/format";

const KIND_LABEL: Record<SourceKind, string> = { rss: "خلاصة RSS", reddit: "Reddit", x: "حساب X", gnews: "أخبار Google" };
const KIND_HINT: Record<SourceKind, string> = {
  rss: "رابط الخلاصة، مثل https://example.com/feed/",
  reddit: "اسم المجتمع بدون r/، مثل artificial",
  x: "اسم الحساب بدون @، مثل OpenAI",
  gnews: "كلمات البحث، مثل: الذكاء الاصطناعي OR روبوتات",
};

export function SourcesPage({ onRefreshed }: { onRefreshed: () => void }) {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [form, setForm] = useState<{ kind: SourceKind; name: string; target: string; lang: "ar" | "en"; techOnly: boolean }>({ kind: "rss", name: "", target: "", lang: "ar", techOnly: true });
  const { toast } = useToast();

  const load = (): void => {
    void api.sources.list().then((s) => {
      setSources(s);
      setLoading(false);
    });
  };
  useEffect(load, []);

  async function toggle(s: Source, enabled: boolean): Promise<void> {
    await api.sources.update(s.id, { enabled });
    setSources((list) => list.map((x) => (x.id === s.id ? { ...x, enabled: enabled ? 1 : 0 } : x)));
  }

  async function add(): Promise<void> {
    if (!form.target.trim()) return toast("أدخل الهدف (الرابط/الاسم)", "error");
    try {
      const name = form.name.trim() || (form.kind === "reddit" ? `r/${form.target.trim()}` : form.kind === "x" ? `@${form.target.trim()}` : form.target.trim());
      const s = await api.sources.add({ ...form, name });
      toast("أُضيف المصدر — جارٍ اختباره…", "ok");
      setForm({ kind: "rss", name: "", target: "", lang: "ar", techOnly: true });
      load();
      await test(s.id, true);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function test(id: number, thenRefresh = false): Promise<void> {
    setBusy(id);
    try {
      const r = await api.sources.test(id);
      toast(`✓ ${r.count} عنصر — مثال: ${r.sample[0] ?? ""}`, "ok");
      if (thenRefresh) {
        await api.feed.refresh([id]);
        onRefreshed();
        load();
      }
    } catch (e) {
      toast(`✗ ${(e as Error).message}`, "error");
    } finally {
      setBusy(null);
    }
  }

  async function remove(s: Source): Promise<void> {
    if (!confirm(`حذف المصدر «${s.name}» وكل أخباره؟`)) return;
    await api.sources.delete(s.id);
    load();
    onRefreshed();
  }

  const groups: SourceKind[] = ["rss", "gnews", "reddit", "x"];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto page-pad">
        <h1 className="text-2xl mb-1">المصادر</h1>
        <div className="text-xs mb-5" style={{ color: "var(--muted)" }}>الأخبار تُجلب مباشرة من هذه المصادر. المصادر غير التقنية (مثل أخبار Google العامة) تُفلتر آليًا لتبقى الأخبار التقنية فقط.</div>

        <div className="panel p-4 mb-6">
          <div className="font-semibold mb-3">＋ إضافة مصدر</div>
          <div className="sources-form">
            <div>
              <label className="label">النوع</label>
              <select className="select" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as SourceKind })}>
                {groups.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{KIND_HINT[form.kind]}</label>
              <input className="input" dir="ltr" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} placeholder={KIND_HINT[form.kind]} />
            </div>
            <div>
              <label className="label">الاسم (اختياري)</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">اللغة</label>
              <select className="select" value={form.lang} onChange={(e) => setForm({ ...form, lang: e.target.value as "ar" | "en" })}>
                <option value="ar">عربي</option>
                <option value="en">إنجليزي</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-3 flex-wrap">
            <Toggle on={form.techOnly} onChange={(v) => setForm({ ...form, techOnly: v })} label="مصدر تقني بالكامل (لا يُفلتر)" />
            <button className="btn btn-accent ms-auto" onClick={() => void add()}>إضافة واختبار</button>
          </div>
        </div>

        {loading ? (
          <Spinner label="جارٍ التحميل…" />
        ) : (
          groups.map((kind) => {
            const list = sources.filter((s) => s.kind === kind);
            if (!list.length) return null;
            return (
              <div key={kind} className="mb-6">
                <div className="font-semibold mb-2 flex items-center gap-2"><KindIcon kind={kind} /> {KIND_LABEL[kind]} <span className="badge badge-muted">{list.length}</span></div>
                {kind === "x" && (
                  <div className="text-[11px] mb-2" style={{ color: "var(--muted)" }}>X لا يوفر واجهة مجانية؛ الجلب بلا مفتاح يعتمد على نقاط عامة قد تتوقف أحيانًا. لجلب موثوق أضف X Bearer Token من الإعدادات.</div>
                )}
                {kind === "reddit" && (
                  <div className="text-[11px] mb-2" style={{ color: "var(--muted)" }}>يُستخدم JSON العام لـ Reddit ثم خلاصة RSS كبديل. قد يُحدّ الطلب مؤقتًا عند التحديث المتكرر.</div>
                )}
                <div className="flex flex-col gap-2">
                  {list.map((s) => (
                    <div key={s.id} className="source-row" style={{ opacity: s.enabled ? 1 : 0.55 }}>
                      <Toggle on={Boolean(s.enabled)} onChange={(v) => void toggle(s, v)} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{s.name} <span className="badge badge-muted">{s.lang === "ar" ? "عربي" : "إنجليزي"}</span> {!s.techOnly && <span className="badge badge-muted">مُفلتر</span>}</div>
                        <div className="text-[11px] truncate" dir="ltr" style={{ color: "var(--muted)", textAlign: "left" }}>{s.target}</div>
                      </div>
                      <div className="text-[11px] text-end shrink-0" style={{ color: s.lastError ? "var(--danger)" : "var(--muted)" }}>
                        <div>{s.itemCount} خبر</div>
                        <div title={s.lastError ?? ""}>{s.lastError ? `✗ ${s.lastError.slice(0, 40)}` : s.lastFetchedAt ? `✓ ${timeAgo(s.lastFetchedAt)}` : "لم يُجلب بعد"}</div>
                      </div>
                      <button className="btn btn-sm" onClick={() => void test(s.id)} disabled={busy === s.id}>{busy === s.id ? <span className="spinner" /> : "اختبار"}</button>
                      <button className="btn btn-sm btn-ghost btn-danger" onClick={() => void remove(s)} title="حذف">🗑️</button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
