import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { initApi } from "./lib/api";
import logo from "./assets/logo.svg";
import "./index.css";

const root = createRoot(document.getElementById("root") as HTMLElement);
root.render(
  <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: "#8b837b" }}>
    <img src={logo} alt="" style={{ width: 84, height: 84, borderRadius: 20 }} />
    <div>نبض التقنية — جارٍ التحضير…</div>
  </div>,
);

initApi()
  .then(() => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  })
  .catch((e: Error) => {
    root.render(<div style={{ padding: 24, color: "#f43f5e" }}>تعذّر تشغيل التطبيق: {e.message}</div>);
  });
