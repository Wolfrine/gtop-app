import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium,expect}=require('@playwright/test');
const manifest=JSON.parse(readFileSync(new URL('./manifest.json',import.meta.url),'utf8'));
const round=Number(process.argv.find(arg=>arg.startsWith('--round='))?.split('=')[1]||5);
const base=process.argv.find(arg=>arg.startsWith('--base='))?.slice('--base='.length)||'http://127.0.0.1:4400';
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))throw Error('Production QA is local only.');
const width=Number(process.argv.find(arg=>arg.startsWith('--width='))?.split('=')[1]||1280);
const suffix=process.argv.find(arg=>arg.startsWith('--suffix='))?.slice('--suffix='.length)||'';
const only=process.argv.find(arg=>arg.startsWith('--only='))?.slice('--only='.length).split(',')||[];
const output=new URL(`./evidence/production-round-${round}-${width}${suffix?'-'+suffix:''}/`,import.meta.url);mkdirSync(output,{recursive:true});
const result={round,width,startedAt:new Date().toISOString(),checks:[],uncaught:[],gateway:[]};
const browser=await chromium.launch({headless:true,executablePath:'/workspace/scratch/38a7c77824b3/browser-runtime/extracted/chromium',args:['--disable-gpu','--no-zygote','--no-sandbox']});
const context=await browser.newContext({viewport:{width,height:900},isMobile:width<500,hasTouch:width<500});
const page=await context.newPage();page.on('pageerror',error=>result.uncaught.push(error.message));
page.on('response',async response=>{if(response.url().includes('/paperGateway/register')){try{const body=await response.json();result.gateway.push({status:response.status(),query:new URL(response.url()).search,scanned:body.scanned,items:body.items?.length,nextCursor:!!body.nextCursor,indexReady:body.indexReady});}catch{}}});
const auth=`emulator=1&persistentCache=1&testEmail=${encodeURIComponent(manifest.email)}&testPassword=${encodeURIComponent(manifest.password)}`;
const open=path=>page.goto(base+path+(path.includes('?')?'&':'?')+auth);
const check=async(name,run)=>{if(only.length&&!only.some(value=>name.includes(value)))return;try{await run();result.checks.push({name,passed:true});console.log('PASS '+name);}catch(error){result.checks.push({name,passed:false,error:String(error)});console.log('FAIL '+name+': '+error.message);await page.screenshot({path:new URL(`failure-${result.checks.length}.png`,output).pathname,fullPage:true});}};
const fits=()=>expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
const search=async text=>{await page.getByLabel('Search all papers',{exact:true}).fill(text);await page.getByRole('button',{name:'Search',exact:true}).click();await expect.poll(()=>page.locator('.pr-record').count()).toBeGreaterThan(0);};


