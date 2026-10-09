import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const require=createRequire(path.resolve('package.json'));
const {chromium}=require('@playwright/test');
const root=path.resolve('../design-upgrade'),run=process.env.GITHUB_RUN_ID||'local';
const out=path.join(root,'evidence/baseline/2026-10-09',run);mkdirSync(out,{recursive:true});
const browser=await chromium.launch(),records=[];
try{
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:width===390?844:1000},deviceScaleFactor:1,isMobile:width===390,hasTouch:width===390,reducedMotion:'reduce'});
  const page=await context.newPage();await page.goto('https://gtop-app.web.app/',{waitUntil:'domcontentloaded',timeout:45000});await page.getByRole('heading',{name:/A little practice/}).waitFor({timeout:30000});await page.evaluate(()=>document.fonts.ready);
  const release=await(await page.request.get('https://gtop-app.web.app/version.json')).json();
  for(let y=0;y<await page.evaluate(()=>document.documentElement.scrollHeight);y+=650){await page.evaluate(y=>scrollTo(0,y),y);await page.waitForTimeout(120);}await page.evaluate(()=>scrollTo(0,0));
  const rel=`screens/2026-10-09-baseline/${run}/live-landing/${width===390?'mobile':'desktop'}.png`,file=path.join(root,rel);mkdirSync(path.dirname(file),{recursive:true});
  const bytes=await page.screenshot({path:file,fullPage:true,animations:'disabled'});
  records.push({id:'live-landing-'+width,url:page.url(),environment:'live-public',synthetic:false,release,capturedAt:new Date().toISOString(),viewport:page.viewportSize(),image:{path:rel,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)},inspection:'pending'});
  console.log('Live public release',JSON.stringify(release));await context.close();
 }
}finally{await browser.close();writeFileSync(path.join(out,'live-public.json'),JSON.stringify(records,null,2));}
