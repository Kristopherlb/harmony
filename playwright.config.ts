import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./packages/apps/console/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["html", { open: "never" }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5001",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "pnpm dev:console",
    url: "http://localhost:5001",
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      PORT: "5001",
      // Deterministic fixture mode for /api/chat.
      HARMONY_CHAT_FIXTURE: "workbench-basic",
      // Prevent accidental production behavior.
      NODE_ENV: "test",
    },
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

