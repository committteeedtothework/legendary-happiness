import { defineConfig } from "@playwright/test";
import base from "./playwright.config.js";
export default defineConfig({
  ...base,
  webServer: undefined,
  testMatch: ["mobile-upgrade.spec.js"],
  timeout: 180000,
  use: { ...base.use, trace: "off" },
  reporter: [
    ["list"],
    [
      "json",
      {
        outputFile:
          (process.env.DCSMCRAFT_MOBILE_ARTIFACTS ||
            "test-results/mobile-release") + "/upgrade-browser-report.json",
      },
    ],
  ],
});
