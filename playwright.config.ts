// Playwright configuration for the e2e suite under ./e2e.
//
// The repo does not ship @playwright/test (no new dependencies); the runners
// under e2e/ are plain node scripts driven by the globally installed
// `playwright` package and read their settings from e2e/lib/config.mjs. This
// file mirrors those settings so `npx playwright test` works unchanged if
// @playwright/test is ever added, and documents the environment variables.
//
//   E2E_BASE_URL  UI origin      (default http://localhost:5173)
//   E2E_API_URL   API base URL   (default http://localhost:5068/api)
//   E2E_PASSWORD  seeded account password (default Axis@12345)
const config = {
  testDir: "./e2e",
  testMatch: /.*\.spec\.(ts|mjs)$/,
  outputDir: "./e2e/report/test-results",
  timeout: 60_000,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "e2e/report/playwright.json" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:5173",
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true,
    screenshot: "only-on-failure",
  },
};

export default config;
