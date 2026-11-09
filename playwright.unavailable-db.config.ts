import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testMatch: "public-fast.spec.ts",
  use: { ...base.use, baseURL: "http://127.0.0.1:3001" },
  webServer: {
    ...(base.webServer as object),
    command: "npm run start -- --port 3001",
    url: "http://127.0.0.1:3001",
    env: {
      NODE_ENV: "production", DATABASE_URL: "postgres://invalid:invalid@127.0.0.1:1/unavailable",
      RESEND_API_KEY: "", EMAIL_FROM: "", ENABLE_DEMO: "false",
      APP_URL: "http://127.0.0.1:3001",
    },
  },
});
