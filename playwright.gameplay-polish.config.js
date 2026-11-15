import { defineConfig } from "@playwright/test";
import base from "./playwright.config.js";
export default defineConfig({
  ...base,
  testMatch: ["gameplay-polish.spec.js"],
  timeout: 180000,
  reporter: [
    ["list"],
    [
      "json",
      {
        outputFile: "/workspace/artifacts/gameplay-polish/browser-report.json",
      },
    ],
  ],
  use: { ...base.use, trace: "off" },
  webServer: {
    ...base.webServer,
    command:
      "node node_modules/vite/bin/vite.js --host 127.0.0.1 --config scripts/vite-end-test.config.mjs",
    reuseExistingServer: false,
  },
});
