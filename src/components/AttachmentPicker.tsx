/** مرفقات المحادثة: اختيار من الجهاز، لصق صورة، أو سحب وإفلات — تظهر كرقائق قبل الإرسال. */
import { useCallback, useEffect } from "react";
import { api } from "../lib/api";
import { Button, useUi } from "./ui";
import { Icon } from "./icons";
import { isMobileRuntime } from "../platform/runtime";
import type { AiAttachment } from "@shared/types";

const MAX = 25 * 1024 * 1024;

export async function fileToAttachment(f: File): Promise<AiAttachment | null> {
  if (f.size > MAX) return null;
  const buf = new Uint8Array(await f.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  const name = f.name || (f.type.startsWith("image/") ? `لصق-${Date.now()}.${f.type.split("/")[1] === "jpeg" ? "jpg" : "png"}` : `ملف-${Date.now()}`);
  return { name, data: btoa(s), size: f.size };
}

export function useAttachmentDrop(add: (list: AiAttachment[]) => void) {
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])];
      if (!files.length) return;
      const out = (await Promise.all(files.map(fileToAttachment))).filter((x): x is AiAttachment => !!x);
      if (out.length) {
        e.preventDefault();
        add(out);
      }
    };
    const onDrop = async (e: DragEvent) => {
      const files = [...(e.dataTransfer?.files ?? [])];
      if (!files.length) return;
      e.preventDefault();
      const out = (await Promise.all(files.map(fileToAttachment))).filter((x): x is AiAttachment => !!x);
      if (out.length) add(out);
    };
    const onDrag = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
    };
    window.addEventListener("paste", onPaste);
    window.addEventListener("drop", onDrop);
    window.addEventListener("dragover", onDrag);
    return () => {
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("dragover", onDrag);
    };
  }, [add]);
}

export function AttachmentBar({ items, onChange, disabled }: { items: AiAttachment[]; onChange: (list: AiAttachment[]) => void; disabled?: boolean }) {
  const { toast } = useUi();
  const mobile = isMobileRuntime();

  const pick = useCallback(async () => {
    if (mobile) {
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = true;
      input.accept = ".pdf,.docx,.xlsx,.xlsm,.pptx,.csv,.txt,.md,.json,image/*";
      input.style.display = "none";
      document.body.appendChild(input);
      input.onchange = async () => {
        const files = [...(input.files ?? [])];
        const out = (await Promise.all(files.map(fileToAttachment))).filter((x): x is AiAttachment => !!x);
        if (files.length && !out.length) toast("الملف أكبر من 25 م.ب", "danger");
        onChange([...items, ...out].slice(0, 8));
        input.remove();
      };
      input.click();
      return;
    }
    const picked = await api.ai.pickAttachments();
    if (picked.length) onChange([...items, ...picked].slice(0, 8));
  }, [items, mobile, onChange, toast]);

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Button size="sm" variant="ghost" className="btn-icon" title="إرفاق ملف (PDF، Word، Excel، PowerPoint، صورة…) — أو الصق/اسحب" disabled={disabled} onClick={() => void pick()}>
        <Icon name="paperclip" size={16} />
      </Button>
      {items.map((a, i) => (
        <span key={`${a.name}-${i}`} className="badge badge-info" style={{ fontSize: 11.5, paddingInlineEnd: 4 }}>
          <Icon name="file" size={12} /> {a.name.length > 28 ? `${a.name.slice(0, 25)}…` : a.name}
          <span style={{ opacity: 0.7 }}>· {Math.max(1, Math.round(a.size / 1024))} ك.ب</span>
          <button className="btn btn-ghost btn-icon" style={{ width: 18, height: 18, padding: 0, marginInlineStart: 2 }} title="إزالة" onClick={() => onChange(items.filter((_, k) => k !== i))}>
            <Icon name="x" size={11} />
          </button>
        </span>
      ))}
    </div>
  );
}
