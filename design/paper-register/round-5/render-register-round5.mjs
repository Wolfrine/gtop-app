import {createRequire} from 'node:module';
import fs from 'node:fs';
const round=Number(process.env.ROUND||1);
const root='/workspace/scratch/0a41fddf9e8a/gtop-question-journey';
const require=createRequire(root+'/gtop-app/package.json');const {chromium,expect}=require('@playwright/test');
const {writeLocalDocuments}=await import('/workspace/scratch/0a41fddf9e8a/question-journey-qa/fixtures.mjs');
const email='register-visual-v1@gtop.test',password='Paper-visual-2026';
let response=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});
if(!response.ok)response=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});
const {localId:uid}=await response.json();if(!uid)throw Error('Local fixture authentication failed');
fs.mkdirSync(root+'/design/paper-register/round-'+round,{recursive:true});
const emptyEmail='register-first-use@gtop.test';let firstUse=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:emptyEmail,password,returnSecureToken:true})});if(!firstUse.ok)firstUse=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:emptyEmail,password,returnSecureToken:true})});const emptyUid=(await firstUse.json()).localId;if(!emptyUid)throw Error('First-use fixture authentication failed');
const records=[{path:'users/'+emptyUid,data:{uid:emptyUid,email:emptyEmail,displayName:'New admin',role:'admin',board:'CBSE',standard:'10'}},{path:'users/'+uid,data:{uid,email,displayName:'Priya Kapoor',role:'admin',board:'CBSE',standard:'10'}}];
const at=i=>new Date(Date.UTC(2026,9,4,8,0-i));
const data=[['mathematics','Class 10 Mathematics','needs-info','CBSE','10','Mathematics','Quadratic equations',40,'Should this paper total 40 or 44 marks? Your pattern adds up to 44.'],['chemistry','Class 9 Chemistry','needs-info','ICSE','9','Chemistry','Atomic structure',30,'Should the paper cover atomic structure only, or also chemical bonding?'],['geography','Class 7 Geography','completed','ICSE','7','Geography','Water',25,''],['science','Class 10 Science','queued','CBSE','10','Science','Light',40,''],['history','Class 8 History','generating','CBSE','8','History','Colonial India',30,''],['biology','Class 9 Biology','error','ICSE','9','Biology','Cells',40,'']];
const html=(title,key)=>{
 const geography=title.includes('Geography'),topic=geography?'Water and its uses':'Light and reflection',marks=geography?25:40,count=marks/5;
 const prompts=geography?['Explain the water cycle with its main stages.','Describe two ways that communities can conserve water.','Explain how rainfall supports rivers and groundwater.','Describe how freshwater and ocean water differ.','Explain why clean drinking water matters.']:['State the laws of reflection and draw a labelled diagram.','Explain how an image forms in a plane mirror.','Describe reflection from a smooth and a rough surface.','Explain two uses of concave mirrors.','Describe the image formed by a convex mirror.','Explain why a pencil appears bent in water.','Compare reflection and refraction with examples.','Explain one practical use of a lens.'];
 return '<!doctype html><html><head><style>@page{size:A4;margin:18mm}body{font:15px/1.7 Georgia;color:#182822;padding:28px}h1{font-size:25px}header{border-bottom:1px solid #999;padding-bottom:12px}h2{font-size:18px}p{break-inside:avoid}</style></head><body><header><h1>'+title+(key?' — Answer key':'')+'</h1><p>'+topic+' · '+marks+' marks · 60 minutes</p><p>'+(key?'Teacher copy — keep separate from students':'Student copy — answer all questions')+'</p></header><h2>Section A · '+count+' × 5 marks</h2>'+prompts.map((text,i)=>'<p>'+(i+1)+'. '+text+' [5]</p>'+(key?'<p><strong>Marking guidance:</strong> Award 3 marks for accurate concepts and 2 marks for a clear explanation with a relevant example or diagram.</p>':'')).join('')+'</body></html>';
};
for(let i=0;i<data.length;i++){
 const [slug,title,status,board,standard,subject,chapter,marks,question]=data[i],id='visual-v1-'+slug,request=id+'-request',revision=slug==='science'?2:1;
 records.push({path:'paperConversations/'+id,data:{title,ownerUid:uid,status,activeRequestId:request,revision,createdAt:at(i+40),updatedAt:at(i)}});
 records.push({path:'paperRequests/'+request,data:{source:'admin-paper-chat',conversationId:id,brief:`${board} Class ${standard} ${subject}, ${chapter}. ${marks} marks, 60 minutes. Include short answers and application questions.`,requestedBy:uid,revision,status,createdAt:at(i+20),updatedAt:at(i),nextRunAtIso:'2026-10-04T10:30:00.000Z',...(status==='error'?{error:'The requested question pattern totals 46 marks, but the requirement asks for 40. Send a corrected pattern to try again.'}:{}),progress:{step:'Checking the existing question bank',reused:8,generated:0}}});
 records.push({path:'paperMessages/'+id+'-submitted',data:{conversationId:id,requestId:request,role:'admin',createdBy:uid,text:`${board} Class ${standard} ${subject}. ${chapter}, ${marks} marks.`,createdAt:at(i+20)}});
 if(question)records.push({path:'paperMessages/'+id+'-question',data:{conversationId:id,requestId:request,role:'agent',text:question,createdAt:at(i)}});
 if(['geography','science'].includes(slug))records.push({path:'paperDrafts/'+id+'-v1',data:{title,board,standard,subjects:[subject],chapters:[chapter],marks,actualMarks:marks,durationMinutes:60,createdBy:uid,status:'ready',conversationId:id,parentRequestId:request,requestRevision:1,createdAt:at(i+10),updatedAt:at(i+10),paperHtml:html(title,false),answerHtml:html(title,true)}});
}
// Additional real emulator records exercise academic retrieval and repeated titles.
for (const [suffix,year] of [['a',2022],['b',2024]]) {
 const id='visual-v3-electromagnetic-'+suffix, request=id+'-request', stamp=new Date(Date.UTC(year,5,12,5,0));
 const title='Class 12 Physics — Electromagnetic induction, alternating current and electromagnetic waves';
 records.push({path:'paperConversations/'+id,data:{title,ownerUid:uid,status:'queued',activeRequestId:request,revision:1,createdAt:stamp,updatedAt:stamp}});
 records.push({path:'paperRequests/'+request,data:{source:'admin-paper-chat',conversationId:id,brief:'CBSE Class 12 Physics. Electromagnetic induction, alternating current and electromagnetic waves. Include graph interpretation, transformer diagrams and application questions. 70 marks, 180 minutes.',requestedBy:uid,revision:1,status:'queued',createdAt:stamp,updatedAt:stamp,nextRunAtIso:'2026-10-04T10:30:00.000Z'}});
 records.push({path:'paperMessages/'+id+'-submitted',data:{conversationId:id,requestId:request,role:'admin',createdBy:uid,text:'CBSE Class 12 Physics. Electromagnetic induction, alternating current and electromagnetic waves. 70 marks, 180 minutes.',createdAt:stamp}});
}

