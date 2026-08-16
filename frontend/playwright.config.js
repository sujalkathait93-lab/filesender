import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.js",
  timeout: 60000,
  fullyParallel: true,
  retries: 0,
  use: { baseURL: "http://localhost:5173", trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: { command: "npm run dev -- --host 127.0.0.1 --port 5173", url: "http://127.0.0.1:5173", reuseExistingServer: true, timeout: 120000 },
});
