import {defineConfig} from '@playwright/test';
import base from './playwright.config.js';
export default defineConfig({...base,testMatch:['multiplayer-update.spec.js'],timeout:240000,
 reporter:[['list'],['json',{outputFile:(process.env.DCSMCRAFT_TEST_ARTIFACTS||'test-results/multiplayer')+'/browser-report.json'}]],
 use:{...base.use,trace:'off'},webServer:{...base.webServer,command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --config scripts/vite-end-test.config.mjs',reuseExistingServer:false}});
