
import { createRoot } from "react-dom/client";
import "./index.css";
import "swiper/swiper-bundle.css";
import "flatpickr/dist/flatpickr.css";
import App from "./App.tsx";
import { AppWrapper } from "./components/common/PageMeta.tsx";
import { ThemeProvider } from "./context/ThemeContext.tsx";
import { registerOfflineServiceWorker } from "./offline/registerSw.ts";

// Offline / PWA mode is opt-in (VITE_ENABLE_OFFLINE_MODE=true). With the flag
// off nothing is registered and the app behaves exactly as before.
if (import.meta.env.VITE_ENABLE_OFFLINE_MODE === "true") {
  registerOfflineServiceWorker();
}

createRoot(document.getElementById("root")!).render(

  <ThemeProvider>
    <AppWrapper>
      <App />
    </AppWrapper>
  </ThemeProvider>
  ,
);
