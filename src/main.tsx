import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource/instrument-serif/latin-400-italic.css";
import { App } from "./App";
import "./styles/base.css";
import "./styles/shell.css";
import "./styles/intro.css";
import "./styles/race.css";
import "./styles/results.css";
import "./styles/replay.css";
import "./styles/apps/shop.css";
import "./styles/apps/calendar.css";
import "./styles/apps/sheet.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
