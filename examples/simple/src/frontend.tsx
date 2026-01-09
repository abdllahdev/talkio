import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { VoiceAgentDemo } from "./client";
// oxlint-disable-next-line no-unassigned-import
import "./index.css";

// oxlint-disable-next-line no-non-null-assertion
const elem = document.getElementById("root")!;
const app = (
  <StrictMode>
    <VoiceAgentDemo />
  </StrictMode>
);

if (import.meta.hot) {
  const root = (import.meta.hot.data.root ??= createRoot(elem));
  root.render(app);
} else {
  createRoot(elem).render(app);
}
