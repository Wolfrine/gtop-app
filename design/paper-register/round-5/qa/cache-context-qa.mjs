import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {writeLocalDocuments} from './fixtures.mjs';
const require=createRequire(import.meta.url),{chromium,expect}=require('@playwright/test');
const manifest=JSON.parse(readFileSync(new URL('./manifest.json',import.meta.url),'utf8'));
const round=Number(process.argv.find(a=>a.startsWith('--round='))?.split('=')[1]||3),width=Number(process.argv.find(a=>a.startsWith('--width='))?.split('=')[1]||390);
const output=new URL(`./evidence/cache-context-round-${round}-${width}/`,import.meta.url);mkdirSync(output,{recursive:true});
const result={round,width,startedAt:new Date().toISOString(),checks:[],uncaught:[]};
const browser=await chromium.launch({headless:true,executablePath:'/workspace/scratch/38a7c77824b3/browser-runtime/extracted/chromium',args:['--disable-gpu','--no-zygote','--no-sandbox']});
const context=await browser.newContext({viewport:{width,height:900},isMobile:width<500,hasTouch:width<500}),page=await context.newPage();page.on('pageerror',error=>result.uncaught.push(error.message));
const auth=account=>`emulator=1&persistentCache=1&testEmail=${encodeURIComponent(account.email)}&testPassword=${encodeURIComponent(account.password)}`;
const open=(path,account=manifest)=>page.goto('http://127.0.0.1:4300'+path+'?'+auth(account));
async function navigate(path){await page.evaluate(path=>window.ng.getComponent(document.querySelector('app-paper-chat-page')).router.navigateByUrl(path+'?emulator=1&persistentCache=1'),path);}
async function check(name,run){try{await run();result.checks.push({name,passed:true});console.log('PASS '+name);}catch(error){result.checks.push({name,passed:false,error:String(error)});console.error('FAIL '+name+': '+error.message);await page.screenshot({path:new URL(`failure-${result.checks.length}.png`,output).pathname});}finally{await context.setOffline(false);await page.unroute('**/paperGateway/register**');}}
async function countBrief(brief){const response=await fetch('http://127.0.0.1:8080/v1/projects/gtop-app/databases/(default)/documents:runQuery',{method:'POST',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({structuredQuery:{from:[{collectionId:'paperRequests'}],where:{fieldFilter:{field:{fieldPath:'brief'},op:'EQUAL',value:{stringValue:brief}}}}})});if(!response.ok)throw Error('Local query failed '+response.status);return(await response.json()).filter(x=>x.document).length;}
async function newAdmin(){const email=`qa-boundary-${Date.now()}-${width}@gtop.test`,password='Independent-identity-2026';const response=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});if(!response.ok)throw Error('Local signup failed');const data=await response.json();const account={uid:data.localId,email,password,idToken:data.idToken};await writeLocalDocuments([{path:'users/'+account.uid,data:{uid:account.uid,email,role:'admin',displayName:'Local boundary QA',board:'ICSE',standard:'9'}}]);return account;}
try{
  await check('persistent Firestore cache supports offline revisit and unacknowledged draft reconnects once',async()=>{
    await open('/admin/question-papers');await expect.poll(()=>page.locator('.pr-record').count()).toBeGreaterThan(0);await expect.poll(()=>page.evaluate(()=>window.ng.getComponent(document.querySelector('app-paper-chat-page')).loading())).toBe(false);
    const databases=await page.evaluate(()=>indexedDB.databases());expect(databases.some(d=>d.name?.includes('firestore'))).toBe(true);result.indexedDbNames=databases.map(d=>d.name);
    const brief=`OFFLINE-RECONNECT-${manifest.prefix}-${width}-${Date.now()}: ICSE9 Biology Cells,2 marks.`;await navigate('/admin/question-papers/new');await page.getByLabel('Paper requirement',{exact:true}).fill(brief);await page.reload();await expect(page.getByLabel('Paper requirement',{exact:true})).toHaveValue(brief);
    await context.setOffline(true);await navigate('/admin/question-papers');await expect.poll(()=>page.locator('.pr-record').count()).toBeGreaterThan(0);await expect(page.getByText(/You’re offline/)).toBeVisible();
    await navigate('/admin/question-papers/new');await expect(page.getByLabel('Paper requirement',{exact:true})).toHaveValue(brief);await page.getByRole('button',{name:'Submit request',exact:true}).click();await expect(page.getByLabel('Paper requirement',{exact:true})).toHaveValue(brief);
    const operationId=await page.evaluate(()=>window.ng.getComponent(document.querySelector('app-paper-chat-page')).operation?.id);expect(operationId).toBeTruthy();expect(await countBrief(brief)).toBe(0);
    await context.setOffline(false);await expect.poll(()=>page.evaluate(()=>window.ng.getComponent(document.querySelector('app-paper-chat-page')).sending()),{timeout:20000}).toBe(false);
    if(page.url().includes('/question-papers/new'))await page.getByRole('button',{name:'Submit request',exact:true}).click();
    await expect(page).toHaveURL(new RegExp('/chat/'+operationId+'(?:\\?|$)'),{timeout:20000});await expect.poll(()=>countBrief(brief)).toBe(1);result.offlineOperationId=operationId;
  });
  await check('gateway permission denial evicts cached visible rows and ends loading truthfully',async()=>{
    await open('/admin/question-papers');await expect.poll(()=>page.locator('.pr-record').count()).toBeGreaterThan(0);await expect.poll(()=>page.evaluate(()=>window.ng.getComponent(document.querySelector('app-paper-chat-page')).loading())).toBe(false);
    expect(await page.evaluate(uid=>!!sessionStorage.getItem('gtop-paper-position:'+uid),manifest.uid)).toBe(true);
    await page.route('**/paperGateway/register**',route=>route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({error:'QA admin access withdrawn.'})}));
    await page.evaluate(()=>window.ng.getComponent(document.querySelector('app-paper-chat-page')).loadRegister());await expect(page.getByText('QA admin access withdrawn.',{exact:true})).toBeVisible();await expect(page.locator('.pr-record')).toHaveCount(0);
    expect(await page.evaluate(uid=>Object.keys(localStorage).filter(k=>k.startsWith('gtop-paper-register:'+uid+':')).length,manifest.uid)).toBe(0);
    expect(await page.evaluate(uid=>sessionStorage.getItem('gtop-paper-position:'+uid),manifest.uid)).toBeNull();
    expect(await page.evaluate(()=>window.ng.getComponent(document.querySelector('app-paper-chat-page')).loading())).toBe(false);
  });
  await check('sign-out,account switch and role loss do not retain another authorized session',async()=>{
    const second=await newAdmin();await open('/admin/question-papers');await expect.poll(()=>page.locator('.pr-record').count()).toBeGreaterThan(0);
    await expect.poll(()=>page.evaluate(()=>window.ng.getComponent(document.querySelector('app-paper-chat-page')).loading())).toBe(false);
    expect(await page.evaluate(uid=>!!sessionStorage.getItem('gtop-paper-position:'+uid),manifest.uid)).toBe(true);
    await navigate('/admin/question-papers/new');await page.getByLabel('Paper requirement',{exact:true}).fill('PRIVATE-UNSENT-'+manifest.uid);
    await page.evaluate(()=>window.ng.getComponent(document.querySelector('app-paper-chat-page')).profile.signOut());await expect(page.locator('app-paper-chat-page')).toHaveCount(0);
    expect(await page.evaluate(uid=>Object.keys(localStorage).filter(k=>k.startsWith('gtop-paper-register:'+uid+':')).length,manifest.uid)).toBe(0);
    expect(await page.evaluate(uid=>sessionStorage.getItem('gtop-paper-position:'+uid),manifest.uid)).toBeNull();
    await open('/admin/question-papers/new',second);await expect(page.getByLabel('Paper requirement',{exact:true})).toHaveValue('');
    await navigate('/admin/question-papers');await expect.poll(()=>page.evaluate(()=>window.ng.getComponent(document.querySelector('app-paper-chat-page')).loading())).toBe(false);
    await page.evaluate(async()=>{const c=window.ng.getComponent(document.querySelector('app-paper-chat-page'));c.mine=true;await c.loadRegister();});await expect(page.locator('.pr-record')).toHaveCount(0);
    await page.evaluate(async()=>{const c=window.ng.getComponent(document.querySelector('app-paper-chat-page'));c.mine=false;await c.loadRegister();});await expect.poll(()=>page.locator('.pr-record').count()).toBeGreaterThan(0);
    expect(await page.evaluate(uid=>!!sessionStorage.getItem('gtop-paper-position:'+uid),second.uid)).toBe(true);
    await writeLocalDocuments([{path:'users/'+second.uid,data:{uid:second.uid,email:second.email,role:'user',displayName:'Local boundary QA',board:'ICSE',standard:'9'}}]);await expect(page.locator('.pr-record')).toHaveCount(0,{timeout:10000});
    expect(await page.evaluate(uid=>Object.keys(localStorage).filter(k=>k.startsWith('gtop-paper-register:'+uid+':')).length,second.uid)).toBe(0);
    expect(await page.evaluate(uid=>sessionStorage.getItem('gtop-paper-position:'+uid),second.uid)).toBeNull();
    const denied=await fetch('http://127.0.0.1:5001/gtop-app/us-central1/paperGateway/register?limit=1',{headers:{Authorization:'Bearer '+second.idToken}});expect(denied.status).toBe(403);result.roleDeniedStatus=denied.status;
  });
}finally{result.finishedAt=new Date().toISOString();writeFileSync(new URL('result.json',output),JSON.stringify(result,null,2));await browser.close();}
if(result.checks.some(check=>!check.passed)||result.uncaught.length)process.exitCode=1;
