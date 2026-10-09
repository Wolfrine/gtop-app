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
   await page.waitForTimeout(1200);await shot('01-clean-entry');const pause=page.getByRole('button',{name:'Pause',exact:true});await pause.hover();await page.waitForTimeout(400);await pause.click();log('pause-hero-demo');await page.waitForTimeout(1200);await shot('02-paused');await page.waitForTimeout(2000);await shot('03-still-paused');
   const play=page.getByRole('button',{name:'Play',exact:true});r.playButtons=await play.count();
   // First visible viewport Play control is the hero control just changed from Pause.
   const p=await play.all();for(const b of p){const box=await b.boundingBox();if(box&&box.y>=0&&box.y<viewport.height){await b.click();log('resume-hero-demo');break;}}
   await page.waitForTimeout(1800);await shot('04-resumed');
   const tabs=page.getByRole('tab');r.tabs=await tabs.allTextContents();const cs=tabs.filter({hasText:'Computer Science'});if(await cs.count()===1){await cs.click();log('select-computer-science-tab');await page.waitForTimeout(1600);await shot('05-computer-science');await snapshot('afterTabText');}
  }
  if(id==='bicycle'){
   // Selectors grounded in the previous preserved DOM and visible rider control.
   const knob=page.locator('#hero_sl0 .slider_knob');await knob.scrollIntoViewIfNeeded();await page.waitForTimeout(1500);
   const track=page.locator('#hero_sl0 .slider_container');const t=await track.boundingBox();const k=await knob.boundingBox();if(!t||!k)throw new Error('Visible slider bounds unavailable');
   await shot('01-slider-neutral');
   const drag=async fraction=>{const current=await knob.boundingBox();await page.mouse.move(current.x+current.width/2,current.y+current.height/2);await page.mouse.down();await page.mouse.move(t.x+t.width*fraction,current.y+current.height/2,{steps:18});await page.mouse.up();};
   r.before=await knob.evaluate(e=>e.parentElement.getAttribute('style'));
   await drag(.88);log('drag-slider-right');await page.waitForTimeout(1800);r.afterRight=await knob.evaluate(e=>e.parentElement.getAttribute('style'));await shot('02-slider-right');
   await drag(.15);log('drag-slider-left');await page.waitForTimeout(1800);r.afterLeft=await knob.evaluate(e=>e.parentElement.getAttribute('style'));await shot('03-slider-left');

  }
 }catch(e){r.failure=String(e).slice(0,800);try{await shot('diagnostic');}catch{}}
 finally{log('end');const v=page.video();await ctx.close();const p=path.join(dir,'sequence.webm');await fs.rename(await v.path(),p);const b=await fs.readFile(p);r.files.push({path:path.relative(root,p),sha256:crypto.createHash('sha256').update(b).digest('hex'),bytes:b.length,kind:'video'});await fs.writeFile(path.join(dir,'record.json'),JSON.stringify(r,null,2));records.push(r);await fs.writeFile(path.join(root,'manifest.json'),JSON.stringify({run,records},null,2));console.log(id,width,r.failure||'done');}
}
await browser.close();
