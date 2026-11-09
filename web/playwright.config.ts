import { defineConfig } from "@playwright/test";

// Expects the site (npm run dev) with N8N_URL and CODEX_RUNNER_URL pointing at e2e/mock-pipeline.mjs, on a copy of the database.
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  timeout: 90000,
  expect: { timeout: 20000 },
  reporter: "list",
  use: { baseURL: process.env.BASE_URL || "http://localhost:3001", headless: true, viewport: { width: 1280, height: 800 } },
});
