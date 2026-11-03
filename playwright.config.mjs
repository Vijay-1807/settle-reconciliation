import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  expect: { timeout: 7000 },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "output/playwright-report" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:3100",
    channel: process.env.CI ? undefined : "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    {
      name: "mobile",
      use: {
        ...devices["iPhone 13"],
        defaultBrowserType: "chromium",
        channel: process.env.CI ? undefined : "chrome",
      },
    },
  ],
  webServer: {
    command: "node src/local.mjs",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    env: { PORT: "3100", LOCAL_DB_PATH: `.data/e2e-${Date.now()}.sqlite` },
    timeout: 30000,
  },
  outputDir: "output/playwright-results",
});
