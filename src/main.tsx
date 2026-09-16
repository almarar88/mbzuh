import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { UiProvider } from "./components/ui";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";

function installErrorLogging(): void {
  const write = (level: "error" | "warn", source: string, message: string) => {
    try {
      void window.dynamo?.invoke("system:logWrite", level, source, message);
    } catch {
      /* تجاهل */
    }
  };
  window.addEventListener("error", (e) => write("error", "window", `${e.message} @ ${e.filename}:${e.lineno}`));
  window.addEventListener("unhandledrejection", (e) => write("error", "promise", String((e.reason as Error)?.stack ?? e.reason)));
}

async function start(): Promise<void> {
  const root = createRoot(document.getElementById("root") as HTMLElement);
  if (!window.dynamo) {
    // بيئة الجوال/المتصفح: نشغّل طبقة البيانات داخل المتصفح قبل رسم الواجهة.
    root.render(
      <div style={{ height: "100%", display: "grid", placeItems: "center", color: "#8d8496", fontFamily: "Tajawal, sans-serif" }}>
        جارٍ تجهيز التطبيق…
      </div>,
    );
    try {
      const { bootMobile } = await import("./platform/mobile-bridge");
      await bootMobile();
    } catch (error) {
      root.render(
        <div style={{ padding: 24, color: "#ff8f84", fontFamily: "Tajawal, sans-serif" }}>
          تعذّر تشغيل التطبيق: {error instanceof Error ? error.message : String(error)}
        </div>,
      );
      return;
    }
  }
  installErrorLogging();
  root.render(
    <StrictMode>
      <UiProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </UiProvider>
    </StrictMode>,
  );
}

void start();
