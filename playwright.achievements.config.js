import {defineConfig} from "@playwright/test";
import base from "./playwright.desktop.config.js";
export default defineConfig({...base,testMatch:["achievements.spec.js"],grep:undefined,reporter:[["list"],["json",{outputFile:"test-results/achievements/report.json"}]]});
