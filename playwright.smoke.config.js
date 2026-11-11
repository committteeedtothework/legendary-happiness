import { defineConfig } from "@playwright/test";
import base from "./playwright.config.js";

export default defineConfig({
  ...base,
  testMatch: [
    "build-smoke.spec.js",
    "save-durability.spec.js",
    "world-creation.spec.js",
  ],
  use: { ...base.use, trace: "off" },
  webServer: {
    command: "npm run preview -- --port 5173 --strictPort",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
