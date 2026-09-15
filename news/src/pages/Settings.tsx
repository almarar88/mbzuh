import { useEffect, useState } from "react";
import type { Settings } from "@shared/types";
import { api } from "@/lib/api";
import { Spinner, Toggle, useToast } from "@/components/ui";
import { TagInput } from "@/components/TagInput";
import { api as apiShare, isElectron, notifications, shareText } from "@/lib/api";

const MODELS = [
  { id: "claude-opus-5", label: "Claude Opus 5 — الأقوى (افتراضي)" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5 — متوازن وأرخص" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5 — الأسرع والأرخص" },
  { id: "claude-fable-5-1", label: "Claude Fable 5.1 — الأذكى (أغلى)" },
];

export function SettingsPage({ onSaved }: { onSaved: (s: Settings) => void }) {
  const [s, setS] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [notifStatus, setNotifStatus] = useState<"granted" | "denied" | "prompt" | "unsupported">("unsupported");
  const [widgets, setWidgets] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    void api.settings.get().then(setS);
    void notifications.status().then(setNotifStatus);
    void notifications.widgetCount().then(setWidgets);
  }, []);

  if (!s) return <div className="p-10"><Spinner /></div>;

  const patch = (p: Partial<Settings>): void => setS({ ...s, ...p });

  async function save(): Promise<void> {
    if (!s) return;
    setSaving(true);
    try {
      const saved = await api.settings.set(s);
      onSaved(saved);
      toast("حُفظت الإعدادات", "ok");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto page-pad flex flex-col gap-5">
        <div>
          <h1 className="text-2xl">الإعدادات</h1>
          <div className="text-xs" style={{ color: "var(--muted)" }}>كل الإعدادات محلية على جهازك. المفاتيح تُستخدم فقط للاتصال بالخدمة المعنية.</div>
        </div>

        <section className="panel p-5 flex flex-col gap-4">
          <div className="font-bold">⭐ اهتماماتي</div>
          <div>
            <label className="label">كلمات أو جهات تهمّك — تُبرز في الخلاصة وتصلك تنبيهات عنها (اكتب ثم Enter)</label>
            <TagInput value={s.interests} onChange={(v) => patch({ interests: v })} placeholder="مثل: Claude، Nvidia، روبوتات…" accent />
          </div>
          <div>
            <label className="label">كلمات مكتومة — تُخفى الأخبار التي تحتويها</label>
            <TagInput value={s.mutedKeywords} onChange={(v) => patch({ mutedKeywords: v })} placeholder="مثل: عملات رقمية، ألعاب…" />
          </div>
        </section>

        <section className="panel p-5 flex flex-col gap-4">
          <div className="font-bold">🔔 التنبيهات</div>
          <Toggle on={s.notifyNew} onChange={(v) => patch({ notifyNew: v })} label="تنبيهات بالأخبار الجديدة" />
          <Toggle on={s.notifyInterestsOnly} onChange={(v) => patch({ notifyInterestsOnly: v })} label="اهتماماتي فقط (بلا ملخص الأخبار العامة)" />
          <Toggle on={s.backgroundRefresh} onChange={(v) => patch({ backgroundRefresh: v })} label="الجلب في الخلفية والتطبيق مغلق (أندرويد، كل فترة التحديث — الحد الأدنى 15 دقيقة)" />
          <div className="text-[11px] muted">
            {notifStatus === "granted" && "✓ إذن التنبيهات ممنوح."}
            {notifStatus === "prompt" && "لم يُمنح إذن التنبيهات بعد."}
            {notifStatus === "denied" && "إذن التنبيهات مرفوض — فعّله من إعدادات النظام للتطبيق."}
            {notifStatus === "unsupported" && !isElectron() && "التنبيهات متاحة على أندرويد."}
            {isElectron() && "على ويندوز تصلك تنبيهات سطح المكتب عند وجود أخبار جديدة والنافذة في الخلفية."}
            {!isElectron() && " لضمان الوصول في الوقت المحدد، استثنِ التطبيق من «تحسين البطارية» في إعدادات النظام."}
          </div>
          <div className="flex gap-2 flex-wrap">
            {notifStatus !== "granted" && notifStatus !== "unsupported" && (
              <button className="btn btn-accent" onClick={() => void notifications.request().then((ok) => { setNotifStatus(ok ? "granted" : "denied"); toast(ok ? "تم منح الإذن" : "لم يُمنح الإذن", ok ? "ok" : "error"); })}>السماح بالتنبيهات</button>
            )}
            <button className="btn" onClick={() => void notifications.test().then(() => toast("أُرسل تنبيه تجريبي", "ok")).catch((e: Error) => toast(e.message, "error"))}>🔔 تنبيه تجريبي</button>
            {!isElectron() && <button className="btn" onClick={() => void notifications.runBackgroundNow().then(() => toast("بدأ الجلب في الخلفية", "ok")).catch(() => toast("غير متاح هنا", "error"))}>▶ جرّب الجلب في الخلفية الآن</button>}
          </div>
        </section>

        {!isElectron() && (
          <section className="panel p-5 flex flex-col gap-3">
            <div className="font-bold">📱 ويدجت الشاشة الرئيسية</div>
            <p className="text-sm muted leading-relaxed">
              يعرض أحدث الأخبار المترجمة مباشرة على الشاشة الرئيسية ويفتح الخبر بنقرة، ويتحدّث تلقائيًا مع كل جلب (في التطبيق أو في الخلفية).
              لإضافته: اضغط مطوّلًا على مساحة فارغة في الشاشة الرئيسية ← «الودجات» ← «نبض التقنية»، ويمكن تغيير حجمه ليناسب هاتفك أو شاشة Fold المفتوحة.
            </p>
            <div className="text-[11px] muted">{widgets === null ? "" : widgets > 0 ? `✓ مُضاف حاليًا: ${widgets}` : "لم يُضف الويدجت بعد."}</div>
          </section>
        )}

        <section className="panel p-5 flex flex-col gap-4">
          <div className="font-bold">📖 القراءة والعرض</div>
          <div className="two-col">
            <div>
              <label className="label">حجم الخط</label>
              <div className="flex gap-2">
                {[{ v: 0.9, l: "صغير" }, { v: 1, l: "عادي" }, { v: 1.15, l: "كبير" }, { v: 1.3, l: "أكبر" }].map((o) => (
                  <button key={o.v} className={`chip ${Math.abs(s.fontScale - o.v) < 0.01 ? "active" : ""}`} onClick={() => patch({ fontScale: o.v })}>{o.l}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">المظهر</label>
              <div className="flex gap-2">
                <button className={`chip ${s.theme === "auto" ? "active" : ""}`} onClick={() => patch({ theme: "auto" })}>🖥️ تلقائي</button>
                <button className={`chip ${s.theme === "light" ? "active" : ""}`} onClick={() => patch({ theme: "light" })}>☀️ كريمي</button>
                <button className={`chip ${s.theme === "dark" ? "active" : ""}`} onClick={() => patch({ theme: "dark" })}>🌙 داكن</button>
              </div>
            </div>
          </div>
          <Toggle on={s.showImages} onChange={(v) => patch({ showImages: v })} label="عرض الصور في الخلاصة (أطفئه لتوفير البيانات)" />
          <Toggle on={s.compactView} onChange={(v) => patch({ compactView: v })} label="عرض مضغوط (قائمة بدل البطاقات)" />
          <div className="flex gap-2 flex-wrap">
            <button className="btn" onClick={() => void (async () => {
              const md = await apiShare.feed.exportSaved();
              const r = await shareText("محفوظات نبض التقنية", md);
              toast(r === "shared" ? "تمت المشاركة" : "نُسخت المحفوظات كنص Markdown إلى الحافظة", "ok");
            })()}>📤 تصدير المحفوظات (Markdown)</button>
          </div>
        </section>

        <section className="panel p-5 flex flex-col gap-4">
          <div className="font-bold">✨ الوكيل الذكي (Anthropic Claude)</div>
          <div>
            <label className="label">مفتاح Anthropic API</label>
            <div className="flex gap-2">
              <input className="input" dir="ltr" type={showKey ? "text" : "password"} value={s.anthropicApiKey} onChange={(e) => patch({ anthropicApiKey: e.target.value })} placeholder="sk-ant-…" />
              <button className="btn" onClick={() => setShowKey((v) => !v)}>{showKey ? "إخفاء" : "إظهار"}</button>
            </div>
            <div className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
              احصل عليه من <a className="underline cursor-pointer" onClick={() => void api.feed.openExternal("https://console.anthropic.com/settings/keys")}>console.anthropic.com</a>. بلا مفتاح: التطبيق يجلب ويترجم (Google) ويلخّص محليًا، لكن الوكيل والتحليل العميق يتوقفان.
            </div>
          </div>
          <div className="two-col">
            <div>
              <label className="label">النموذج</label>
              <select className="select" value={s.model} onChange={(e) => patch({ model: e.target.value })}>
                {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">عمق التفكير (effort)</label>
              <select className="select" value={s.effort} onChange={(e) => patch({ effort: e.target.value as Settings["effort"] })}>
                <option value="low">منخفض — أسرع وأرخص</option>
                <option value="medium">متوسط (افتراضي)</option>
                <option value="high">عالٍ — أدق تحليلًا</option>
              </select>
            </div>
          </div>
          <Toggle on={s.useServerWebSearch} onChange={(v) => patch({ useServerWebSearch: v })} label="تمكين بحث الويب المدمج من Anthropic لوكيل AI (إضافة إلى أدوات البحث المحلية)" />
        </section>

        <section className="panel p-5 flex flex-col gap-4">
          <div className="font-bold">🌐 الترجمة</div>
          <div>
            <label className="label">مزوّد الترجمة</label>
            <select className="select" value={s.translationProvider} onChange={(e) => patch({ translationProvider: e.target.value as Settings["translationProvider"] })}>
              <option value="auto">تلقائي — Google ثم MyMemory ثم Claude (افتراضي)</option>
              <option value="llm">Claude أولًا — أجود ترجمة (يستهلك رصيد API)</option>
              <option value="google">Google فقط</option>
              <option value="mymemory">MyMemory فقط</option>
              <option value="none">بلا ترجمة</option>
            </select>
          </div>
          <Toggle on={s.autoTranslate} onChange={(v) => patch({ autoTranslate: v })} label="ترجمة العناوين والملخصات تلقائيًا بعد كل تحديث، والمحتوى الكامل عند فتح الخبر" />
        </section>

        <section className="panel p-5 flex flex-col gap-4">
          <div className="font-bold">📡 الجلب والتحديث</div>
          <div className="two-col">
            <div>
              <label className="label">التحديث التلقائي كل (دقائق)</label>
              <input className="input" type="number" min={5} max={720} value={s.refreshMinutes} onChange={(e) => patch({ refreshMinutes: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label">الاحتفاظ بالأخبار (أيام)</label>
              <input className="input" type="number" min={1} max={365} value={s.maxArticleAgeDays} onChange={(e) => patch({ maxArticleAgeDays: Number(e.target.value) })} />
            </div>
          </div>
          <Toggle on={s.autoFetchDetails} onChange={(v) => patch({ autoFetchDetails: v })} label="جلب النص الكامل والصور من صفحة كل خبر تلقائيًا في الخلفية" />
          <div>
            <label className="label">X (تويتر) Bearer Token — اختياري</label>
            <input className="input" dir="ltr" type="password" value={s.xBearerToken} onChange={(e) => patch({ xBearerToken: e.target.value })} placeholder="AAAA…" />
            <div className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>بدونه يُجرَّب الجلب عبر نقاط عامة (syndication وNitter) وهي أفضل جهد. المفتاح من developer.x.com.</div>
          </div>
        </section>


        <div className="flex gap-2 justify-end sticky bottom-0 py-3" style={{ background: "var(--bg)" }}>
          <button className="btn btn-accent" onClick={() => void save()} disabled={saving}>{saving ? <span className="spinner" /> : "💾"} حفظ الإعدادات</button>
        </div>
      </div>
    </div>
  );
}
