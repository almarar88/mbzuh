import { useCallback, useEffect, useState } from "react";
import { api, type SystemInfo } from "../lib/api";
import { Badge, Button, EmptyState, Field, Input, Modal, PageHeader, Panel, Select, Toggle, useUi } from "../components/ui";
import { Icon } from "../components/icons";
import { formatDateTime } from "@shared/text";
import { AI_MODELS, type AiEffort, type AiMemoryFact, type AiSettings } from "@shared/types";
import { PORTAL_COLORS, type PortalColor, type PortalConfig, type PortalsState } from "@shared/portals";
import { isMobileRuntime } from "../platform/runtime";

type CredSummary = Record<string, { username: string; autofill: boolean; hasPassword: boolean }>;

export default function SettingsPage({ onThemeChange, onOrgChange }: { onThemeChange: (t: "dark" | "light") => void; onOrgChange: (name: string) => void }) {
  const { toast, confirm } = useUi();
  const mobile = isMobileRuntime();
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [orgName, setOrgName] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [backups, setBackups] = useState<{ path: string; size: number; created_at: string }[]>([]);
  const [ai, setAi] = useState<AiSettings | null>(null);
  const [keyDraft, setKeyDraft] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [portals, setPortals] = useState<PortalsState | null>(null);
  const [creds, setCreds] = useState<CredSummary>({});
  const [editPortal, setEditPortal] = useState<PortalConfig | null>(null);
  const [credPortal, setCredPortal] = useState<PortalConfig | null>(null);
  const [credDraft, setCredDraft] = useState({ username: "", password: "", autofill: true, autoSubmit: true });
  const [memory, setMemory] = useState<AiMemoryFact[]>([]);
  const [memDraft, setMemDraft] = useState("");

  const load = useCallback(async () => {
    const [system, settings, list, aiSettings, portalState, credSummary] = await Promise.all([
      api.settings.info(),
      api.settings.all(),
      api.backup.list(),
      api.ai.settings(),
      api.portal.state(),
      api.portal.credentials(),
    ]);
    setInfo(system);
    setOrgName(settings.org_name ?? system.orgName);
    setTheme(settings.theme === "light" ? "light" : "dark");
    setBackups(list);
    setAi(aiSettings);
    setPortals(portalState);
    setCreds(credSummary);
    setMemory(await api.ai.memory());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const savePrefs = async (prefs: Parameters<typeof api.ai.setPrefs>[0]) => setAi(await api.ai.setPrefs(prefs));

  const savePortals = async (list: PortalConfig[]) => {
    setPortals(await api.portal.save(list));
    toast("تم حفظ البوابات", "ok");
  };

  const movePortal = async (id: string, dir: -1 | 1) => {
    if (!portals) return;
    const list = [...portals.portals];
    const i = list.findIndex((p) => p.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    await savePortals(list);
  };

  return (
    <div>
      <PageHeader title="الإعدادات" subtitle="البوابات وبيانات الدخول، المساعد الذكي والتحكم بالكمبيوتر، المظهر، والنسخ الاحتياطي" />

      <div className="grid gap-4 stagger" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))" }}>
        {/* ------------------------------ البوابات ------------------------------ */}
        <Panel className="col-span-full">
          <div className="flex items-start justify-between gap-2 mb-3 flex-wrap">
            <div>
              <h3 className="font-extrabold text-[15px] flex items-center gap-2">
                <Icon name="globe" size={16} style={{ color: "var(--c-blue)" }} /> البوابات الجامعية
              </h3>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                جلسة دخول واحدة دائمة لكل البوابات (تسجيل دخول مايكروسوفت الموحّد). احفظ بيانات الدخول لتعبئتها تلقائيًا في صفحات الدخول.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() =>
                  setEditPortal({ id: `p${Date.now().toString(36)}`, name: "", url: "", color: "blue", glyph: "•", theme: "modern", dark: false, builtin: false })
                }
              >
                <Icon name="plus" size={14} /> بوابة جديدة
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  if (await api.portal.clearSession()) toast("تم مسح جلسة البوابات", "ok");
                }}
              >
                <Icon name="logout" size={14} /> تسجيل الخروج من الكل
              </Button>
            </div>
          </div>
          <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
            {portals?.portals.map((p, i) => {
              const c = PORTAL_COLORS[p.color];
              const cred = creds[p.id];
              return (
                <div key={p.id} className="panel p-3 flex items-center gap-3" style={{ borderRadius: 20 }}>
                  <span className="portal-glyph" style={{ background: c.bg, color: c.ink }}>
                    {p.glyph}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm truncate">{p.name}</div>
                    <div className="text-[11px] truncate" dir="ltr" style={{ color: "var(--muted)", textAlign: "end" }}>
                      {p.url}
                    </div>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      <Badge tone={p.theme === "modern" ? "info" : "default"}>{p.theme === "modern" ? "مظهر حديث" : "أصلي"}</Badge>
                      {cred?.username ? <Badge tone="ok">دخول محفوظ · {cred.username}</Badge> : <Badge>بلا بيانات دخول</Badge>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="btn-icon" title="بيانات الدخول" onClick={() => {
                        setCredPortal(p);
                        setCredDraft({ username: cred?.username ?? "", password: "", autofill: cred ? cred.autofill : true, autoSubmit: true });
                      }}>
                        <Icon name="shield" size={14} />
                      </Button>
                      <Button size="sm" variant="ghost" className="btn-icon" title="تعديل" onClick={() => setEditPortal(p)}>
                        <Icon name="settings" size={14} />
                      </Button>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="btn-icon" title="أعلى" disabled={i === 0} onClick={() => void movePortal(p.id, -1)}>
                        ↑
                      </Button>
                      <Button size="sm" variant="ghost" className="btn-icon" title="أسفل" disabled={i === portals.portals.length - 1} onClick={() => void movePortal(p.id, 1)}>
                        ↓
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* ------------------------------ المساعد ------------------------------ */}
        <Panel>
          <h3 className="font-extrabold text-[15px] mb-1 flex items-center gap-2">
            <Icon name="sparkles" size={16} style={{ color: "var(--accent)" }} /> المساعد الذكي (Claude API)
          </h3>
          <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
            احصل على مفتاح من console.anthropic.com. {mobile ? "يُخزَّن داخل بيانات التطبيق الخاصة." : "يُخزَّن مشفّرًا على هذا الجهاز ولا يُرسل إلا إلى Claude."}
          </p>
          {ai && (
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Badge tone={ai.hasKey ? "ok" : "warn"}>{ai.hasKey ? `مفتاح محفوظ ${ai.keyHint}` : "لا يوجد مفتاح"}</Badge>
              {ai.hasKey && <Badge tone={ai.encrypted ? "accent" : "default"}>{ai.encrypted ? "مشفّر (DPAPI)" : "غير مشفّر"}</Badge>}
            </div>
          )}
          <Field label={ai?.hasKey ? "استبدال المفتاح" : "مفتاح API"}>
            <div className="flex gap-2">
              <Input type="password" dir="ltr" placeholder="sk-ant-…" value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} />
              <Button
                variant="primary"
                onClick={async () => {
                  setAi(await api.ai.setKey(keyDraft));
                  setKeyDraft("");
                  setTestResult(null);
                  toast("تم حفظ المفتاح", "ok");
                }}
                disabled={!keyDraft.trim()}
              >
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
            <Field label="عمق التفكير">
              <Select value={ai?.effort ?? "medium"} onChange={(e) => void savePrefs({ effort: e.target.value as AiEffort })}>
                <option value="low">سريع</option>
                <option value="medium">متوازن</option>
                <option value="high">عميق</option>
                <option value="xhigh">عميق جدًا</option>
                <option value="max">أقصى</option>
              </Select>
            </Field>
            <Field label="اسمك (للتوقيع)">
              <Input defaultValue={ai?.adminName ?? ""} onBlur={(e) => void savePrefs({ adminName: e.target.value })} placeholder="مثال: خالد المرر" />
            </Field>
            <Field label="مسماك الوظيفي">
              <Input defaultValue={ai?.adminTitle ?? ""} onBlur={(e) => void savePrefs({ adminTitle: e.target.value })} placeholder="مثال: منسق الشؤون الأكاديمية" />
            </Field>
          </div>
          <div className="mt-2">
            <Toggle on={ai?.webSearch ?? true} onChange={(v) => void savePrefs({ webSearch: v })} label="البحث في الإنترنت" hint="يسمح للمساعد بجلب معلومات حديثة من الويب عند الحاجة" />
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Button
              onClick={async () => {
                setTesting(true);
                setTestResult(null);
                setTestResult(await api.ai.test());
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

        {/* ------------------------------ ذاكرة المساعد ------------------------------ */}
        <Panel>
          <h3 className="font-extrabold text-[15px] mb-1 flex items-center gap-2">
            <Icon name="layers" size={16} style={{ color: "var(--c-lime)" }} /> ذاكرة المساعد
          </h3>
          <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
            حقائق يتذكرها المساعد في كل محادثة (مديرك، مسؤولياتك، الجهات التي تتابعها، تفضيلاتك في الصياغة). يضيفها بنفسه عندما يتعلم شيئًا مفيدًا، ويمكنك إضافتها أو حذفها هنا.
          </p>
          <div className="flex gap-2 mb-3">
            <Input value={memDraft} onChange={(e) => setMemDraft(e.target.value)} placeholder="مثال: مديري المباشر هو د. أحمد، وأتابع دورات مركز التعليم المستمر" onKeyDown={async (e) => {
              if (e.key === "Enter" && memDraft.trim()) {
                setMemory(await api.ai.memoryAdd(memDraft));
                setMemDraft("");
              }
            }} />
            <Button
              variant="primary"
              disabled={!memDraft.trim()}
              onClick={async () => {
                setMemory(await api.ai.memoryAdd(memDraft));
                setMemDraft("");
              }}
            >
              إضافة
            </Button>
          </div>
          {memory.length === 0 ? (
            <EmptyState title="الذاكرة فارغة" hint="أخبر المساعد في المحادثة: «تذكّر أن…»" />
          ) : (
            <ul className="space-y-1.5 scroll-y" style={{ maxHeight: 240 }}>
              {memory.map((m) => (
                <li key={m.id} className="flex items-start justify-between gap-2 text-sm">
                  <span style={{ color: "var(--ink-2)" }}>
                    {m.fact}
                    <span className="text-[11px] mx-1" style={{ color: "var(--muted)" }}>
                      · {m.source === "ai" ? "تعلّمها المساعد" : "أضفتها أنت"}
                    </span>
                  </span>
                  <Button size="sm" variant="ghost" className="btn-icon" style={{ width: 26, height: 26 }} onClick={async () => setMemory(await api.ai.memoryDelete(m.id))}>
                    <Icon name="trash" size={12} />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* ------------------------------ التحكم بالكمبيوتر ------------------------------ */}
        <Panel>
          <h3 className="font-extrabold text-[15px] mb-1 flex items-center gap-2">
            <Icon name="monitor" size={16} style={{ color: "var(--c-purple)" }} /> التحكم بالكمبيوتر والبوابات
          </h3>
          <p className="text-xs mb-2" style={{ color: "var(--muted)" }}>
            {ai?.computerAvailable
              ? "قراءة البوابات والتحكم فيها متاحة للمساعد دائمًا على ويندوز. هذا الخيار يضيف التحكم بنظام التشغيل: فتح البرامج والملفات، رؤية الشاشة، النقر والكتابة، وتنفيذ الأوامر."
              : "متاح في نسخة ويندوز فقط. على الهاتف يعمل المساعد على بيانات التطبيق والبحث في الإنترنت."}
          </p>
          <Toggle on={!!ai?.computerControl} onChange={(v) => void savePrefs({ computerControl: v })} label="تفعيل التحكم بالكمبيوتر" hint={ai?.computerAvailable ? "الأدوات تظهر للمساعد فقط عند التفعيل" : "غير متاح على هذه المنصة"} />
          <Toggle on={ai?.confirmCommands ?? true} onChange={(v) => void savePrefs({ confirmCommands: v })} label="طلب موافقتي قبل تنفيذ الأوامر" hint="أوامر PowerShell وكتابة الملفات (يُنصح بإبقائه مفعّلًا)" />
          <Toggle on={ai?.confirmGui ?? false} onChange={(v) => void savePrefs({ confirmGui: v })} label="طلب موافقتي قبل النقر والكتابة" hint="عند التفعيل يتباطأ العمل لكنه أكثر أمانًا" />
          <p className="text-[11px] mt-2" style={{ color: "var(--muted)" }}>
            لا يكتب المساعد كلمات المرور ولا يتجاوز شاشات الأمان، وكل إجراء يظهر في المحادثة مع لقطات الشاشة.
          </p>
        </Panel>

        {/* ------------------------------ عامة ------------------------------ */}
        <Panel>
          <h3 className="font-extrabold text-[15px] mb-3">إعدادات عامة</h3>
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
            <Button
              variant="primary"
              onClick={async () => {
                const name = orgName.trim() || "جامعة محمد بن زايد للعلوم الإنسانية";
                await api.settings.set("org_name", name);
                onOrgChange(name);
                toast("تم الحفظ", "ok");
              }}
            >
              حفظ
            </Button>
          </div>
        </Panel>

        <Panel>
          <h3 className="font-extrabold text-[15px] mb-3">معلومات النظام</h3>
          {!info ? (
            <p style={{ color: "var(--muted)" }}>جارٍ التحميل…</p>
          ) : (
            <dl className="text-sm space-y-2">
              <Row label="التطبيق" value="منصّة الإداري — MBZUH Admin" />
              <Row label="الجهة المطوِّرة" value="Alcode" />
              <Row label="الإصدار" value={info.version} />
              <Row label="المحرّك" value={info.electron} />
              <Row label="حجم قاعدة البيانات" value={`${Math.round(info.dbSize / 1024)} ك.ب`} />
              {!mobile && <Row label="مسار قاعدة البيانات" value={info.dbPath} mono />}
            </dl>
          )}
          {info && !mobile && (
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={() => void api.files.reveal(info.dbPath)}>
                فتح مجلد البيانات
              </Button>
            </div>
          )}
        </Panel>

        <Panel>
          <h3 className="font-extrabold text-[15px] mb-3">النسخ الاحتياطي والاستعادة</h3>
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
            <Button variant="danger" onClick={() => void api.backup.restore()}>
              استعادة من ملف…
            </Button>
          </div>
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
          <h3 className="font-extrabold text-[15px] mb-3">البيانات</h3>
          <p className="text-sm mb-3" style={{ color: "var(--ink-2)" }}>
            بيانات تجريبية لاستكشاف وحدات الدورات، أو تفريغ كامل للبدء ببياناتك. في الحالتين تُحفظ نسخة احتياطية أولًا.
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

      {/* ------------------------------ تعديل بوابة ------------------------------ */}
      <Modal
        open={!!editPortal}
        title={editPortal?.builtin ? "تعديل البوابة" : editPortal?.name ? "تعديل البوابة" : "بوابة جديدة"}
        onClose={() => setEditPortal(null)}
        width={560}
        footer={
          <>
            {editPortal && !editPortal.builtin && portals?.portals.some((p) => p.id === editPortal.id) && (
              <Button
                variant="danger"
                onClick={async () => {
                  if (!(await confirm(`حذف البوابة «${editPortal.name}»؟`))) return;
                  await savePortals(portals!.portals.filter((p) => p.id !== editPortal.id));
                  setEditPortal(null);
                }}
              >
                حذف
              </Button>
            )}
            <span className="flex-1" />
            <Button onClick={() => setEditPortal(null)}>إلغاء</Button>
            <Button
              variant="primary"
              disabled={!editPortal?.name.trim() || !editPortal?.url.trim()}
              onClick={async () => {
                if (!editPortal || !portals) return;
                const exists = portals.portals.some((p) => p.id === editPortal.id);
                const glyph = (editPortal.glyph?.trim() || editPortal.name.trim()).slice(0, 1).toUpperCase();
                const next = { ...editPortal, glyph };
                await savePortals(exists ? portals.portals.map((p) => (p.id === next.id ? next : p)) : [...portals.portals, next]);
                setEditPortal(null);
              }}
            >
              حفظ
            </Button>
          </>
        }
      >
        {editPortal && (
          <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <Field label="الاسم *" className="col-span-2">
              <Input autoFocus value={editPortal.name} onChange={(e) => setEditPortal({ ...editPortal, name: e.target.value })} />
            </Field>
            <Field label="الرابط *" className="col-span-2">
              <Input dir="ltr" value={editPortal.url} onChange={(e) => setEditPortal({ ...editPortal, url: e.target.value })} placeholder="https://…" />
            </Field>
            <Field label="وصف قصير" className="col-span-2">
              <Input value={editPortal.hint ?? ""} onChange={(e) => setEditPortal({ ...editPortal, hint: e.target.value })} />
            </Field>
            <Field label="اللون">
              <Select value={editPortal.color} onChange={(e) => setEditPortal({ ...editPortal, color: e.target.value as PortalColor })}>
                {(Object.keys(PORTAL_COLORS) as PortalColor[]).map((c) => (
                  <option key={c} value={c}>
                    {PORTAL_COLORS[c].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="الحرف">
              <Input value={editPortal.glyph} maxLength={2} onChange={(e) => setEditPortal({ ...editPortal, glyph: e.target.value })} />
            </Field>
            <Field label="المظهر">
              <Select value={editPortal.theme} onChange={(e) => setEditPortal({ ...editPortal, theme: e.target.value as "modern" | "original" })}>
                <option value="modern">حديث (حقن أنماط)</option>
                <option value="original">الأصلي</option>
              </Select>
            </Field>
            <Field label="الوضع الداكن (مع المظهر الحديث)">
              <Select value={editPortal.dark ? "1" : "0"} onChange={(e) => setEditPortal({ ...editPortal, dark: e.target.value === "1" })}>
                <option value="0">فاتح</option>
                <option value="1">داكن</option>
              </Select>
            </Field>
          </div>
        )}
      </Modal>

      {/* ------------------------------ بيانات الدخول ------------------------------ */}
      <Modal
        open={!!credPortal}
        title={`بيانات الدخول — ${credPortal?.name ?? ""}`}
        onClose={() => setCredPortal(null)}
        width={520}
        footer={
          <>
            {creds[credPortal?.id ?? ""] && (
              <Button
                variant="danger"
                onClick={async () => {
                  if (!credPortal) return;
                  setCreds(await api.portal.setCredential(credPortal.id, null));
                  setCredPortal(null);
                  toast("حُذفت بيانات الدخول", "ok");
                }}
              >
                حذف
              </Button>
            )}
            <span className="flex-1" />
            <Button onClick={() => setCredPortal(null)}>إلغاء</Button>
            <Button
              variant="primary"
              disabled={!credDraft.username.trim()}
              onClick={async () => {
                if (!credPortal) return;
                setCreds(await api.portal.setCredential(credPortal.id, { username: credDraft.username.trim(), password: credDraft.password, autofill: credDraft.autofill, autoSubmit: credDraft.autoSubmit }));
                setCredPortal(null);
                toast("تم حفظ بيانات الدخول", "ok");
              }}
            >
              حفظ
            </Button>
          </>
        }
      >
        <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
          تُحفظ البيانات على هذا الجهاز فقط{mobile ? " داخل مساحة التطبيق الخاصة" : " مشفّرةً بمفتاح حساب ويندوز (DPAPI)"}، وتُعبَّأ تلقائيًا في صفحة الدخول. لا تُعرض للمساعد الذكي أبدًا. خطوات التحقق الثنائي (OTP / UAE PASS) تبقى بيدك.
        </p>
        <div className="grid gap-3">
          <Field label="اسم المستخدم / البريد">
            <Input dir="ltr" autoFocus value={credDraft.username} onChange={(e) => setCredDraft({ ...credDraft, username: e.target.value })} placeholder="name@mbzuh.ac.ae" />
          </Field>
          <Field label={creds[credPortal?.id ?? ""]?.hasPassword ? "كلمة المرور (اتركها فارغة للإبقاء على المحفوظة)" : "كلمة المرور"}>
            <Input dir="ltr" type="password" value={credDraft.password} onChange={(e) => setCredDraft({ ...credDraft, password: e.target.value })} />
          </Field>
          <Toggle on={credDraft.autofill} onChange={(v) => setCredDraft({ ...credDraft, autofill: v })} label="تعبئة تلقائية عند فتح صفحة الدخول" />
          <Toggle on={credDraft.autoSubmit} onChange={(v) => setCredDraft({ ...credDraft, autoSubmit: v })} label="الضغط على «التالي/دخول» تلقائيًا" hint="أوقفه إن كانت الصفحة تطلب خطوات إضافية" />
        </div>
      </Modal>
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
