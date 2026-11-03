import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';

// Reuse the existing core app's pinned browser-test dependency; no new package.
const {chromium}=createRequire(new URL('../../gtop-app/package.json',import.meta.url))('@playwright/test');
const base=new URL(process.env.GTOP_PAPERS_BASE_URL||'http://127.0.0.1:4317');
assert(['127.0.0.1','localhost','[::1]'].includes(base.hostname),'Fixture smoke must use a localhost development server.');
const output=process.env.GTOP_PAPERS_RENDER_DIR||(process.env.RUNNER_TEMP?path.join(process.env.RUNNER_TEMP,'gtop-paper-fixtures'):process.platform==='win32'?'F:/Workspace/Codex/2026-11-03/gtop-firestore/outputs/ui-fixtures':null);
assert(output,'Set GTOP_PAPERS_RENDER_DIR to an artifact directory.');
if(process.platform==='win32'&&!process.env.CI)assert(/^F:[\\/]/i.test(path.resolve(output)),'Local artifacts must stay on F:.');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const checks=[];
try{
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
    for(const fixture of ['service-idle','working']){
      const page=await browser.newPage({viewport,deviceScaleFactor:1});
      const errors=[],forbidden=[];
      page.on('pageerror',error=>errors.push(error.message));
      page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
      // These renders are synthetic. Fail closed if a fixture starts real API,
      // Auth, model or external requests; no submission action is exercised.
      await page.route('**/*',route=>{
        const url=new URL(route.request().url());
        const publicFont=route.request().method()==='GET'&&((url.hostname==='fonts.googleapis.com'&&route.request().resourceType()==='stylesheet')||(url.hostname==='fonts.gstatic.com'&&route.request().resourceType()==='font'));
        if(!publicFont&&(url.origin!==base.origin||/^\/(?:api(?:\/|$)|assistant-config\.json$|session(?:\/|$)|service(?:\/|$)|conversations(?:\/|$))/.test(url.pathname))){
          forbidden.push(url.origin+url.pathname);return route.abort();
        }
        return route.continue();
      });
      await page.goto(new URL('/?fixture='+fixture,base).href,{waitUntil:'networkidle'});
      await page.locator('.chat-panel').waitFor({state:'visible'});
      await page.evaluate(()=>document.fonts.ready);
      assert.match(await page.locator('.preview-banner').innerText(),/synthetic data/);
      assert.match(await page.locator('.preview-banner').innerText(),new RegExp(fixture));
      assert.match(await page.locator('.availability').innerText(),/Assistant available/);
      const composer=page.locator('#message-input');assert(await composer.isVisible());assert(await composer.isEnabled());
      const send=page.getByRole('button',{name:'Send message',exact:true});assert(await send.isVisible());assert(await send.isDisabled());
      await composer.fill('Synthetic visual QA draft - never submitted');assert(await send.isEnabled());
      if(fixture==='working'){
        await page.locator('.job-status').waitFor({state:'visible'});
        assert.match(await page.locator('.job-status h2').innerText(),/Reviewing questions and answers/);
        assert.match(await page.locator('.job-status').innerText(),/You can keep talking while I work/);
        assert(await page.getByRole('button',{name:'Cancel request',exact:true}).isVisible());
      }else assert.equal(await page.locator('.job-status').count(),0);
      const geometry=await page.evaluate(()=>{
        const measure=selector=>{const element=document.querySelector(selector),rect=element.getBoundingClientRect(),style=getComputedStyle(element);return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,fontSize:parseFloat(style.fontSize),scrollWidth:element.scrollWidth,clientWidth:element.clientWidth};};
        return {viewportWidth:innerWidth,viewportHeight:innerHeight,documentWidth:document.documentElement.scrollWidth,composer:measure('#message-input'),send:measure('.send-button'),availability:measure('.availability'),progress:document.querySelector('.job-status')?measure('.job-status'):null};
      });
      assert(geometry.documentWidth<=viewport.width+1,'Horizontal document overflow');
      assert(geometry.composer.fontSize>=(viewport.width<500?16:14),'Composer text is too small');
      assert(geometry.composer.width>=200&&geometry.composer.height>=40,'Composer is cramped');
      assert(geometry.composer.y>=0&&geometry.composer.y+geometry.composer.height<=viewport.height+1,'Composer is outside viewport');
      assert(geometry.send.width>=44&&geometry.send.height>=44,'Send button touch target below44px');
      assert(geometry.availability.scrollWidth<=geometry.availability.clientWidth+1,'Availability label is clipped');
      if(geometry.progress)assert(geometry.progress.width>=250&&geometry.progress.x>=0&&geometry.progress.x+geometry.progress.width<=viewport.width+1,'Progress card clips horizontally');
      assert.deepEqual(forbidden,[],'Fixture attempted non-shell network access');assert.deepEqual(errors,[],'Bootstrap or browser console error');
      const name=`synthetic-${fixture}-${viewport.width}x${viewport.height}.png`;
      await page.screenshot({path:path.join(output,name),fullPage:true,animations:'disabled'});
      checks.push({fixture,synthetic:true,viewport,screenshot:name,geometry,errors,forbidden});
      await page.close();
    }
  }
  await writeFile(path.join(output,'fixture-smoke.json'),JSON.stringify({acceptance:'synthetic fixture render and DOM checks only; not signed-in/device/teacher acceptance',checks},null,2)+'\n');
  console.log(JSON.stringify({pass:true,checks:checks.length,output,synthetic:true}));
}finally{await browser.close();}