// Historical families and long activity are real local source documents.
for(let i=1;i<=65;i++){
 const id='visual-v4-annual-'+String(i).padStart(3,'0'),request=id+'-request',stamp=new Date(Date.UTC(2025-Math.floor(i/6),i%12,8));
 const title=`Class 10 Science · Annual practice ${2025-Math.floor(i/6)} · Set ${String(i).padStart(2,'0')}`;
 records.push({path:'paperConversations/'+id,data:{title,ownerUid:uid,status:'cancelled',activeRequestId:request,revision:1,createdAt:stamp,updatedAt:stamp}},{path:'paperRequests/'+request,data:{source:'admin-paper-chat',conversationId:id,brief:'CBSE Class 10 Science annual practice. Light, electricity and life processes. 40 marks, 90 minutes.',requestedBy:uid,status:'cancelled',revision:1,createdAt:stamp,updatedAt:stamp}});
}
const historyId='visual-v4-history';
records.push({path:'paperConversations/'+historyId,data:{title:'Class 9 Biology · yearly classroom practice',ownerUid:uid,status:'cancelled',activeRequestId:historyId+'-160',revision:161,createdAt:new Date('2011-01-01'),updatedAt:new Date('2025-01-01')}});
for(let i=0;i<161;i++){
 const id=historyId+'-'+i,stamp=new Date(Date.UTC(2011,0,1+i*28)),actor=i%2?uid:'earlier-admin-sen';
 const brief=i===0?'Original 2011 requirement: Class 9 Biology, cells and tissues, 40 marks. Include short explanations and a labelled diagram.':`Practice request ${i+1}: Class 9 Biology. Focus on ${['cells and tissues','nutrition and digestion','respiration and transport'][i%3]}; 40 marks, 90 minutes.`;
 records.push({path:'paperRequests/'+id,data:{source:'admin-paper-chat',conversationId:historyId,brief,requestedBy:actor,status:'cancelled',revision:i+1,createdAt:stamp,updatedAt:stamp}},{path:'paperMessages/'+id,data:{conversationId:historyId,requestId:id,role:'admin',createdBy:actor,text:brief,createdAt:stamp}});
}
records.push({path:'paperNotifications/visual-v5-reply',data:{ownerUid:uid,conversationId:'visual-v1-mathematics',text:'Class 10 Mathematics needs your reply.',read:false,createdAt:new Date('2026-10-04T08:31:00Z')}});
records.push({path:'paperDrafts/visual-v5-legacy',data:{title:'Earlier Geography classroom paper',board:'ICSE',standard:'7',subjects:['Geography'],chapters:['Water'],marks:25,actualMarks:25,durationMinutes:60,createdBy:uid,status:'ready',createdAt:new Date('2017-01-01'),paperHtml:html('Class 7 Geography',false),answerHtml:html('Class 7 Geography',true)}});
records.push({path:'paperNotifications/visual-v4-ready',data:{ownerUid:uid,conversationId:'visual-v1-geography',paperId:'visual-v1-geography-v1',text:'Class 7 Geography is ready. Open the saved paper.',read:false,createdAt:new Date('2026-10-04T08:30:00Z')}});

