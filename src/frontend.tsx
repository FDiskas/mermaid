/**
 * Entry point: mounts the React app. Included by `src/index.html`.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { I18nProvider } from "./lib/i18n";

const elem = document.getElementById("root")!;
const app = (
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>
);

// https://bun.com/docs/bundler/hot-reloading#import-meta-hot-data
if (import.meta.hot) {
  (import.meta.hot.data.root ??= createRoot(elem)).render(app);
} else {
  createRoot(elem).render(app);
}
