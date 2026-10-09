import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  workers: 1,
  reporter: "list",
  use: { channel: process.env.PW_CHANNEL || undefined, viewport: { width: 1400, height: 900 } },
});
