import{defineConfig}from'@playwright/test';import base from'./playwright.end.config.js';
export default defineConfig({...base,testMatch:['end-cities.spec.js','end-update.spec.js'],timeout:240000,reporter:[['list'],['json',{outputFile:'/workspace/artifacts/end-cities/end-browser-report.json'}]]});
