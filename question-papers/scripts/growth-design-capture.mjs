// Read-only, localhost-only visual evidence for the accepted GT Papers redesign.
// Uses existing synthetic developer transport; does not call production services
// or change any student record. Never treat this as authenticated functional QA.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
const {chromium}=createRequire(new URL('../../gtop-app/package.json',import.meta.url))('@playwright/test');
const base=new URL('http://127.0.0.1:4317/');
const out=process.env.GTOP_PAPERS_RENDER_DIR||path.join(process.env.RUNNER_TEMP||'/tmp','gtop-growth-capture');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const findings=[];
try{
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
    for(const state of ['desk','review']){
      const page=await browser.newPage({viewport,deviceScaleFactor:1,reducedMotion:'reduce'});
      const errors=[],forbidden=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.route('**/*',route=>{
        const url=new URL(route.request().url());
        if(url.origin!==base.origin){forbidden.push(url.origin+url.pathname);return route.abort();}
        return route.continue();
      });
      const route=state==='desk'?'?fixture=desk':'?fixture=desk&check=fixture-paper&sheet=fixture-sheet';
      await page.goto(new URL(route,base).href,{waitUntil:'networkidle'});
      await page.evaluate(()=>document.fonts.ready);
      if(state==='desk'){
        await page.locator('.overview-grid').waitFor({state:'visible'});
        assert.equal(await page.locator('.overview-card').count(),4);
        assert(await page.locator('.desk-book').evaluate(img=>img.complete&&img.naturalWidth>0),'Approved logo did not load');
      }else{
        await page.locator('.split').waitFor({state:'visible'});
        await page.locator('.inspector').waitFor({state:'visible'});
        // Fixture has no real scans by design. Add a clearly labeled synthetic
        // paper only in the disposable browser DOM to judge layout composition.
        await page.evaluate(()=>{
          const viewer=document.querySelector('.scan-window');
          if(!viewer||viewer.querySelector('img'))return;
          const paper=document.createElement('div');
          paper.setAttribute('role','img');
          paper.setAttribute('aria-label','Synthetic handwriting used for visual layout checks only');
          paper.style.cssText='box-sizing:border-box;max-width:560px;min-height:530px;margin:15px auto;padding:26px 30px;background:repeating-linear-gradient(#fffdfa,#fffdfa 35px,#cfe0e7 36px);border-left:2px solid #d9b3a1;box-shadow:0 5px 18px #203b2b23;color:#233c87;font:italic 22px/36px cursive;overflow:hidden;';
          paper.textContent='Q1. Solve 2x + 3 = 11.\nSolution:\n2x + 3 = 11\n2x = 11 - 3\n2x = 8\nx = 4';
          paper.style.whiteSpace='pre-line';
          viewer.appendChild(paper);
        });
      }
      const checks=await page.evaluate(()=>{
        const selector=state=>{const el=document.querySelector(state);if(!el)return null;const box=el.getBoundingClientRect();return {x:box.x,y:box.y,width:box.width,height:box.height,visible:box.width>0&&box.height>0};};
        return {scrollWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth,
          header:selector('.desk-bar')||selector('.desk-header'),home:selector('.desk-home'),
          cards:selector('.overview-grid'),scan:selector('.scan-window'),inspector:selector('.inspector'),
          reviewQueue:selector('.review-queue')};
      });
      assert(checks.scrollWidth<=viewport.width+2,'Horizontal document overflow in '+state+' '+viewport.width);
      if(state==='review'&&viewport.width<600){
        assert(checks.scan?.visible,'Mobile scan should be visible');
        assert(checks.inspector?.visible,'Mobile mark reasoning should be visible');
      }
      assert.equal(forbidden.length,0,'Fixture attempted remote network');
      assert.deepEqual(errors,[],'Browser page errors');
      const name='growth-'+state+'-'+viewport.width+'x'+viewport.height+'.jpg';
      const bytes=await page.screenshot({type:'jpeg',quality:72,fullPage:true,animations:'disabled'});
      await writeFile(path.join(out,name),bytes);
      // Small deterministic JPEGs are echoed for independent visual inspection
      // without external artifact hosting or authenticated application data.
      console.log('GTOP_GROWTH_VISUAL '+JSON.stringify({name,mime:'image/jpeg',data:bytes.toString('base64')}));
      findings.push({name,viewport,state,synthetic:true,checks,errors,forbidden});
      await page.close();
    }
  }
  await writeFile(path.join(out,'growth-capture.json'),JSON.stringify({kind:'synthetic visual evidence only',findings},null,2));
  console.log('GTOP_GROWTH_CAPTURE_PASS '+JSON.stringify({screens:findings.length,findings}));
}finally{await browser.close();}
