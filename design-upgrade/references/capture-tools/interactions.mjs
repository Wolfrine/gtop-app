import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const {chromium}=createRequire(path.resolve('package.json'))('playwright');
const id=process.env.REFERENCE_SITE,run=process.env.GITHUB_RUN_ID,root=process.env.REFERENCE_OUTPUT;
const url={des:'https://des.obys.agency/',bicycle:'https://ciechanow.ski/bicycle/',brilliant:'https://brilliant.org/'}[id];
const browser=await chromium.launch({args:['--enable-unsafe-swiftshader']});const records=[];
for(const width of id==='des'?[390]:[1440,390]){
 const viewport={width,height:width===390?844:1000},dir=path.join(root,id,String(width));await fs.mkdir(dir,{recursive:true});
 const ctx=await browser.newContext({viewport,isMobile:width===390,hasTouch:width===390,recordVideo:{dir,size:width===390?viewport:{width:960,height:667}}});
 const page=await ctx.newPage();page.setDefaultTimeout(10000);const start=Date.now();
 const r={id,url,run,viewport,capturedAt:new Date().toISOString(),sourceCommit:process.env.GITHUB_SHA,actions:[],files:[],errors:[]};
 const log=(action,data={})=>r.actions.push({elapsedMs:Date.now()-start,action,...data});
 const shot=async name=>{const p=path.join(dir,name+'.png');await page.screenshot({path:p,timeout:12000});const b=await fs.readFile(p);r.files.push({path:path.relative(root,p),sha256:crypto.createHash('sha256').update(b).digest('hex'),width:b.readUInt32BE(16),height:b.readUInt32BE(20)});log('screenshot',{name,scrollY:await page.evaluate(()=>scrollY)});};
 const snapshot=async name=>{r[name]=await page.locator('body').innerText();};
 try{
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:35000});await page.waitForTimeout(7000);r.finalUrl=page.url();await snapshot('initialText');
  if(/verify you are human|checking your browser|automated traffic|access denied/i.test(r.initialText.slice(0,2000)))throw new Error('Site security challenge; no retry');
  if(id==='des'){
   await shot('01-before-touch');const cdp=await ctx.newCDPSession(page);
   for(let n=1;n<=3;n++){
    log('touch-swipe',{from:[195,720],to:[195,200]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:195,y:720}]});
    for(let i=1;i<=14;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:195,y:720-520*i/14}]});await page.waitForTimeout(30);}
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(1700);await shot('0'+(n+1)+'-touch-scroll');
   }
   await snapshot('afterTouchText');
  }
  if(id==='brilliant'){
   const close=page.getByRole('button',{name:'Close',exact:true});if(await close.count()===1&&await close.isVisible()){await close.click();log('dismiss-cookie-banner');}
   await shot('01-clean-entry');const pause=page.getByRole('button',{name:'Pause',exact:true});await pause.click();log('pause-hero-demo');await page.waitForTimeout(1200);await shot('02-paused');await page.waitForTimeout(2000);await shot('03-still-paused');
   const play=page.getByRole('button',{name:'Play',exact:true});r.playButtons=await play.count();
   // First visible viewport Play control is the hero control just changed from Pause.
   const p=await play.all();for(const b of p){const box=await b.boundingBox();if(box&&box.y>=0&&box.y<viewport.height){await b.click();log('resume-hero-demo');break;}}
   await page.waitForTimeout(1800);await shot('04-resumed');
   const tabs=page.getByRole('tab');r.tabs=await tabs.allTextContents();const cs=tabs.filter({hasText:'Computer Science'});if(await cs.count()===1){await cs.click();log('select-computer-science-tab');await page.waitForTimeout(1600);await shot('05-computer-science');await snapshot('afterTabText');}
  }
  if(id==='bicycle'){
   // Inspect rendered custom controls before selecting a target. No application internals.
   r.sliderDOM=await page.locator('[class*="slider"]').evaluateAll(es=>es.slice(0,15).map(e=>({class:e.className,html:e.outerHTML.slice(0,1000)})));
   const knobs=page.locator('[class*="slider"]').filter({visible:true});r.sliderCount=await knobs.count();
   const candidates=await page.locator('[class*="slider"]').evaluateAll(es=>es.map(e=>({cls:e.className,rect:e.getBoundingClientRect().toJSON()})).filter(e=>e.rect.width>100&&e.rect.height>0&&e.rect.y<2000));
   r.sliderCandidates=candidates;const candidate=candidates.find(e=>e.rect.width<850&&e.rect.height<100);
   if(!candidate)throw new Error('No grounded slider track found');
   const loc=page.locator('[class]').filter({visible:true});
   // Use actual DOM bounds of the first article slider track, then native pointer drag.
   await page.mouse.wheel(0,Math.max(0,candidate.rect.y-viewport.height*.6));await page.waitForTimeout(1000);
   const current=await page.locator('[class*="slider"]').evaluateAll(es=>es.map(e=>({cls:e.className,rect:e.getBoundingClientRect().toJSON()})).filter(e=>e.rect.width>100&&e.rect.height>0&&e.rect.y>0&&e.rect.y<innerHeight));
   const t=current.find(e=>e.cls===candidate.cls&&e.rect.height<100);if(!t)throw new Error('Slider not in viewport');
   await shot('01-slider-neutral');const x=t.rect.x,y=t.rect.y+t.rect.height/2,w=t.rect.width;
   await page.mouse.move(x+w*.5,y);await page.mouse.down();await page.mouse.move(x+w*.88,y,{steps:18});await page.mouse.up();log('drag-slider-right',{bounds:t.rect});await page.waitForTimeout(1800);await shot('02-slider-right');
   await page.mouse.move(x+w*.88,y);await page.mouse.down();await page.mouse.move(x+w*.15,y,{steps:18});await page.mouse.up();log('drag-slider-left');await page.waitForTimeout(1800);await shot('03-slider-left');
  }
 }catch(e){r.failure=String(e).slice(0,800);try{await shot('diagnostic');}catch{}}
 finally{log('end');const v=page.video();await ctx.close();const p=path.join(dir,'sequence.webm');await fs.rename(await v.path(),p);const b=await fs.readFile(p);r.files.push({path:path.relative(root,p),sha256:crypto.createHash('sha256').update(b).digest('hex'),bytes:b.length,kind:'video'});await fs.writeFile(path.join(dir,'record.json'),JSON.stringify(r,null,2));records.push(r);await fs.writeFile(path.join(root,'manifest.json'),JSON.stringify({run,records},null,2));console.log(id,width,r.failure||'done');}
}
await browser.close();
