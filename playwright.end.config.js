import { defineConfig } from "@playwright/test";
import base from "./playwright.config.js";
export default defineConfig({
  ...base,
  testMatch: ["end-update.spec.js"],
  timeout: 240000,
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/end/report.json" }],
  ],
  use: { ...base.use, trace: "off" },
  webServer: {
    ...base.webServer,
    command:
      "node node_modules/vite/bin/vite.js --host 0.0.0.0 --config scripts/vite-end-test.config.mjs",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
