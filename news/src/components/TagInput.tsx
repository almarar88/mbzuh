import { useState } from "react";

/** إدخال كلمات كشرائح: Enter أو فاصلة للإضافة. */
export function TagInput({ value, onChange, placeholder, accent }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; accent?: boolean }) {
  const [draft, setDraft] = useState("");
  const add = (): void => {
    const parts = draft.split(/[,،\n]/).map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    onChange([...new Set([...value, ...parts])].slice(0, 40));
    setDraft("");
  };
  return (
    <div className="tag-input">
      {value.map((t) => (
        <span key={t} className={`chip ${accent ? "chip-accent" : ""}`} onClick={() => onChange(value.filter((x) => x !== t))} title="إزالة">{t} ✕</span>
      ))}
      <input
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={add}
      />
    </div>
  );
}
