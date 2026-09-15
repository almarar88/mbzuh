import { useCallback, useEffect, useState } from "react";
import { api, type SystemInfo } from "../lib/api";
import { Badge, Button, EmptyState, Field, Input, PageHeader, Panel, Select, useUi } from "../components/ui";
import { Icon } from "../components/icons";
import { formatDateTime } from "@shared/text";
import { AI_MODELS, type AiEffort, type AiSettings, type UmsState } from "@shared/types";

export default function SettingsPage({
  onThemeChange,
  onOrgChange,
}: {
  onThemeChange: (t: "dark" | "light") => void;
  onOrgChange: (name: string) => void;
}) {
  const { toast, confirm } = useUi();
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [orgName, setOrgName] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [backups, setBackups] = useState<{ path: string; size: number; created_at: string }[]>([]);
  const [ai, setAi] = useState<AiSettings | null>(null);
  const [keyDraft, setKeyDraft] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [ums, setUms] = useState<UmsState | null>(null);
  const [umsUrl, setUmsUrl] = useState("");

  const load = useCallback(async () => {
    const [system, settings, list, aiSettings, umsState] = await Promise.all([
      api.settings.info(),
      api.settings.all(),
      api.backup.list(),
      api.ai.settings(),
      api.ums.state(),
    ]);
    setInfo(system);
    setOrgName(settings.org_name ?? system.orgName);
    setTheme(settings.theme === "light" ? "light" : "dark");
    setBackups(list);
    setAi(aiSettings);
    setUms(umsState);
    setUmsUrl(settings.ums_url ?? "https://ums.mbzuh.ac.ae");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveOrg = async () => {
    const name = orgName.trim() || "جامعة محمد بن زايد للعلوم الإنسانية";
    await api.settings.set("org_name", name);
    onOrgChange(name);
    toast("تم حفظ اسم الجهة — سيظهر في ترويسة التقارير", "ok");
  };

  const saveKey = async () => {
    const s = await api.ai.setKey(keyDraft);
    setAi(s);
    setKeyDraft("");
    setTestResult(null);
    toast(s.hasKey ? "تم حفظ المفتاح محليًا" : "تمت إزالة المفتاح", "ok");
  };

  const savePrefs = async (prefs: { model?: string; effort?: string; adminName?: string; adminTitle?: string }) => {
    setAi(await api.ai.setPrefs(prefs));
  };

  return (
    <div>
      <PageHeader title="الإعدادات" subtitle="المساعد الذكي، لوحة UMS، المظهر، والنسخ الاحتياطي — كل البيانات محلية على هذا الجهاز" />

      <div className="grid gap-4 stagger" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))" }}>
        <Panel>
          <h3 className="font-bold text-sm mb-1 flex items-center gap-2">
            <Icon name="sparkles" size={16} style={{ color: "var(--accent)" }} /> المساعد الذكي (Claude API)
          </h3>
          <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
            احصل على مفتاح من console.anthropic.com. يُخزَّن المفتاح مشفّرًا على هذا الجهاز ولا يُرسل إلا إلى Claude.
          </p>
          {ai && (
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Badge tone={ai.hasKey ? "ok" : "warn"}>{ai.hasKey ? `مفتاح محفوظ ${ai.keyHint}` : "لا يوجد مفتاح"}</Badge>
              {ai.hasKey && <Badge tone={ai.encrypted ? "accent" : "default"}>{ai.encrypted ? "مشفّر (DPAPI)" : "غير مشفّر"}</Badge>}
            </div>
          )}
          <Field label={ai?.hasKey ? "استبدال المفتاح" : "مفتاح API"}>
            <div className="flex gap-2">
              <Input
                type="password"
                dir="ltr"
                placeholder="sk-ant-…"
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && keyDraft.trim() && void saveKey()}
              />
              <Button variant="primary" onClick={() => void saveKey()} disabled={!keyDraft.trim()}>
                حفظ
              </Button>
            </div>
          </Field>
          <div className="grid gap-3 mt-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <Field label="النموذج">
              <Select value={ai?.model ?? "claude-opus-5"} onChange={(e) => void savePrefs({ model: e.target.value })}>
                {AI_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="عمق التفكير" hint="أعلى = أدق وأبطأ وأغلى">
              <Select value={ai?.effort ?? "medium"} onChange={(e) => void savePrefs({ effort: e.target.value as AiEffort })}>
                <option value="low">سريع</option>
                <option value="medium">متوازن</option>
                <option value="high">عميق</option>
                <option value="xhigh">عميق جدًا</option>
                <option value="max">أقصى</option>
              </Select>
            </Field>
            <Field label="اسمك (للتوقيع في المراسلات)">
              <Input defaultValue={ai?.adminName ?? ""} onBlur={(e) => void savePrefs({ adminName: e.target.value })} placeholder="مثال: خالد المرر" />
            </Field>
            <Field label="مسماك الوظيفي">
              <Input defaultValue={ai?.adminTitle ?? ""} onBlur={(e) => void savePrefs({ adminTitle: e.target.value })} placeholder="مثال: منسق الشؤون الأكاديمية" />
            </Field>
          </div>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Button
              onClick={async () => {
                setTesting(true);
                setTestResult(null);
                const r = await api.ai.test();
                setTestResult(r);
                setTesting(false);
              }}
              disabled={testing || !ai?.hasKey}
            >
              {testing ? "جارٍ الفحص…" : "فحص الاتصال"}
            </Button>
            {ai?.hasKey && (
              <Button
                variant="danger"
                onClick={async () => {
                  if (!(await confirm("إزالة مفتاح API من هذا الجهاز؟"))) return;
                  setAi(await api.ai.setKey(""));
                  setTestResult(null);
                }}
              >
                إزالة المفتاح
              </Button>
            )}
            {testResult && (
              <span className="text-sm" style={{ color: testResult.ok ? "var(--ok)" : "var(--danger)" }}>
                {testResult.message}
              </span>
            )}
          </div>
        </Panel>

        <Panel>
          <h3 className="font-bold text-sm mb-1 flex items-center gap-2">
            <Icon name="globe" size={16} style={{ color: "var(--accent)" }} /> لوحة نظام الجامعة الموحّد (UMS)
          </h3>
          <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
            تُعرض اللوحة داخل التطبيق بجلسة دائمة تحفظ تسجيل الدخول. المظهر الحديث يُحقن كأنماط فقط ولا يغيّر بيانات النظام.
          </p>
          <Field label="رابط اللوحة">
            <div className="flex gap-2">
              <Input dir="ltr" value={umsUrl} onChange={(e) => setUmsUrl(e.target.value)} />
              <Button
                onClick={async () => {
                  setUms(await api.ums.setHome(umsUrl));
                  toast("تم حفظ الرابط", "ok");
                }}
              >
                حفظ
              </Button>
            </div>
          </Field>
          <div className="grid gap-3 mt-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <Field label="المظهر">
              <Select
                value={ums?.theme ?? "modern"}
                onChange={async (e) => setUms(await api.ums.theme(e.target.value as "modern" | "original", ums?.dark ?? false))}
              >
                <option value="modern">حديث (خط Tajawal، زوايا ناعمة، ظلال)</option>
                <option value="original">الأصلي كما في الموقع</option>
              </Select>
            </Field>
            <Field label="الوضع الداكن للوحة">
              <Select
                value={ums?.dark ? "1" : "0"}
                disabled={ums?.theme !== "modern"}
                onChange={async (e) => setUms(await api.ums.theme("modern", e.target.value === "1"))}
              >
                <option value="0">فاتح</option>
                <option value="1">داكن</option>
              </Select>
            </Field>
          </div>
          <div className="flex gap-2 mt-3 flex-wrap">
            <Button onClick={() => void api.ums.openExternal()}>
              <Icon name="external" size={14} /> فتح في المتصفح
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (await api.ums.clearSession()) toast("تم مسح جلسة UMS", "ok");
              }}
            >
              <Icon name="logout" size={14} /> تسجيل الخروج ومسح الجلسة
            </Button>
          </div>
        </Panel>

        <Panel>
          <h3 className="font-bold text-sm mb-3">إعدادات عامة</h3>
          <Field label="اسم الجهة (يظهر في ترويسة التقارير)">
            <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} />
          </Field>
          <div className="mt-3">
            <Field label="مظهر التطبيق">
              <Select
                value={theme}
                onChange={async (e) => {
                  const next = e.target.value as "dark" | "light";
                  setTheme(next);
                  onThemeChange(next);
                  await api.settings.set("theme", next);
                }}
              >
                <option value="dark">داكن</option>
                <option value="light">فاتح</option>
              </Select>
            </Field>
          </div>
          <div className="mt-4">
            <Button variant="primary" onClick={() => void saveOrg()}>
              حفظ
            </Button>
          </div>
        </Panel>

        <Panel>
          <h3 className="font-bold text-sm mb-3">معلومات النظام</h3>
          {!info ? (
            <p style={{ color: "var(--muted)" }}>جارٍ التحميل…</p>
          ) : (
            <dl className="text-sm space-y-2">
              <Row label="التطبيق" value="منصّة الإداري — MBZUH Admin" />
              <Row label="الجهة المطوِّرة" value="Alcode" />
              <Row label="إصدار البرنامج" value={info.version} />
              <Row label="إصدار Electron" value={info.electron} />
              <Row label="حجم قاعدة البيانات" value={`${Math.round(info.dbSize / 1024)} ك.ب`} />
              <Row label="مسار قاعدة البيانات" value={info.dbPath} mono />
              <Row label="مجلد النسخ الاحتياطية" value={info.backupsDir} mono />
            </dl>
          )}
          {info && (
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={() => void api.files.reveal(info.dbPath)}>
                فتح مجلد البيانات
              </Button>
            </div>
          )}
        </Panel>

        <Panel>
          <h3 className="font-bold text-sm mb-3">النسخ الاحتياطي والاستعادة</h3>
          <div className="flex gap-2 flex-wrap mb-3">
            <Button
              variant="primary"
              onClick={async () => {
                const res = await api.backup.create();
                toast(`تم إنشاء نسخة (${Math.round(res.size / 1024)} ك.ب)`, "ok");
                await load();
              }}
            >
              نسخة احتياطية الآن
            </Button>
            <Button
              onClick={async () => {
                const res = await api.backup.exportTo();
                if (res) toast("تم تصدير النسخة", "ok");
              }}
            >
              تصدير إلى ملف…
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await api.backup.restore();
              }}
            >
              استعادة من ملف…
            </Button>
          </div>
          <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
            يُنشئ النظام نسخة تلقائية عند أول تشغيل كل يوم، ويحتفظ بآخر ٢٠ نسخة.
          </p>
          {backups.length === 0 ? (
            <EmptyState title="لا توجد نسخ محفوظة" />
          ) : (
            <ul className="space-y-1.5 scroll-y" style={{ maxHeight: 220 }}>
              {backups.map((b) => (
                <li key={b.path} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate" title={b.path}>
                    {b.path.split(/[\\/]/).pop()}
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-xs tabular-nums" style={{ color: "var(--muted)" }}>
                      {Math.round(b.size / 1024)} ك.ب · {formatDateTime(b.created_at)}
                    </span>
                    <Button size="sm" onClick={() => void api.backup.restore(b.path)}>
                      استعادة
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <h3 className="font-bold text-sm mb-3">البيانات</h3>
          <p className="text-sm mb-3" style={{ color: "var(--ink-2)" }}>
            يمكنك تعبئة النظام ببيانات تجريبية لاستكشاف الوحدات، أو تفريغه بالكامل للبدء ببياناتك الحقيقية. في الحالتين تُحفظ نسخة
            احتياطية أولًا.
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={async () => {
                const res = await api.demo.seed();
                toast(res.message, res.ok ? "ok" : "danger");
                await load();
              }}
            >
              إضافة بيانات تجريبية
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (!(await confirm("تفريغ قاعدة البيانات بالكامل؟", "ستُحفظ نسخة احتياطية قبل الحذف."))) return;
                const res = await api.demo.reset();
                toast(res.message, res.ok ? "ok" : "danger");
                await load();
              }}
            >
              تفريغ كل البيانات
            </Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt style={{ color: "var(--muted)" }}>{label}</dt>
      <dd className="text-end truncate" title={value} style={{ color: "var(--ink-2)", fontFamily: mono ? "monospace" : undefined, maxWidth: "60%" }}>
        {value}
      </dd>
    </div>
  );
}
