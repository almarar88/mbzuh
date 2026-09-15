import { useState } from "react";
import type { Settings } from "@shared/types";
import logo from "@/assets/logo.svg";

const SUGGESTED = ["OpenAI", "Claude", "Gemini", "Nvidia", "Apple", "Samsung", "روبوتات", "أمن سيبراني", "هواتف", "نماذج مفتوحة", "Tesla", "Microsoft"];

export function Onboarding({ onDone }: { onDone: (patch: Partial<Settings>) => void }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const toggle = (t: string): void => setPicked((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));
  return (
    <div className="onboard">
      <div className="onboard-card">
        {step === 0 ? (
          <>
            <img src={logo} alt="" style={{ width: 72, height: 72, borderRadius: 18, boxShadow: "0 8px 20px rgb(217 79 36 / .35)" }} />
            <h2 className="text-2xl mt-4">أهلًا بك في نبض التقنية</h2>
            <p className="muted mt-2 leading-relaxed">أخبار التقنية وAI من عشرات المصادر العربية والعالمية وReddit وX، مترجمة إلى العربية، مع وكيل AI يبحث ويحلّل لك.</p>
            <ul className="mt-4 flex flex-col gap-2 text-sm">
              <li>✦ تصنيف تلقائي: AI وتقنية فقط، بلا ضجيج</li>
              <li>🌐 ترجمة تلقائية للعناوين والنص الكامل</li>
              <li>⭐ اهتمامات تُبرز ما يهمّك وتنبّهك عليه</li>
              <li>📊 تحليلات أسبوعية لما تقرأ</li>
            </ul>
            <button className="btn btn-primary w-full mt-6" onClick={() => setStep(1)}>ابدأ</button>
          </>
        ) : (
          <>
            <h2 className="text-2xl">ما الذي يهمّك؟</h2>
            <p className="muted mt-1 text-sm">اختر اهتماماتك لنبرزها في الخلاصة وننبّهك عند ورود أخبار عنها. يمكنك تعديلها لاحقًا من الإعدادات.</p>
            <div className="flex gap-2 flex-wrap mt-4">
              {SUGGESTED.map((t) => (
                <button key={t} className={`chip ${picked.includes(t) ? "chip-accent" : ""}`} onClick={() => toggle(t)}>{t}</button>
              ))}
            </div>
            <div className="flex gap-2 mt-6">
              <button className="btn flex-1" onClick={() => onDone({ onboarded: true })}>تخطٍّ</button>
              <button className="btn btn-accent flex-1" onClick={() => onDone({ onboarded: true, interests: picked })}>حفظ والبدء</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
