/** معالج أول تشغيل: المفتاح، الاسم، البوابات، والتحكم — أربع خطوات قصيرة. */
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Button, Field, Input, Toggle } from "./ui";
import { Icon } from "./icons";
import logoUrl from "../assets/logo.png";
import { isMobileRuntime } from "../platform/runtime";
import type { AiSettings } from "@shared/types";

export function Onboarding({ onDone, onNavigate }: { onDone: () => void; onNavigate: (page: "portals" | "settings" | "assistant") => void }) {
  const mobile = isMobileRuntime();
  const [step, setStep] = useState(0);
  const [ai, setAi] = useState<AiSettings | null>(null);
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [computer, setComputer] = useState(false);

  useEffect(() => {
    void api.ai.settings().then((s) => {
      setAi(s);
      setName(s.adminName);
      setTitle(s.adminTitle);
      setComputer(s.computerControl);
    });
  }, []);

  const finish = async () => {
    await api.settings.set("onboarded", "1");
    onDone();
  };

  const steps = [
    {
      title: "مرحبًا بك في منصّة الإداري",
      body: (
        <div className="text-center">
          <img src={logoUrl} alt="" width={96} height={96} className="mx-auto mb-3 float" />
          <p className="text-sm" style={{ color: "var(--ink-2)" }}>
            كل بوابات الجامعة في مكان واحد، ومساعد ذكي يقرأها وينفّذ أوامرك عليها، ولوحة مهام وروتينات وموجز يومي. أربع خطوات قصيرة وتبدأ.
          </p>
        </div>
      ),
    },
    {
      title: "مفتاح المساعد الذكي",
      body: (
        <div className="grid gap-3">
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            المساعد يعمل بمفتاح Claude API من console.anthropic.com. يُحفظ {mobile ? "داخل بيانات التطبيق الخاصة" : "مشفّرًا على هذا الجهاز"} ولا يُرسل إلا إلى Claude. يمكنك تخطي هذه الخطوة وإضافته لاحقًا من الإعدادات.
          </p>
          {ai?.hasKey && !key && <span className="badge badge-ok">مفتاح محفوظ {ai.keyHint}</span>}
          <Field label="المفتاح">
            <Input type="password" dir="ltr" placeholder="sk-ant-…" value={key} onChange={(e) => setKey(e.target.value)} />
          </Field>
          <div className="flex gap-2 items-center flex-wrap">
            <Button
              variant="primary"
              disabled={!key.trim() || testing}
              onClick={async () => {
                setTesting(true);
                setAi(await api.ai.setKey(key));
                setKey("");
                setTestMsg(await api.ai.test());
                setTesting(false);
              }}
            >
              {testing ? "جارٍ الفحص…" : "حفظ وفحص الاتصال"}
            </Button>
            {testMsg && (
              <span className="text-sm" style={{ color: testMsg.ok ? "var(--ok)" : "var(--danger)" }}>
                {testMsg.message}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      title: "من أنت؟",
      body: (
        <div className="grid gap-3">
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            يستخدم المساعد اسمك ومسماك في توقيع الخطابات والمراسلات، ويتذكّر تفاصيل عملك مع الوقت.
          </p>
          <Field label="اسمك">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: خالد المرر" />
          </Field>
          <Field label="مسماك الوظيفي">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: منسق الشؤون الأكاديمية" />
          </Field>
        </div>
      ),
    },
    {
      title: "البوابات والتحكم",
      body: (
        <div className="grid gap-3">
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            سجّل دخولك مرة واحدة في كل بوابة (Outlook، Teams، UMS، Hub…) من صفحة «البوابات» وتبقى الجلسة محفوظة، ليتمكن المساعد من قراءتها وتنفيذ أوامرك عليها.
          </p>
          {!mobile && ai?.computerAvailable && (
            <Toggle on={computer} onChange={setComputer} label="تفعيل التحكم بالكمبيوتر" hint="فتح البرامج والملفات ورؤية الشاشة والنقر — يطلب موافقتك على الأوامر" />
          )}
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => void finish().then(() => onNavigate("portals"))}>
              <Icon name="globe" size={14} /> فتح البوابات وتسجيل الدخول
            </Button>
          </div>
        </div>
      ),
    },
  ];

  const last = step === steps.length - 1;

  return (
    <div className="modal-backdrop" style={{ alignItems: "center" }}>
      <div className="panel modal-card pop w-full" style={{ maxWidth: 560 }}>
        <div className="px-5 pt-5 pb-2">
          <div className="flex items-center gap-1.5 mb-3">
            {steps.map((_, i) => (
              <span key={i} style={{ height: 5, flex: 1, borderRadius: 99, background: i <= step ? "var(--accent)" : "var(--panel-3)", transition: "background .2s" }} />
            ))}
          </div>
          <h2 className="font-extrabold text-lg mb-3">{steps[step].title}</h2>
          {steps[step].body}
        </div>
        <div className="flex items-center justify-between gap-2 px-5 py-3" style={{ borderTop: "1px solid var(--border)" }}>
          <Button variant="ghost" size="sm" onClick={() => void finish()}>
            تخطّي الآن
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button onClick={() => setStep((s) => s - 1)}>السابق</Button>
            )}
            <Button
              variant="primary"
              onClick={async () => {
                if (step === 2) await api.ai.setPrefs({ adminName: name, adminTitle: title });
                if (last) {
                  if (!mobile) await api.ai.setPrefs({ computerControl: computer });
                  await finish();
                  return;
                }
                setStep((s) => s + 1);
              }}
            >
              {last ? "ابدأ العمل" : "التالي"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
