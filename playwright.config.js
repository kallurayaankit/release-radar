import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e',fullyParallel:true,use:{baseURL:'http://127.0.0.1:4173',channel:process.platform==='win32'?'msedge':undefined,trace:'retain-on-failure'},webServer:{command:'node server.mjs',url:'http://127.0.0.1:4173',reuseExistingServer:true},reporter:'list'});
