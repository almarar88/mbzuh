/** حاجز أخطاء: يمنع انهيار الواجهة كاملةً عند خطأ في صفحة، ويسجّله ويتيح المتابعة. */
import React from "react";
import { api } from "../lib/api";

type State = { error: Error | null };

export class ErrorBoundary extends React.Component<{ children: React.ReactNode; onReset?: () => void }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    try {
      void api.system.logWrite("error", "ui", `${error.message}\n${info.componentStack ?? ""}`);
    } catch {
      /* السجل ثانوي */
    }
  }

  render(): React.ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="p-6 max-w-lg mx-auto text-center">
        <div className="panel p-6 pop">
          <div className="tool-icon mx-auto" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
            !
          </div>
          <h3 className="font-bold mb-1">حدث خطأ غير متوقع في هذه الصفحة</h3>
          <p className="text-sm mb-3" style={{ color: "var(--muted)" }}>
            سُجّل الخطأ في سجل التشخيص (الإعدادات ← النظام). يمكنك المتابعة دون إعادة تشغيل التطبيق.
          </p>
          <pre className="text-xs text-start whitespace-pre-wrap mb-3 p-2" dir="ltr" style={{ background: "var(--panel-2)", borderRadius: 12, color: "var(--muted)", maxHeight: 120, overflow: "auto" }}>
            {this.state.error.message}
          </pre>
          <button
            className="btn btn-primary"
            onClick={() => {
              this.setState({ error: null });
              this.props.onReset?.();
            }}
          >
            المتابعة
          </button>
        </div>
      </div>
    );
  }
}
