import { defineConfig } from "@playwright/test";
import base from "./playwright.config.js";
export default defineConfig({
  ...base,
  webServer: undefined,
  testMatch: ["mobile-controller.spec.js"],
  grep: /touch movement|mobile offline install|portrait menus|Pocket layouts|Lord Verity mobile/,
  timeout: 180000,
  use: { ...base.use, trace: "off" },
  reporter: [
    ["list"],
    [
      "json",
      {
        outputFile:
          (process.env.DCSMCRAFT_MOBILE_ARTIFACTS ||
            "test-results/mobile-release") + "/browser-report.json",
      },
    ],
  ],
});
