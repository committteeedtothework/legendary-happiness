import {defineConfig} from '@playwright/test';
import base from './playwright.config.js';
export default defineConfig({...base,testMatch:['multiplayer.spec.js','survival-coop.spec.js'],timeout:300000,webServer:undefined,use:{...base.use,trace:'off'},reporter:[['list'],['json',{outputFile:(process.env.DCSMCRAFT_TEST_ARTIFACTS||'test-results/multiplayer')+'/legacy-browser-report.json'}]]});