if(process.env.GTOP_SKIP_SEED!=='1'){
await writeLocalDocuments(records);
fs.writeFileSync(root+'/design/paper-register/round-'+round+'/fixture.json',JSON.stringify({version:'register-visual-v5-final-identity-and-recovery',localOnly:true,email,uid,records},null,2));
const adminRequire=createRequire(root+'/gtop-app/functions/package.json');const {initializeApp}=adminRequire('firebase-admin/app');const {getFirestore}=adminRequire('firebase-admin/firestore');initializeApp({projectId:'gtop-app'});const db=getFirestore();const {projectSource}=await import(root+'/gtop-app/functions/paper-register.mjs');const sources=records.filter(row=>/^paper(Conversations|Requests|Drafts)\//.test(row.path));for(let i=0;i<sources.length;i+=5){await Promise.all(sources.slice(i,i+5).map(row=>{const [collection,id]=row.path.split('/');return projectSource(db,collection,id);}));}if(!(await db.doc('paperRegisterState/v1').get()).data()?.ready)throw Error('Complete historical verification is required before rendering.');await db.terminate();
}
const browser=await chromium.launch({executablePath:process.env.GTOP_CHROMIUM_PATH,args:['--no-sandbox','--disable-gpu']});
const results=[];
const output=root+'/design/paper-register/round-'+round;
const baseUrl=process.env.GTOP_RENDER_URL||'http://127.0.0.1:4300';
for(const width of [1440,390,320]){
 const context=await browser.newContext({viewport:{width,height:width<700?844:1000}});const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const auth='?emulator=1&testEmail='+encodeURIComponent(email)+'&testPassword='+encodeURIComponent(password);
 for(const [name,path] of [['register','/admin/question-papers'],['new','/admin/question-papers/new'],['clarification','/admin/question-papers/chat/visual-v1-mathematics'],['revision','/admin/question-papers/chat/visual-v1-science'],['failure','/admin/question-papers/chat/visual-v1-biology'],['completed','/admin/question-papers/chat/visual-v1-geography'],['expanded','/admin/question-papers/chat/visual-v1-mathematics'],['long-record','/admin/question-papers/chat/visual-v3-electromagnetic-a'],['search-results','/admin/question-papers'],['no-results','/admin/question-papers']]){

  if(page.url()!=='about:blank')await page.evaluate(()=>sessionStorage.clear());
  await page.goto(baseUrl+path+auth);await page.locator('.pr-page').waitFor();
  if(['register','search-results','no-results'].includes(name)){await page.getByLabel('Created by me').check();await page.locator('.pr-record').filter({hasText:'Class 10 Mathematics'}).waitFor();}
  else if(name!=='new')await page.locator('.pr-detail-heading').waitFor();
  if(name==='expanded'){
    await page.locator('.pr-request-details summary').click();
    await page.getByRole('button',{name:'Activity and earlier requests'}).click();
    await page.locator('.pr-history article').first().waitFor();
  }
  if(name==='search-results'||name==='no-results'){
    await page.getByLabel('Search all papers').fill(name==='search-results'?'electromagnetic':'unmatchedsyllabusxyz');
    const queryResponse=page.waitForResponse(r=>r.url().includes('paperGateway/register?')&&r.url().includes('q='));
    await page.getByRole('button',{name:'Search',exact:true}).click();
    await queryResponse;
    await page.waitForFunction(()=>!document.querySelector('.pr-search button')?.disabled);
    if(name==='search-results')await page.waitForFunction(()=>document.querySelectorAll('.pr-record').length===2&&[...document.querySelectorAll('.pr-record')].every(el=>el.textContent.includes('Electromagnetic induction')));
    else await page.getByRole('heading',{name:'No matching papers'}).waitFor();
  }
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:root+'/design/paper-register/round-'+round+'/'+name+'-'+width+'.png',fullPage:name!=='register'});
  results.push({width,name,viewportHeight:width<700?844:1000,identity:await page.locator('.pr-main').innerText(),overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),errors:[...errors]});
 }

 {
  const settled=async()=>{await expect(page.getByRole('button',{name:'Search',exact:true})).toBeEnabled({timeout:30000});await page.waitForFunction(()=>!document.querySelector('.pr-list-footer button')?.disabled);};
  const visit=async path=>{await page.evaluate(()=>sessionStorage.clear());await page.goto(baseUrl+path+auth);await page.locator('.pr-page,.pcv-page').waitFor();};
  const capture=async(name,fullPage=false)=>{await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:output+'/'+name+'-'+width+'.png',fullPage});results.push({width,name,viewportHeight:width<700?844:1000,identity:await page.locator('main,.pcv-page').first().innerText(),overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),errors:[...errors]});};
  await visit('/admin/question-papers');await settled();await page.getByLabel('Created by me').check();await settled();await page.getByLabel('Search all papers').fill('annual');await page.getByRole('button',{name:'Search',exact:true}).click();await settled();await expect(page.locator('.pr-record')).toHaveCount(30);
  const loadPage=async()=>{const response=page.waitForResponse(r=>r.url().includes('paperGateway/register?')&&r.url().includes('cursor='));await page.locator('.pr-list-footer button').click();const body=await(await response).json();await page.waitForFunction(cursor=>{const button=document.querySelector('.pr-list-footer button');return cursor?!!button&&!button.disabled:!button;},body.nextCursor);};
  await loadPage();await expect.poll(()=>page.locator('.pr-record').count()).toBeGreaterThan(30);await page.locator('.pr-list-footer').scrollIntoViewIfNeeded();await capture('multiple-pages');
  for(let more=0;more<5&&await page.locator('.pr-list-footer button').count();more++)await loadPage();await expect(page.locator('.pr-record')).toHaveCount(65);await page.locator('.pr-list-end').scrollIntoViewIfNeeded();await capture('results-end');
  await visit('/admin/question-papers/chat/'+historyId);await page.locator('.pr-detail-heading').waitFor();await page.getByRole('button',{name:'Activity and earlier requests'}).click();await page.locator('.pr-history-boundary').waitFor();await page.locator('.pr-history-boundary').scrollIntoViewIfNeeded();await capture('history-window');
  await page.getByRole('button',{name:'Load earlier activity',exact:true}).click();await expect(page.locator('.pr-history-boundary')).toContainText('161 activity entries · 150 saved requests');await page.getByRole('button',{name:'Load earlier activity',exact:true}).click();await expect(page.locator('.pr-history-boundary')).toContainText('161 activity entries · 161 saved requests');await expect(page.getByRole('button',{name:'Load earlier activity',exact:true})).toHaveCount(0);
  await page.locator('.pr-history-boundary').scrollIntoViewIfNeeded();await capture('history-beginning');
  await visit('/admin/question-papers');await settled();await page.getByLabel('Search all papers').fill('annual');
  await page.getByLabel('Search all papers').fill('annual 2024');
  let release;const held=new Promise(resolve=>release=resolve);await page.route('**/paperGateway/register?**q=annual**',async route=>{await held;await route.continue();});
  await page.getByRole('button',{name:'Search',exact:true}).click();await expect(page.getByText('Loading papers…',{exact:true})).toBeVisible();await capture('query-loading');const resumed=page.waitForResponse(r=>r.url().includes('paperGateway/register?')&&r.url().includes('q=annual'));release();await resumed;await page.unroute('**/paperGateway/register?**q=annual**');await settled();
  await page.route('**/paperGateway/register?**',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Papers could not update. Reconnect and try again.'})}));await page.getByLabel('Search all papers').fill('electromagnetic');await page.getByRole('button',{name:'Search',exact:true}).click();await page.locator('.pr-alert').waitFor();await capture('query-error');await page.unroute('**/paperGateway/register?**');await page.locator('.pr-alert button').click();await settled();await expect(page.locator('.pr-record')).toHaveCount(2);
  await visit('/admin/question-papers/new');await page.getByLabel('Paper requirement',{exact:true}).fill('CBSE Class 9 Biology, cells and tissues. 40 marks, 90 minutes. Include short explanations and one labelled diagram.');
  await page.route('**/documents:commit',route=>route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({error:{code:403,message:'This request could not be saved. Your text is kept. Try again when connected.',status:'PERMISSION_DENIED'}})}));
  await page.getByRole('button',{name:'Submit request',exact:true}).click();await page.locator('.pr-field-error').waitFor({timeout:45000});await capture('send-error',true);await page.unroute('**/documents:commit');
  await visit('/admin/question-papers/chat/visual-v1-geography');await page.locator('.pr-detail-heading').waitFor();await page.locator('.pr-updates summary').click();await page.getByRole('button',{name:/Class 7 Geography is ready/}).waitFor();await capture('notification-open');await page.getByRole('button',{name:/Class 7 Geography is ready/}).click();await expect(page.getByRole('button',{name:'Print paper / Save PDF',exact:true})).toBeEnabled();await capture('saved-paper',true);
  const frame=page.frameLocator('.pcv-sheet iframe');await frame.locator('body').evaluate(()=>{window.print=()=>{window.__printed=true;};});await page.getByRole('button',{name:'Print paper / Save PDF',exact:true}).click();expect(await frame.locator('body').evaluate(()=>window.__printed)).toBe(true);
  const studentHtml=await frame.locator('html').evaluate(el=>el.outerHTML);
  await page.getByRole('button',{name:'Answer key',exact:true}).click();await expect(page.getByRole('button',{name:'Print answer key / Save PDF',exact:true})).toBeEnabled();await capture('saved-key',true);
  const keyHtml=await frame.locator('html').evaluate(el=>el.outerHTML);
  if(width===1440){for(const [kind,content] of [['paper',studentHtml],['key',keyHtml]]){const printPage=await context.newPage();await printPage.setContent(content);await printPage.emulateMedia({media:'print'});await printPage.pdf({path:output+'/printed-'+kind+'.pdf',format:'A4',printBackground:true});await printPage.screenshot({path:output+'/print-'+kind+'-1440.png',fullPage:true});results.push({width:1440,name:'print-'+kind,identity:await printPage.locator('body').innerText(),method:'Actual saved iframe HTML with print media; Chromium PDF; native print invocation separately checked',overflow:false,errors:[]});await printPage.close();}}
  await visit('/admin/question-papers/chat/visual-v1-mathematics');await page.locator('.pr-detail-heading').waitFor();await page.locator('.pr-updates summary').click();await page.getByRole('button',{name:/Class 10 Mathematics needs your reply/}).click();await expect(page.locator('.pr-updates')).not.toHaveAttribute('open','');await capture('notification-return');
  await visit('/admin/question-papers/view/visual-v5-legacy');await expect(page.getByRole('button',{name:'Print paper / Save PDF',exact:true})).toBeEnabled();await expect(page.locator('.pcv-heading')).toContainText('Version not recorded');await capture('saved-legacy',true);
  await page.goto(baseUrl+'/admin/question-papers?emulator=1&testEmail='+encodeURIComponent(emptyEmail)+'&testPassword='+encodeURIComponent(password));await page.locator('.pr-page').waitFor();await settled();await page.getByLabel('Created by me').check();await settled();await page.getByRole('heading',{name:'No papers created by you yet'}).waitFor();await capture('first-request-empty-view');
 }
 await context.close();
}
await browser.close();fs.writeFileSync(root+'/design/paper-register/round-'+round+'/render-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify({renders:results.length,failures:results.filter(result=>result.overflow||result.errors.length)}));
