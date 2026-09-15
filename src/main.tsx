import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { UiProvider } from "./components/ui";
import "./index.css";

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
  root.render(
    <StrictMode>
      <UiProvider>
        <App />
      </UiProvider>
    </StrictMode>,
  );
}

void start();
