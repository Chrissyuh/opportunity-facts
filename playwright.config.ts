import { defineConfig } from "@playwright/test";

const port = 4387;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 2,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "test-results/playwright-report" }],
  ],
  outputDir: "test-results/playwright",
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    colorScheme: "light",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    env: {
      OPENAI_API_KEY: "",
      NEXT_PUBLIC_SITE_URL: baseURL,
    },
    reuseExistingServer: false,
    timeout: 180_000,
    url: baseURL,
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        browserName: "chromium",
        viewport: { width: 1_440, height: 900 },
      },
    },
    {
      name: "mobile-chromium",
      use: {
        browserName: "chromium",
        hasTouch: true,
        isMobile: true,
        viewport: { width: 390, height: 844 },
      },
    },
  ],
});
