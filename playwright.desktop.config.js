import {defineConfig} from "@playwright/test";
import {resolve} from "node:path";
import base from "./playwright.config.js";
process.env.DCSMCRAFT_STREAM_ARTIFACTS ||= resolve("test-results/desktop-web/streaming");
process.env.DCSMCRAFT_WYVERN_ARTIFACTS ||= resolve("test-results/desktop-web/wyvern");
export default defineConfig({
 ...base,
 testMatch:["overworld-menu-stream.spec.js","game.spec.js","wyvern.spec.js","titan-flight-cyloop.spec.js"],
 grep:/native workers|gather natural logs|progressive mining|shelter survives|atomic saves persist|physical post-parry homing|portal, physical tower|native encounter completes both/,
 timeout:240000,
 reporter:[["list"],["json",{outputFile:"test-results/desktop-web/report.json"}]],
 use:{...base.use,trace:"off",viewport:{width:1280,height:800}},
 webServer:{...base.webServer,reuseExistingServer:false,timeout:60000},
});
