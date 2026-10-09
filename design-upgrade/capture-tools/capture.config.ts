import {defineConfig} from '@playwright/test';
import base from './playwright.config';
export default defineConfig({...base,workers:1,retries:0,maxFailures:0,timeout:2400000,
  outputDir:'../design-upgrade/evidence/baseline/2026-10-09/'+(process.env.GITHUB_RUN_ID||'local')+'/test-output',
  reporter:[['list'],['json',{outputFile:'../design-upgrade/evidence/baseline/2026-10-09/'+(process.env.GITHUB_RUN_ID||'local')+'/test-results.json'}]],
  use:{...base.use,trace:'off',screenshot:'off'},
  projects:[{name:'baseline',use:{browserName:'chromium'}}]
});
