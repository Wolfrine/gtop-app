import {test,expect,type Page} from '@playwright/test';
import {initializeApp,deleteApp} from 'firebase/app';
import {getAuth,connectAuthEmulator,createUserWithEmailAndPassword} from 'firebase/auth';
import {initializeTestEnvironment,type RulesTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,getDocs,collection,query,where,Timestamp} from 'firebase/firestore';

const tag=`chat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const email=tag+'@gtop.test',password='Paper-chat-2026';
let uid:string,environment:RulesTestEnvironment;
test.beforeAll(async()=>{
  const app=initializeApp({apiKey:'demo',projectId:'gtop-app'},tag);const auth=getAuth(app);connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});
  uid=(await createUserWithEmailAndPassword(auth,email,password)).user.uid;
  environment=await initializeTestEnvironment({projectId:'gtop-app',firestore:{host:'127.0.0.1',port:8080}});
  await environment.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),'users',uid),{uid,email,displayName:'Chat Admin',role:'admin',board:'ICSE',standard:'9'}));await deleteApp(app);
});
test.afterAll(async()=>environment?.cleanup());
async function open(page:Page,path='/admin/question-papers'){
  await page.goto(path+'?emulator=1&testEmail='+encodeURIComponent(email)+'&testPassword='+encodeURIComponent(password));
  await expect(page.locator('.pr-page')).toBeVisible({timeout:25000});
}
async function fits(page:Page){await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
async function mine(){let items:any[]=[];await environment.withSecurityRulesDisabled(async ctx=>{items=(await getDocs(query(collection(ctx.firestore(),'paperRequests'),where('requestedBy','==',uid)))).docs.map(d=>({...d.data(),id:d.id}));});return items;}

test('chat saves a real requirement, supersedes pending work and restores cancellation after reload',async({page},info)=>{
  await open(page,'/admin/question-papers/new');await page.getByLabel('Paper requirement',{exact:true}).fill('ICSE 9 Biology, Cells, 2 marks. Short answer.');await page.getByRole('button',{name:'Submit request',exact:true}).click();
  await expect(page.locator('.pr-request-state').getByText('Queued',{exact:true}).first()).toBeVisible();
  await expect.poll(async()=> (await mine()).length).toBe(1);const first=(await mine())[0];
  await page.getByRole('button',{name:'Update requirement',exact:true}).click();await page.getByLabel('Paper requirement',{exact:true}).fill('Make it 4 marks instead, keeping the same scope.');await page.getByRole('button',{name:'Submit revision',exact:true}).click();
  await expect.poll(async()=> (await mine()).length).toBe(2);const records=await mine();expect(records.find(item=>item.id===first.id).status).toBe('cancelled');
  const current=records.find(item=>item.id!==first.id);expect(current.revision).toBe(2);expect(current.source).toBe('admin-paper-chat');
  await page.getByRole('button',{name:'Cancel request',exact:true}).click();
  await expect.poll(async()=> (await mine()).find(item=>item.id===current.id).status).toBe('cancelled');
  await page.reload();await page.getByRole('button',{name:/Activity and earlier requests/}).click();await expect(page.locator('.pr-history').getByText('Make it 4 marks instead, keeping the same scope.',{exact:true})).toBeVisible();
  await fits(page);await page.screenshot({path:info.outputPath('chat-cancelled.png'),fullPage:true});
});

test('delivered paper, separate answers, notification and older archive remain accessible',async({page},info)=>{
  const conversationId=tag+'-complete',paperId=tag+'-paper',title='Cell practice '+tag+' UnbrokenTitleForNarrowScreenContinuity';
  const stem='Explain why mitochondria have folded inner membranes.';const secret='TEACHER-ANSWER: folds increase the surface for ATP production.';
  const html=(answers=false)=>`<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4}body{font:16px/1.6 Georgia}h1{overflow-wrap:anywhere}</style></head><body><h1>${title}</h1><p>${stem}</p>${answers?'<p>'+secret+'</p>':''}</body></html>`;
  await environment.withSecurityRulesDisabled(async ctx=>{
    const db=ctx.firestore(),now=Timestamp.now();await setDoc(doc(db,'paperConversations',conversationId),{title,ownerUid:uid,status:'completed',createdAt:now,updatedAt:now});
    await setDoc(doc(db,'paperDrafts',paperId),{title,board:'ICSE',standard:'9',subjects:['Biology'],chapters:['Cells'],marks:2,actualMarks:2,durationMinutes:10,status:'ready',conversationId,paperHtml:html(),answerHtml:html(true),createdAt:now});
    await setDoc(doc(db,'paperMessages',tag+'-delivery'),{role:'agent',conversationId,text:'Your paper is ready. Reused 1 bank question and created 0 new questions.',paperId,createdAt:now});
    await setDoc(doc(db,'paperNotifications',tag+'-notification'),{ownerUid:uid,conversationId,paperId,text:title+' is ready.',read:false,createdAt:now});
    // This fixture represents an already delivered, archived paper. Source writes
    // complete before their asynchronous search projection, especially on a cold
    // emulator. Wait for the real triggers; never seed the derived index directly.
    await expect.poll(async()=>{
      const [source,record]=await Promise.all([getDoc(doc(db,'paperRegisterSearch','p-'+paperId)),getDoc(doc(db,'paperRegister',conversationId))]);
      return {familyId:source.data()?.familyId,searchable:source.data()?.tokens?.includes(tag),paperId:record.data()?.latestPaperId,ready:record.data()?.hasReady};
    },{message:'Delivered fixture must be projected into the searchable paper register',timeout:45000,intervals:[100,250,500,1000]}).toEqual({familyId:conversationId,searchable:true,paperId,ready:true});
  });
  await open(page,'/admin/question-papers/chat/'+conversationId);await page.getByRole('button',{name:/Activity and earlier requests/}).click();await expect(page.getByText('Your paper is ready. Reused 1 bank question and created 0 new questions.',{exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Open paper',exact:false}).first().click();
  await expect(page.frameLocator('.pcv-sheet iframe').getByText(stem,{exact:true})).toBeVisible();await expect(page.frameLocator('.pcv-sheet iframe').getByText(secret,{exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Print paper / Save PDF',exact:true})).toBeEnabled();
  await page.frameLocator('.pcv-sheet iframe').locator('body').evaluate(()=>{(window as any).print=()=>{(window as any).__paperPrintCalled=true;};});
  await page.getByRole('button',{name:'Print paper / Save PDF',exact:true}).click();expect(await page.frameLocator('.pcv-sheet iframe').locator('body').evaluate(()=>!!(window as any).__paperPrintCalled)).toBe(true);
  await page.getByRole('button',{name:'Answer key',exact:true}).click();await expect(page.frameLocator('.pcv-sheet iframe').getByText(secret,{exact:true})).toBeVisible();await expect(page.getByText('Teacher copy · keep separate from students',{exact:true})).toBeVisible();
  await fits(page);await page.screenshot({path:info.outputPath('paper-answer-key.png'),fullPage:true});
  await page.getByRole('link',{name:'All papers',exact:false}).first().click();await page.getByLabel('Search all papers').fill(tag);await page.getByRole('button',{name:'Search',exact:true}).click();await expect(page.locator('.pr-record').filter({hasText:title})).toBeVisible({timeout:20000});await fits(page);
  await page.goto('/admin/question-papers/chat/'+conversationId+'?emulator=1');await page.locator('.pr-updates summary').click();await page.getByRole('button').filter({hasText:title+' is ready.'}).click();
  await expect.poll(async()=>{let read=false;await environment.withSecurityRulesDisabled(async ctx=>{read=!!(await getDoc(doc(ctx.firestore(),'paperNotifications',tag+'-notification'))).data()?.read;});return read;}).toBe(true);
});

test('offline send retains the typed requirement until a server save is confirmed',async({page})=>{
  await open(page,'/admin/question-papers/new');await page.getByLabel('Paper requirement',{exact:true}).fill('ICSE 9 Biology 40 marks across Cells.');
  await page.route('http://127.0.0.1:8080/**',route=>route.abort());
  // The transaction must not acknowledge a server save while offline. Restore
  // connection to let the SDK resolve, then inspect the retained/confirmed state.
  await page.getByRole('button',{name:'Submit request',exact:true}).click();await expect(page.getByLabel('Paper requirement',{exact:true})).toHaveValue('ICSE 9 Biology 40 marks across Cells.');
  await page.unroute('http://127.0.0.1:8080/**');
});
