import { defineConfig } from "@playwright/test";
import base from "./playwright.config.js";
export default defineConfig({
  ...base,
  testMatch: ["verity.spec.js"],
  timeout: 180000,
  use: { ...base.use, trace: "off", actionTimeout: 30000 },
  reporter: [
    ["list"],
    [
      "json",
      {
        outputFile:
          (process.env.DCSMCRAFT_TEST_ARTIFACTS || "test-results/verity") +
          "/browser-report.json",
      },
    ],
  ],
  webServer: {
    ...base.webServer,
    command:
      "node node_modules/vite/bin/vite.js --host 127.0.0.1 --config scripts/vite-end-test.config.mjs",
    reuseExistingServer: false,
  },
});
