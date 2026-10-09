import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(path.resolve('package.json'));
const {chromium}=require('playwright');
const run=process.env.GITHUB_RUN_ID||'local';
const root=path.resolve(process.env.REFERENCE_OUTPUT||`design-upgrade/references/evidence/2026-10-09/run-${run}`);
await fs.mkdir(root,{recursive:true});
const sites=[
 ['lando','https://landonorris.com/'], ['des','https://des.obys.agency/'],
 ['twks','https://twks.ch/en'], ['igloo','https://www.igloo.inc/'],
 ['linear','https://linear.app/'], ['bicycle','https://ciechanow.ski/bicycle/'],
 ['trust','https://ncase.me/trust/'], ['primer','https://primer.style/product/components/data-table/'],
 ['brilliant','https://brilliant.org/']
];
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
const results=[];
async function capture([id,url],width){
 const viewport={width,height:width===390?844:1000};
 const dir=path.join(root,id,String(width));await fs.mkdir(dir,{recursive:true});
 const ctx=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:width===390,hasTouch:width===390,reducedMotion:'no-preference',recordVideo:{dir,size:width===390?viewport:{width:960,height:667}}});
 const page=await ctx.newPage();page.setDefaultTimeout(12000);const start=Date.now();
 const record={id,url,viewport,run,capturedAt:new Date().toISOString(),browserVersion:browser.version(),sourceCommit:process.env.GITHUB_SHA,mode:'normal',actions:[],files:[],errors:[]};
 const log=(action,extra={})=>record.actions.push({elapsedMs:Date.now()-start,action,...extra});
 page.on('pageerror',e=>{if(record.errors.length<8)record.errors.push(e.message.slice(0,400));});
 const shot=async name=>{const p=path.join(dir,name+'.png');await page.screenshot({path:p,timeout:15000});const bytes=await fs.readFile(p);record.files.push({path:path.relative(root,p),sha256:crypto.createHash('sha256').update(bytes).digest('hex'),width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)});log('screenshot',{name,scrollY:await page.evaluate(()=>window.scrollY)});};
 try{
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:35000});log('navigation',{status:response?.status()});
  await page.waitForTimeout(8000); await shot('01-entry');
  record.finalUrl=page.url();record.title=await page.title();
  const body=await page.locator('body').innerText();
  record.visibleTextExcerpt=body.slice(0,1600);
  if(/verify you are human|checking your browser|automated traffic|access denied/i.test(body.slice(0,2000))){record.block='Possible site security challenge: no retries or bypass';return;}
  // Capture controls for the next, site-specific interaction review. No account creation or submissions.
  record.controls=await page.locator('button,a,input,[role="button"],[role="slider"]').evaluateAll(es=>es.filter(e=>e.getBoundingClientRect().width&&e.getBoundingClientRect().height).slice(0,90).map(e=>({tag:e.tagName,role:e.getAttribute('role'),name:(e.getAttribute('aria-label')||e.textContent||'').trim().slice(0,90),href:e.getAttribute('href'),type:e.getAttribute('type')})));
  await page.waitForTimeout(4000);await shot('02-settled');
  for(let n=1;n<=3;n++){
   log('slow-scroll-start',{deltaY:viewport.height*.8});
   for(let i=0;i<8;i++){await page.mouse.wheel(0,viewport.height*.1);await page.waitForTimeout(100);}
   await page.waitForTimeout(1100);await shot(`0${n+2}-scroll`);
  }
  log('fast-scroll',{deltaY:viewport.height*3});await page.mouse.wheel(0,viewport.height*3);await page.waitForTimeout(1800);await shot('06-fast-scroll');
  log('reverse-scroll',{deltaY:-viewport.height*1.5});await page.mouse.wheel(0,-viewport.height*1.5);await page.waitForTimeout(1600);await shot('07-reverse');
  log('return-top');await page.keyboard.press('Home');await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(1800);await shot('08-return');
  record.document=await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,viewportWidth:innerWidth}));
  // A separate preference check; no claim of full accessibility conformance.
  await page.emulateMedia({reducedMotion:'reduce'});log('reduced-motion-enabled');
  await page.reload({waitUntil:'domcontentloaded',timeout:30000});await page.waitForTimeout(5000);await shot('09-reduced-motion-entry');
  record.reducedMotionMedia=await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 }catch(e){record.failure=String(e).slice(0,700);try{await shot('diagnostic');}catch{}}
 finally{
  log('end');const video=page.video();await ctx.close();
  if(video){const old=await video.path();const target=path.join(dir,'sequence.webm');await fs.rename(old,target);const b=await fs.readFile(target);record.files.push({path:path.relative(root,target),sha256:crypto.createHash('sha256').update(b).digest('hex'),bytes:b.length,kind:'video'});}
  await fs.writeFile(path.join(dir,'record.json'),JSON.stringify(record,null,2)+'\n');results.push(record);await fs.writeFile(path.join(root,'manifest.json'),JSON.stringify({run,records:results},null,2)+'\n');console.log(JSON.stringify({id,width,failure:record.failure||record.block||null,files:record.files.length}));
 }
}
try{for(const s of sites.filter(s=>!process.env.REFERENCE_SITE||s[0]===process.env.REFERENCE_SITE)){await capture(s,1440);await capture(s,390);}}
finally{await browser.close();await fs.writeFile(path.join(root,'manifest.json'),JSON.stringify({run,capturedAt:new Date().toISOString(),sourceCommit:process.env.GITHUB_SHA,limitations:['Mobile Chromium emulation, not physical devices','Sites captured on isolated CI runners; no performance benchmark','Recorded video is scaled on desktop; PNGs are native viewport resolution','Generic scroll study; control-specific interaction is a separate pass'],records:results},null,2)+'\n');}
