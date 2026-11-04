import { defineConfig } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const testData = mkdtempSync(join(tmpdir(), "leadflow-e2e-"));
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: { baseURL: "http://127.0.0.1:3000", trace: "retain-on-failure" },
  webServer: {
    command: "npm run start",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      NODE_ENV: "production",
      SQLITE_PATH: join(testData, "e2e.sqlite"),
      DATABASE_URL: "",
      RESEND_API_KEY: "",
      EMAIL_FROM: "",
      ENABLE_DEMO: "true",
      TRUST_PROXY: "false",
      APP_URL: "http://127.0.0.1:3000",
    },
  },
});
