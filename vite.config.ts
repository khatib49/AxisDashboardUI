import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // No @types/node in this project: reach process through globalThis.
  const cwd = (globalThis as { process?: { cwd(): string } }).process?.cwd() ?? ".";
  const env = loadEnv(mode, cwd, "");
  // Offline (PWA) support is opt-in: without VITE_ENABLE_OFFLINE_MODE=true the
  // build is byte-for-byte what it was before (no sw.js, no manifest).
  const offlineMode = env.VITE_ENABLE_OFFLINE_MODE === "true";

  return {
    plugins: [
      react(),
      svgr({
        svgrOptions: {
          icon: true,
          // This will transform your SVG to a React component
          exportType: "named",
          namedExport: "ReactComponent",
        },
      }),
      ...(offlineMode
        ? [
            VitePWA({
              registerType: "autoUpdate",
              // src/main.tsx registers /sw.js itself (behind the same flag).
              injectRegister: null,
              includeAssets: ["favicon.svg", "favicon.png", "favicon-32x32.png", "images/logo/*.svg"],
              manifest: {
                name: "AXIS Admin",
                short_name: "AXIS",
                description: "AXIS Admin — operations console for AXIS Game Lounge.",
                start_url: "/",
                scope: "/",
                display: "standalone",
                background_color: "#0b1220",
                theme_color: "#5b8def",
                icons: [
                  { src: "/favicon.png", sizes: "48x48", type: "image/png" },
                  { src: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
                  { src: "/images/logo/axis-mark.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
                  { src: "/images/logo/logo-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
                ],
              },
              workbox: {
                // App shell precache.
                globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff,woff2}"],
                globIgnores: ["**/images/carousel/**", "**/images/video-thumb/**", "**/images/product/**"],
                maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
                navigateFallback: "/index.html",
                navigateFallbackDenylist: [/^\/api\//],
                cleanupOutdatedCaches: true,
                clientsClaim: true,
                skipWaiting: true,
                runtimeCaching: [
                  {
                    // RegExp patterns match from the start of the href so they also
                    // work when the API lives on another origin (VITE_API_BASE_URL).
                    // runtimeCaching routes are GET-only by default; POST/PUT never
                    // touch the service worker.
                    urlPattern: /^https?:\/\/[^/]+\/api\/offline\/snapshot\/?(\?.*)?$/i,
                    handler: "NetworkFirst",
                    options: {
                      cacheName: "axis-offline-snapshot",
                      networkTimeoutSeconds: 5,
                      expiration: { maxEntries: 4, maxAgeSeconds: 7 * 24 * 60 * 60 },
                      cacheableResponse: { statuses: [0, 200] },
                    },
                  },
                  {
                    urlPattern: /^https?:\/\/[^/]+\/api\/(item|category|menu)(\/|\?|$)/i,
                    handler: "NetworkFirst",
                    options: {
                      cacheName: "axis-menu",
                      networkTimeoutSeconds: 5,
                      expiration: { maxEntries: 300, maxAgeSeconds: 24 * 60 * 60 },
                      cacheableResponse: { statuses: [0, 200] },
                    },
                  },
                  {
                    urlPattern: /^https?:\/\/[^/]+\/api\//i,
                    handler: "NetworkOnly",
                  },
                ],
              },
            }),
          ]
        : []),
    ],
  };
});
