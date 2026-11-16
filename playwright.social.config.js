import {defineConfig} from '@playwright/test';
import base from './playwright.config.js';
export default defineConfig({...base,testMatch:['social-worlds.spec.js'],timeout:360000,reporter:[['list'],['json',{outputFile:(process.env.DCSMCRAFT_TEST_ARTIFACTS||'test-results/social')+'/browser-report.json'}]],use:{...base.use,trace:'off',actionTimeout:30000},webServer:{...base.webServer,command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --config scripts/vite-end-test.config.mjs',reuseExistingServer:false}});