try{
  await check('old title beyond initial caps is discoverable in global register',async()=>{
    await open('/admin/question-papers');await expect(page.getByRole('heading',{name:'Papers',exact:true})).toBeVisible({timeout:30000});
    await search('buried paleontology');await expect(page.locator('.pr-record').filter({hasText:manifest.prefix+' buried paleontology target'})).toBeVisible();await fits();
  });
  await check('historical submitted requirement is globally searchable',async()=>{
    await search('REQUIRED-BRIEF-'+manifest.prefix);await expect(page.locator('.pr-record').filter({hasText:'buried paleontology target'})).toBeVisible();
  });
  await check('timestamp-less legacy completed paper stays ready and openable',async()=>{
    if(only.length)await open('/admin/question-papers');
    await page.getByRole('button',{name:'Ready',exact:true}).click();await search('DATELESS-ARCHIVE-TARGET');
    const row=page.locator('.pr-record').filter({hasText:'DATELESS-ARCHIVE-TARGET'});await expect(row).toBeVisible();await row.locator('a').first().click();
    await expect(page.frameLocator('.pcv-sheet iframe').getByText('Explain membrane folding.',{exact:false})).toBeVisible({timeout:20000});await fits();
  });
  await check('old chat link reveals submitted requirements after reload',async()=>{
    await open('/admin/question-papers/chat/'+manifest.oldConversation);await expect(page.getByRole('heading',{name:manifest.prefix+' buried paleontology target',level:1,exact:true})).toBeVisible({timeout:20000});
    await page.locator('.pr-request-details summary').click();await expect(page.getByText(`ICSE Class 9 Biology. Cells, 2 marks, short answer. Fixture ${manifest.prefix}. REQUIRED-BRIEF-${manifest.prefix} full original scope.`,{exact:true})).toBeVisible();
    await page.reload();await expect(page.getByRole('heading',{name:manifest.prefix+' buried paleontology target',level:1,exact:true})).toBeVisible();await fits();
  });
  await check('new natural-language request saves once and keeps full brief accessible',async()=>{
    await open('/admin/question-papers/new');await expect(page.getByRole('heading',{name:'New paper',exact:true})).toBeVisible();
    const text=`QA round ${round} width ${width}: ICSE Class 9 Biology, Cells, 2 marks,10 minutes, short answer. UNIQUE-${Date.now()}`;
    await page.getByLabel('Paper requirement',{exact:true}).fill(text);await page.getByRole('button',{name:'Submit request',exact:true}).click();
    await expect(page).toHaveURL(/\/admin\/question-papers\/chat\//);await page.locator('.pr-request-details summary').click();await expect(page.getByText(text,{exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Cancel request',exact:true})).toBeVisible();await fits();
    result.createdConversation=new URL(page.url()).pathname.split('/').at(-1);
  });
  await check('clarification preserves completed versions and separates student/key output',async()=>{
    await open('/admin/question-papers/chat/'+manifest.revisions);await expect(page.getByRole('heading',{name:`CLARIFY-${manifest.prefix}: Include diagrams or text only?`,exact:true})).toBeVisible({timeout:20000});
    await expect(page.getByRole('link',{name:'Open paper',exact:true})).toHaveCount(2);await expect(page.getByRole('link',{name:'Open key',exact:true})).toHaveCount(2);
    const version=page.getByRole('region',{name:'Completed version 1',exact:true});
    await version.getByRole('link',{name:'Open paper',exact:true}).click();
    await expect(page.frameLocator('.pcv-sheet iframe').getByText('Explain membrane folding 1.',{exact:true})).toBeVisible();await expect(page.frameLocator('.pcv-sheet iframe').getByText(`PRIVATE-KEY-${manifest.prefix}-1`,{exact:false})).toHaveCount(0);
    await page.getByRole('button',{name:'Answer key',exact:true}).click();await expect(page.frameLocator('.pcv-sheet iframe').getByText(`PRIVATE-KEY-${manifest.prefix}-1`,{exact:false})).toBeVisible();await fits();
    await page.frameLocator('.pcv-sheet iframe').locator('body').evaluate(()=>{window.print=()=>{window.__qaPrintCalled=true;};});
    await page.getByRole('button',{name:'Print answer key / Save PDF',exact:true}).click();expect(await page.frameLocator('.pcv-sheet iframe').locator('body').evaluate(()=>window.__qaPrintCalled===true)).toBe(true);result.printInvoked=true;
  });
  if(round>=2){
    await check('long activity retrieves original message beyond150 and request beyond100',async()=>{
      await open('/admin/question-papers/chat/'+manifest.long);await page.getByRole('button',{name:/Activity and earlier requests/}).click();
      await expect(page.getByText(`ORIGINAL-HISTORY-${manifest.prefix}: ICSE Biology 80 marks, diagrams required.`,{exact:true})).toHaveCount(0);
      await page.getByRole('button',{name:'Load earlier activity',exact:true}).click();await expect(page.getByText(`ORIGINAL-HISTORY-${manifest.prefix}: ICSE Biology 80 marks, diagrams required.`,{exact:true})).toBeVisible();await fits();
      await expect(page.locator('.pr-history-boundary')).toContainText('161 activity entries · 150 saved requests loaded.');
      await page.getByRole('button',{name:'Load earlier activity',exact:true}).click();await expect(page.getByRole('button',{name:'Load earlier activity',exact:true})).toHaveCount(0);
      await expect(page.locator('.pr-history-boundary')).toContainText('161 activity entries · 161 saved requests loaded.');
      await expect(page.locator('.pr-history-boundary')).toContainText('Beginning of saved activity reached.');result.historyCounts={messages:161,requests:161};
    });
    await check('unsent new requirement persists through online reload',async()=>{
      await open('/admin/question-papers/new');const text='UNSENT-'+manifest.prefix+'-'+width;
      await page.getByLabel('Paper requirement',{exact:true}).fill(text);await page.reload();await expect(page.getByLabel('Paper requirement',{exact:true})).toHaveValue(text);
      await page.getByLabel('Paper requirement',{exact:true}).fill('');
    });
  }
  await check('actual production scripts disable Angular debug access and have recorded hashes',async()=>{
  expect(await page.evaluate(()=>typeof window.ng?.getComponent)).toBe('undefined');
  const scripts=await page.locator('script[src]').evaluateAll(nodes=>nodes.map(node=>node.src));result.productionScripts=[];for(const url of scripts.filter(url=>url.startsWith(base))){const response=await fetch(url);const bytes=Buffer.from(await response.arrayBuffer());result.productionScripts.push({path:new URL(url).pathname,sha256:createHash('sha256').update(bytes).digest('hex')});}
  expect(result.productionScripts.some(item=>/main-.*\.js$/.test(item.path))).toBe(true);
  });
  await page.screenshot({path:new URL('final-viewport.png',output).pathname});
}finally{
  result.finishedAt=new Date().toISOString();writeFileSync(new URL('result.json',output),JSON.stringify(result,null,2));await browser.close();
}
if(result.checks.some(check=>!check.passed)||result.uncaught.length)process.exitCode=1;
