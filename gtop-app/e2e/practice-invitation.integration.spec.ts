import {test,expect,type Page,type TestInfo} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {initializeTestEnvironment,type RulesTestEnvironment} from '@firebase/rules-unit-testing';
import {collection,doc,getDoc,getDocs,query,setDoc,where} from 'firebase/firestore';

// The private reviewed content and synthetic emulator credentials remain outside this repository.
const fixturePath=process.env.GTOP_INVITATION_FIXTURE_PATH||path.resolve(__dirname,'../../../invitation-emulator-fixture.json');
const fixture=fs.existsSync(fixturePath)?JSON.parse(fs.readFileSync(fixturePath,'utf8')):null;
const review=fixture&&fs.existsSync(fixture.reviewPath)?JSON.parse(fs.readFileSync(fixture.reviewPath,'utf8')):null;
const scope='/practice?board=CBSE&standard=12&subjects=Chemistry&chapters=Solutions&count=5';
let environment:RulesTestEnvironment;
test.describe.configure({mode:'serial'});
test.skip(!fixture||!review,'Requires GTOP_INVITATION_FIXTURE_PATH pointing to a synthetic loopback-emulator fixture and private reviewed content.');
test.beforeAll(async()=>{
 expect(fixture.emulatorOnly).toBe(true);
 const topology=await (await fetch('http://127.0.0.1:4400/emulators')).json();
 for(const [name,port] of Object.entries({auth:9099,firestore:8080,database:9000}))expect(topology[name]).toMatchObject({host:'127.0.0.1',port});
 environment=await initializeTestEnvironment({projectId:'gtop-app',firestore:{host:'127.0.0.1',port:8080}});
});
test.afterAll(async()=>{await environment?.cleanup();});
test.beforeEach(async({context})=>{
  await context.route('**/*',route=>{
    const value=route.request().url();if(value.startsWith('data:'))return route.continue();
    const url=new URL(value);
    if(['localhost','127.0.0.1'].includes(url.hostname)&&['4300','8080','9099','9000'].includes(url.port))return route.continue();
    if(['fonts.googleapis.com','fonts.gstatic.com'].includes(url.hostname))return route.continue();
    return route.abort(); // Includes all production Firebase, analytics and real sign-in endpoints.
  });
});
async function open(page:Page,name:string|null,route=scope){
 const url=new URL(route,'http://127.0.0.1:4300');url.searchParams.set('emulator','1');
 if(name){url.searchParams.set('testEmail',fixture.accounts[name].email);url.searchParams.set('testPassword',fixture.password);}
 await page.goto(url.pathname+url.search);
}
async function capture(page:Page,info:TestInfo,name:string){
 await page.evaluate(()=>document.fonts.ready);await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const canvases=await settledCanvases(page);
 const files=['src/app/app.config.ts','src/app/services/practice-invite.service.ts','src/app/services/practice-invite-session.ts','src/app/services/practice-invite.guard.ts','src/app/services/quiz.service.ts','src/app/services/question-presentation.ts','src/app/pages/quiz-page/quiz-page.component.ts','src/app/pages/quiz-summary/quiz-summary.component.ts','src/app/pages/quiz-summary/quiz-summary.component.html'];
 const candidate={head:execFileSync('git',['rev-parse','HEAD'],{cwd:path.resolve(__dirname,'..'),encoding:'utf8'}).trim(),hashes:Object.fromEntries(files.map(file=>[file,createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'..',file))).digest('hex')]))};
 const dom=await page.evaluate(()=>({fonts:document.fonts.status,values:[...document.querySelectorAll('.stat-body .value')].map(element=>({text:element.textContent,rect:element.getBoundingClientRect().toJSON(),fontFamily:getComputedStyle(element).fontFamily,fontSize:getComputedStyle(element).fontSize,fontWeight:getComputedStyle(element).fontWeight,lineHeight:getComputedStyle(element).lineHeight,overflow:getComputedStyle(element).overflow}))}));
 fs.writeFileSync(info.outputPath(name+'.json'),JSON.stringify({candidate,dom,canvases},null,2));
 await page.screenshot({path:info.outputPath(name+'.png'),fullPage:true,animations:'disabled'});
}
async function settledCanvases(page:Page){
 let previous='',stable=0,samples:any[]=[];
 await expect.poll(async()=>{
  samples=await page.evaluate(async()=>Promise.all([...document.querySelectorAll<HTMLCanvasElement>('canvas')].map(async canvas=>{
   const width=canvas.width,height=canvas.height;const bytes=canvas.getContext('2d')!.getImageData(0,0,width,height).data;
   const digest=await crypto.subtle.digest('SHA-256',bytes);const hash=[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
   const accuracy=canvas.parentElement?.querySelector('.chart-center strong')?.textContent?.trim();const radius=Math.min(width,height)*0.42;
   const radial=Array.from({length:16},(_,i)=>{const angle=(i+.5)*Math.PI/8;const x=Math.round(width/2+Math.cos(angle)*radius),y=Math.round(height/2+Math.sin(angle)*radius);const offset=(y*width+x)*4;return {x,y,rgba:[...bytes.slice(offset,offset+4)]};});
   const green=radial.filter(({rgba:[r,g,b,a]})=>a>240&&r<90&&g>140&&b<145&&g>r+70).length;
   return {width,height,rect:canvas.getBoundingClientRect().toJSON(),hash,accuracy,radial,green,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches};
  })));
  const signature=JSON.stringify(samples.map(s=>[s.hash,s.width,s.height,s.rect]));stable=signature===previous?stable+1:0;previous=signature;
  return stable>=2&&samples.every(s=>s.width>0&&s.height>0&&(s.accuracy!=='100%'||s.green===16));
 },{timeout:15000,intervals:[150]}).toBe(true);
 return {consecutiveStableSamples:stable+1,samples};
}
// Warm the real lazy wrapper module while online; no component, result or acknowledgement is replaced.
async function warmSummary(page:Page){await page.evaluate(async()=>{const entry=[...document.querySelectorAll<HTMLScriptElement>('script[src]')].find(script=>/\/main(?:-[\w]+)?\.js/.test(script.src))?.src;if(!entry)throw Error('Main module not found');const main=await (await fetch(entry)).text();const module=main.match(/path:\s*["']quiz-summary["'][\s\S]{0,300}?import\(["']([^"'\s]+)["']\)/)?.[1];if(!module)throw Error('Unable to find real summary lazy module');await import(new URL(module,entry).href);});}
// The real app retains its explicitly selected localhost emulator mode across document reloads.
async function reload(page:Page,_name='learner'){await page.reload();}
async function session(page:Page,name='learner'){return page.evaluate(uid=>JSON.parse(sessionStorage.getItem('gtop.practice-invitation-session.v1.'+uid)||'null'),fixture.accounts[name].uid);}
async function results(name='learner'){
 let values:any[]=[];await environment.withSecurityRulesDisabled(async ctx=>{const snapshot=await getDocs(query(collection(ctx.firestore(),'QuizResults'),where('userId','==',fixture.accounts[name].uid)));values=snapshot.docs.map(d=>({id:d.id,...d.data()}));});return values;
}
async function start(page:Page){await page.getByRole('button',{name:'Start five questions',exact:true}).click();await expect(page.locator('.option-card')).toHaveCount(4,{timeout:30000});}
async function correct(page:Page,index:number){
 await expect(page.locator('.quiz-header h1')).toContainText(String(index+1));
 const raw=review.questions[index].options[0];const values=await page.locator('.answer-copy').allTextContents();const option=values.findIndex(v=>v.trim()===raw.trim());expect(option).toBeGreaterThanOrEqual(0);await page.locator('.option-card').nth(option).click();await expect(page.locator('.option-card').nth(option)).toHaveAttribute('aria-pressed','true');
}
async function answerAll(page:Page,first=0){for(let i=first;i<5;i++){await correct(page,i);await page.getByRole('button',{name:i===4?'Submit':'Next',exact:true}).click();}await expect(page.getByRole('heading',{name:'See what clicked.'})).toBeVisible({timeout:30000});}
async function acknowledged(page:Page){await expect(page.getByText('Your result is saved in Reports.',{exact:true})).toBeVisible({timeout:30000});await expect(page.getByRole('button',{name:'Keep this practice on my dashboard',exact:true})).toBeVisible();}
async function reloadRetryAtQ2(page:Page,before:any,info:TestInfo,name:string){
 await correct(page,0);await page.getByRole('button',{name:'Next',exact:true}).click();await expect(page.locator('.quiz-header h1')).toContainText('2');const checkpoint=await session(page);await reload(page);await expect(page.locator('.quiz-header h1')).toContainText('2');const after=await session(page);expect(after.attemptId).toBe(before.attemptId);expect(after.parentAttemptId).toBe(before.parentAttemptId);expect(after.questions).toEqual(checkpoint.questions);expect(after.currentQuestionIndex).toBe(1);expect(await page.evaluate(()=>({newInvitation:history.state.newInvitation,retryOf:history.state.invitationRetryOf}))).toEqual({newInvitation:undefined,retryOf:undefined});await capture(page,info,name);
}

test('real reviewed solo attempt reloads and server acknowledgement offers voluntary dashboard cue',async({page},info)=>{
 await open(page,'learner');await expect(page.getByRole('button',{name:'Start five questions',exact:true})).toBeVisible();await capture(page,info,'reviewed-preview');await start(page);await capture(page,info,'reviewed-solo');
 await correct(page,0);await page.getByRole('button',{name:'Next',exact:true}).click();const before=await session(page);expect(before.questionIds).toEqual(fixture.questionIds);expect(before.currentQuestionIndex).toBe(1);
 await reload(page);await expect(page.locator('.quiz-header h1')).toContainText('2',{timeout:30000});const restored=await session(page);expect(restored.attemptId).toBe(before.attemptId);expect(restored.questions).toEqual(before.questions);await capture(page,info,'reviewed-reload');
 await answerAll(page,1);await acknowledged(page);const active=await session(page);const saved=(await results()).filter(v=>v.attemptId===active.attemptId);expect(saved).toHaveLength(1);expect(saved[0]).toMatchObject({quizType:'custom',source:{kind:'invitation',revision:active.revision,entryType:'invitation'},correctAnswers:5,board:'CBSE',standard:'12',subject:'Chemistry',chapter:'Solutions'});expect(saved[0].invitation.questionIds).toEqual(fixture.questionIds);expect(saved[0].invitation.snapshots).toEqual(active.snapshots);expect(saved[0].invitation.contentHashes).toEqual(active.contentHashes);expect(active.acknowledgedReceipt).toBe(saved[0].id);expect(saved[0].questions.every((q:any)=>q.selectedIndex===0&&q.correctIndex===0)).toBe(true);
 await info.attach('acknowledged-quiz-result',{body:JSON.stringify(saved[0],null,2),contentType:'application/json'});await capture(page,info,'actual-acknowledged-offer');
 await page.getByRole('button',{name:'Keep this practice on my dashboard',exact:true}).click();const cue=await page.evaluate(uid=>JSON.parse(localStorage.getItem('gtop.practice.cue.v1.'+uid)||'null'),fixture.accounts.learner.uid);expect(cue.dueAt).toBeGreaterThan(Date.now()+23.9*3600000);
 await page.getByRole('button',{name:'Back to Dashboard',exact:true}).click();await expect(page.locator('app-practice-return-card')).toContainText('saved for tomorrow');await capture(page,info,'actual-dashboard-cue');
 await page.getByRole('button',{name:'Off',exact:true}).click();expect(await page.evaluate(uid=>localStorage.getItem('gtop.practice.cue.v1.'+uid),fixture.accounts.learner.uid)).toBeNull();await expect(page.locator('app-practice-return-card .practice-cue')).toHaveCount(0);await capture(page,info,'actual-off');
});

test('public sign-in intent survives auth interruption and mismatch never changes learner curriculum',async({page},info)=>{
 await open(page,null);await expect(page.getByRole('button',{name:'Sign in to practise',exact:true})).toBeVisible();await capture(page,info,'public-preview');await page.getByRole('button',{name:'Sign in to practise',exact:true}).click();await expect(page).toHaveURL(/returnUrl=/);
 const returnUrl=new URL(page.url()).searchParams.get('returnUrl')!;expect(returnUrl).toContain('practice=invite');expect(returnUrl).toContain('chapters=Solutions');
 await open(page,'mismatch',new URL(page.url()).pathname+new URL(page.url()).search);await expect(page.getByRole('heading',{name:'This link is for a different curriculum'})).toBeVisible({timeout:30000});expect(await session(page,'mismatch')).toBeNull();
 await environment.withSecurityRulesDisabled(async ctx=>{const user=await getDoc(doc(ctx.firestore(),'users',fixture.accounts.mismatch.uid));expect(user.data()).toMatchObject({board:'CBSE',standard:'10'});});await capture(page,info,'actual-mismatch');
});

test('direct auth interruption sanitizes untrusted returns and conflicting run mode fails closed',async({page},info)=>{
 const direct=scope.replace('/practice','/quiz')+'&practice=invite&returnTo=https%3A%2F%2Funtrusted.invalid%2F&hubReturnPath=%2F%2Funtrusted.invalid%2F';await open(page,null,direct);await expect(page).toHaveURL(/returnUrl=/);const retained=new URL(page.url()).searchParams.get('returnUrl')!;expect(retained).toContain('practice=invite');
 await open(page,'learner',new URL(page.url()).pathname+new URL(page.url()).search);await expect(page.locator('.option-card')).toHaveCount(4,{timeout:30000});expect(new URL(page.url()).searchParams.has('returnTo')).toBe(false);expect(new URL(page.url()).searchParams.has('hubReturnPath')).toBe(false);const current=await session(page);expect(current.returnTo).toBeUndefined();expect(current.hubReturnPath).toBeUndefined();await capture(page,info,'actual-authenticated-sanitized-return');
 await open(page,'learner',scope.replace('/practice','/quiz')+'&practice=invite&mode=run&sessionId=untrusted');await expect(page.locator('.option-card')).toHaveCount(0);await expect(page.getByRole('alert')).toBeVisible();expect(new URL(page.url()).pathname).toBe('/practice');expect(new URL(page.url()).searchParams.has('mode')).toBe(false);await capture(page,info,'actual-conflicting-run-fails-closed');
});

test('admin deliberately uses invited curriculum and Not now remains voluntary after reload',async({page},info)=>{
 await open(page,'admin');await start(page);await expect(page.locator('.meta-info')).toContainText('CBSE');await answerAll(page);await acknowledged(page);await page.getByRole('button',{name:'Not now',exact:true}).click();expect(await page.evaluate(uid=>localStorage.getItem('gtop.practice.cue.v1.'+uid),fixture.accounts.admin.uid)).toBeNull();
 await reload(page,'admin');await expect(page.getByText('Your result is saved in Reports.',{exact:true})).toBeVisible({timeout:30000});await expect(page.getByRole('button',{name:'Keep this practice on my dashboard',exact:true})).toHaveCount(0);await capture(page,info,'actual-not-now-restored');
});

test('admin custom setup copies only selected curriculum and provides a manual fallback',async({page,context},info)=>{
 await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:'http://127.0.0.1:4300'});await open(page,'admin','/dashboard');await page.getByRole('button',{name:'Custom Quiz',exact:true}).click();const modal=page.getByRole('dialog');await expect(modal).toBeVisible();await expect(modal.getByRole('button',{name:'Copy practice link',exact:true})).toBeDisabled();
 for(const [name,value,multiple] of [['Board','CBSE',false],['Standard','12',false],['Subjects','Chemistry',true],['Chapters','Solutions',true]] as const){await modal.getByRole('combobox',{name,exact:true}).click();await page.getByRole('option',{name:value,exact:true}).click();if(multiple)await page.keyboard.press('Escape');}
 await modal.getByRole('spinbutton',{name:'Number of Questions'}).fill('5');await expect(modal.getByRole('button',{name:'Copy practice link',exact:true})).toBeEnabled();await modal.getByRole('button',{name:'Copy practice link',exact:true}).click();await expect(modal.locator('app-practice-share [role=status]')).toContainText('Practice link copied');const value=await page.evaluate(()=>navigator.clipboard.readText());const url=new URL(value);expect(url.origin).toBe('http://127.0.0.1:4300');expect(url.pathname).toBe('/practice');expect(Object.fromEntries(url.searchParams)).toEqual({board:'CBSE',standard:'12',subjects:'Chemistry',chapters:'Solutions',count:'5'});await capture(page,info,'actual-admin-copy-practice-link');
 await page.evaluate(()=>{navigator.clipboard.writeText=async()=>{throw new DOMException('QA clipboard unavailable','NotAllowedError');};});await modal.getByRole('button',{name:'Copy practice link',exact:true}).click();await expect(modal.locator('app-practice-share [role=status]')).toContainText('Select the link below');await expect(modal.getByLabel('Practice link',{exact:true})).toHaveValue(value);await expect(modal.getByLabel('Practice link',{exact:true})).toHaveAttribute('readonly','');await capture(page,info,'actual-admin-copy-manual-fallback');
});

test('offline save exposes no offer and retry acknowledges exactly one result',async({page,context},info)=>{
 await open(page,'learner');await start(page);await warmSummary(page);const active=await session(page);await context.setOffline(true);await answerAll(page);await expect(page.getByRole('button',{name:'Try saving again',exact:true})).toBeVisible({timeout:30000});await expect(page.getByRole('button',{name:'Keep this practice on my dashboard',exact:true})).toHaveCount(0);expect((await results()).filter(v=>v.attemptId===active.attemptId)).toHaveLength(0);await capture(page,info,'actual-offline-save-error');
 await context.setOffline(false);if(await page.getByRole('button',{name:'Try saving again',exact:true}).isVisible())await page.getByRole('button',{name:'Try saving again',exact:true}).click();await acknowledged(page);const saved=(await results()).filter(v=>v.attemptId===active.attemptId);expect(saved).toHaveLength(1);await reload(page);await acknowledged(page);const repeated=(await results()).filter(v=>v.attemptId===active.attemptId);expect(repeated).toHaveLength(1);expect(repeated[0].timestamp).toEqual(saved[0].timestamp);await capture(page,info,'actual-retried-acknowledgement');
});

test('a real pending Firestore write offers no consent before its acknowledged result',async({page,context},info)=>{
 let armed=false;
 let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve;});let captured!:()=>void;const committing=new Promise<void>(resolve=>{captured=resolve;});
 await context.route('**/*',async route=>{const url=new URL(route.request().url());if(armed&&['127.0.0.1','localhost'].includes(url.hostname)&&url.port==='8080'&&route.request().method()==='POST'&&url.pathname.includes('/Write/channel')){captured();await held;}return route.fallback();});
 try{await open(page,'learner');await start(page);armed=true;const active=await session(page);await answerAll(page);await committing;await expect(page.locator('app-quiz-summary mat-card[aria-live] p')).toContainText('Saving your result');await expect(page.getByRole('button',{name:'Keep this practice on my dashboard'})).toHaveCount(0);expect((await results()).filter(v=>v.attemptId===active.attemptId)).toHaveLength(0);await capture(page,info,'actual-real-save-pending');release();await acknowledged(page);expect((await results()).filter(v=>v.attemptId===active.attemptId)).toHaveLength(1);await capture(page,info,'actual-delayed-write-acknowledged');}finally{release();}
});

test('normal motion eventually settles to a complete correct-result ring',async({page},info)=>{
 test.skip(info.project.name!=='invitation-desktop','Normal-motion settled geometry is checked separately on desktop.');await page.emulateMedia({reducedMotion:'no-preference'});await open(page,'learner');await start(page);await answerAll(page);await acknowledged(page);const canvas=await settledCanvases(page);expect(canvas.samples).toHaveLength(1);expect(canvas.samples[0]).toMatchObject({accuracy:'100%',green:16,reducedMotion:false});await capture(page,info,'actual-normal-motion-settled-ring');
});

test('uncached offline summary navigation exposes a recoverable completed attempt',async({page,context},info)=>{
 await open(page,'learner');await start(page);const active=await session(page);
 for(let i=0;i<5;i++){await correct(page,i);if(i<4)await page.getByRole('button',{name:'Next',exact:true}).click();}
 await context.setOffline(true);await page.getByRole('button',{name:'Submit',exact:true}).click();
 await expect(page.getByRole('button',{name:'Reload completed result',exact:true})).toBeVisible({timeout:30000});const completed=await session(page);expect(completed.attemptId).toBe(active.attemptId);expect(completed.completed).toBe(true);expect(completed.questions.every((q:any)=>q.selectedIndex!==null)).toBe(true);expect(completed.acknowledgedReceipt).toBeUndefined();await expect(page.getByRole('button',{name:'Keep this practice on my dashboard'})).toHaveCount(0);expect((await results()).filter(v=>v.attemptId===active.attemptId)).toHaveLength(0);
 await info.attach('offline-completed-session-proof',{body:JSON.stringify({attemptUnchanged:completed.attemptId===active.attemptId,completed:completed.completed,answers:completed.questions.map((q:any)=>q.selectedIndex),acknowledged:!!completed.acknowledgedReceipt}),contentType:'application/json'});await capture(page,info,'actual-offline-summary-recovery');
 await page.getByRole('button',{name:'Reload completed result',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Reconnect');await context.setOffline(false);await page.getByRole('button',{name:'Reload completed result',exact:true}).click();await acknowledged(page);expect((await results()).filter(v=>v.attemptId===active.attemptId)).toHaveLength(1);await capture(page,info,'actual-offline-recovery-acknowledged');
});

test('an ordinary completed unsaved attempt blocks invitation and offers explicit save recovery',async({page,context},info)=>{
 await open(page,'learner',scope.replace('/practice','/quiz'));await expect(page.locator('.option-card')).toHaveCount(4);await warmSummary(page);
 for(let i=0;i<5;i++){await expect(page.locator('.quiz-header h1')).toContainText(String(i+1));await page.locator('.option-card').first().click();if(i<4)await page.getByRole('button',{name:'Next',exact:true}).click();}
 await context.setOffline(true);await page.getByRole('button',{name:'Submit',exact:true}).click();await expect(page.getByRole('button',{name:'Try saving again',exact:true})).toBeVisible();const previous=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('gtop.practice-session.v1')!));expect(previous.completed).toBe(true);expect(previous.saved).toBe(false);
 await context.setOffline(false);await open(page,'learner');await startPreviewOnly(page);await expect(page.getByRole('button',{name:'Save previous result',exact:true})).toBeVisible();await capture(page,info,'actual-ordinary-unsaved-block');await page.getByRole('button',{name:'Save previous result',exact:true}).click();await expect(page.getByText('Your result is saved in Reports.',{exact:true})).toBeVisible({timeout:30000});await expect(page.getByRole('button',{name:'Keep this practice on my dashboard'})).toHaveCount(0);const saved=(await results()).filter(v=>v.attemptId===previous.attemptId);expect(saved).toHaveLength(1);expect(saved[0].invitation).toBeUndefined();await expect(page.getByRole('button',{name:'Back to invitation',exact:true})).toBeVisible();await capture(page,info,'actual-ordinary-saved-return');await page.getByRole('button',{name:'Back to invitation',exact:true}).click();await start(page);await capture(page,info,'actual-invitation-after-ordinary-recovery');
});
async function startPreviewOnly(page:Page){await page.getByRole('button',{name:'Start five questions',exact:true}).click();}

test('due return counts only an actual new start and Off failure stays visible',async({page},info)=>{
 await open(page,'learner');await start(page);await answerAll(page);await acknowledged(page);const original=await session(page);await page.getByRole('button',{name:'Keep this practice on my dashboard',exact:true}).click();
 await page.evaluate(uid=>{const key='gtop.practice.cue.v1.'+uid;const cue=JSON.parse(localStorage.getItem(key)!);cue.dueAt=Date.now()-1000;localStorage.setItem(key,JSON.stringify(cue));},fixture.accounts.learner.uid);
 await page.getByRole('button',{name:'Back to Dashboard',exact:true}).click();await expect(page.getByRole('button',{name:'Revisit five questions'})).toBeVisible();
 await page.evaluate(()=>{(window as any).__qaRemove=Storage.prototype.removeItem;Storage.prototype.removeItem=function(key){if(key.startsWith('gtop.practice.cue.v1.'))throw Error('qa-storage-unavailable');return (window as any).__qaRemove.call(this,key);};});
 await page.getByRole('button',{name:'Off',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'It is still saved'})).toBeVisible();await expect(page.getByRole('button',{name:'Revisit five questions'})).toBeVisible();await capture(page,info,'actual-off-storage-error');
 await page.evaluate(()=>{Storage.prototype.removeItem=(window as any).__qaRemove;});
 const eventsBefore=await page.evaluate(()=>JSON.parse(localStorage.getItem('gtop.practice.evidence.v1')||'[]'));await page.getByRole('button',{name:'Revisit five questions'}).click();await expect(page.getByRole('button',{name:'Start five questions'})).toBeVisible();
 const clicked=await page.evaluate(()=>JSON.parse(localStorage.getItem('gtop.practice.evidence.v1')||'[]'));expect(clicked.filter((e:any)=>e.stage==='practice_return_click')).toHaveLength(eventsBefore.filter((e:any)=>e.stage==='practice_return_click').length+1);expect(clicked.filter((e:any)=>e.stage==='practice_return')).toHaveLength(eventsBefore.filter((e:any)=>e.stage==='practice_return').length);await capture(page,info,'actual-due-return-preview');
 await start(page);const current=await session(page);expect(current.attemptId).not.toBe(original.attemptId);expect(current.questions.every((q:any)=>q.selectedIndex===null)).toBe(true);
 const started=await page.evaluate(()=>JSON.parse(localStorage.getItem('gtop.practice.evidence.v1')||'[]'));expect(started.filter((e:any)=>e.stage==='practice_return')).toHaveLength(eventsBefore.filter((e:any)=>e.stage==='practice_return').length+1);expect(await page.evaluate(uid=>localStorage.getItem('gtop.practice.cue.v1.'+uid),fixture.accounts.learner.uid)).toBeNull();await capture(page,info,'actual-due-return-started');
});

test('saved invitation history retains reviewed snapshots after local bank edit and current full retry stays linked',async({page},info)=>{
 await open(page,'learner');await start(page);await answerAll(page);await acknowledged(page);const original=await session(page);
 await page.getByRole('button',{name:'Revisit five questions',exact:true}).click();await expect(page.locator('.option-card')).toHaveCount(4);const retry=await session(page);expect(retry.attemptId).not.toBe(original.attemptId);expect(retry.parentAttemptId).toBe(original.attemptId);expect(retry.entryType).toBe('invitation-retry');expect(retry.questions.every((q:any)=>q.selectedIndex===null)).toBe(true);await reloadRetryAtQ2(page,retry,info,'actual-current-retry-Q2-reload');await answerAll(page,1);await acknowledged(page);const saved=(await results()).find(v=>v.attemptId===retry.attemptId);expect(saved.source).toMatchObject({kind:'invitation',entryType:'invitation-retry'});expect(saved.invitation.parentAttemptId).toBe(original.attemptId);
 const originalSaved=(await results()).find(v=>v.attemptId===original.attemptId);await open(page,'learner',`/quiz-summary?sessionId=${encodeURIComponent(originalSaved.id)}&userId=${encodeURIComponent(fixture.accounts.learner.uid)}`);await expect(page.getByRole('button',{name:'Revisit five questions',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Retry Incorrect',exact:true})).toHaveCount(0);await capture(page,info,'actual-historical-revisit-action');await page.getByRole('button',{name:'Revisit five questions',exact:true}).click();await expect(page.locator('.option-card')).toHaveCount(4);const historicalRetry=await session(page);expect(historicalRetry.attemptId).not.toBe(retry.attemptId);expect(historicalRetry.parentAttemptId).toBe(original.attemptId);expect(historicalRetry.entryType).toBe('invitation-retry');expect(historicalRetry.questions.every((q:any)=>q.selectedIndex===null)).toBe(true);await capture(page,info,'actual-historical-linked-revisit');await reloadRetryAtQ2(page,historicalRetry,info,'actual-historical-retry-Q2-reload');await answerAll(page,1);await acknowledged(page);const historySaved=(await results()).find(v=>v.attemptId===historicalRetry.attemptId);expect(historySaved.source).toMatchObject({kind:'invitation',entryType:'invitation-retry'});expect(historySaved.invitation.parentAttemptId).toBe(original.attemptId);
 let bank:any;await environment.withSecurityRulesDisabled(async ctx=>{const ref=doc(ctx.firestore(),'questions',fixture.questionIds[0]);bank=(await getDoc(ref)).data();await setDoc(ref,{...bank,question:'QA emulator-only source unavailable'});});
 try{await open(page,'learner',`/quiz-summary?sessionId=${encodeURIComponent(saved.id)}&userId=${encodeURIComponent(fixture.accounts.learner.uid)}`);await expect(page.getByRole('heading',{name:'See what clicked.'})).toBeVisible();await expect(page.locator('mat-expansion-panel')).toHaveCount(5);await page.locator('mat-expansion-panel-header').first().click();await expect(page.locator('app-quiz-summary')).toContainText(review.questions[0].question);await capture(page,info,'actual-historical-snapshot-after-bank-edit');
 await open(page,'other');await page.getByRole('button',{name:'Start five questions',exact:true}).click();await expect(page.locator('.option-card')).toHaveCount(0);await expect(page.getByRole('alert')).toBeVisible();expect(await session(page,'other')).toBeNull();await capture(page,info,'actual-changed-reviewed-bank-fails-closed');
 }finally{await environment.withSecurityRulesDisabled(async ctx=>{await setDoc(doc(ctx.firestore(),'questions',fixture.questionIds[0]),bank);});}
});


