import { defineConfig } from "@playwright/test";
import base from "./playwright.config.js";

export default defineConfig({
  ...base,
  testMatch: ["game.spec.js", "survival-coop.spec.js", "giganto.spec.js"],
  // Tracing embeds the entire 134 MB offline script in each action snapshot.
  // Screenshots and assertion output remain available without that overhead.
  use: { ...base.use, trace: "off" },
});
