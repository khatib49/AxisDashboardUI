import { createRoot } from "react-dom/client";
import { ConfigProvider, theme as antdTheme } from "antd";
import "./index.css";
import "swiper/swiper-bundle.css";
import "flatpickr/dist/flatpickr.css";
import App from "./App.tsx";
import { AppWrapper } from "./components/common/PageMeta.tsx";
import { ThemeProvider, useTheme } from "./context/ThemeContext.tsx";
import { registerOfflineServiceWorker } from "./offline/registerSw.ts";

// Offline / PWA mode is opt-in (VITE_ENABLE_OFFLINE_MODE=true). With the flag
// off nothing is registered and the app behaves exactly as before.
if (import.meta.env.VITE_ENABLE_OFFLINE_MODE === "true") {
  registerOfflineServiceWorker();
}

// Ant Design follows the app theme toggle: dark algorithm when the
// ThemeContext is "dark", default algorithm otherwise.
const AntdThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const { theme } = useTheme();
  return (
    <ConfigProvider
      theme={
        theme === "dark"
          ? {
              algorithm: antdTheme.darkAlgorithm,
              // antd's dark placeholder/disabled text (25% white) sits below 3:1 on its surfaces
              token: { colorTextPlaceholder: "rgba(255,255,255,0.45)", colorTextDisabled: "rgba(255,255,255,0.45)" },
            }
          : { algorithm: antdTheme.defaultAlgorithm }
      }
    >
      {children}
    </ConfigProvider>
  );
};

createRoot(document.getElementById("root")!).render(

  <ThemeProvider>
    <AntdThemeProvider>
      <AppWrapper>
        <App />
      </AppWrapper>
    </AntdThemeProvider>
  </ThemeProvider>
  ,
);
