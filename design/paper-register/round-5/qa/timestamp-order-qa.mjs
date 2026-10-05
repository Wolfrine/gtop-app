// Independent regression for worker ISO timestamp precedence. Local emulator only.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../gtop-question-journey/gtop-app/functions/package.json',import.meta.url));
const {initializeApp}=require('firebase-admin/app');
const {getFirestore,Timestamp}=require('firebase-admin/firestore');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8080','QA must run only against the local emulator.');
const baseline=process.argv.includes('--baseline');
const backend=new URL(baseline?'./baseline/paper-register.mjs':'../gtop-question-journey/gtop-app/functions/paper-register.mjs',import.meta.url);
const {projectSource,refreshRegister,searchRegister}=await import(backend.href);
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const projectId=baseline?'demo-gtop-timestamp-baseline':'demo-gtop-timestamp-final';
const app=initializeApp({projectId},projectId),db=getFirestore(app);
const prefix='timestamp-'+Date.now(),uid=prefix+'-admin',term=prefix+'-needle';
const result={projectId,localOnly:true,baseline,startedAt:new Date().toISOString(),backendSha256:hash(backend),scriptSha256:hash(new URL(import.meta.url)),checks:[]};
const sourceRecords=[];
const t=year=>Date.UTC(year,0,1),stamp=year=>Timestamp.fromMillis(t(year)),iso=year=>new Date(t(year)).toISOString();
const put=async(collection,suffix,values)=>{const id=prefix+'-'+suffix,path=collection+'/'+id,data={title:term+' '+suffix,brief:term,createdAt:stamp(2010),requestedBy:uid,createdBy:uid,ownerUid:uid,status:'queued',...values};await db.doc(path).set(data);const snapshot=await db.doc(path).get();sourceRecords.push({path,data:snapshot.data(),updateTime:snapshot.updateTime.toMillis()});return{id,path,data:snapshot.data()};};
const projected=async row=>{await projectSource(db,row.path.split('/')[0],row.id);return(await db.doc('paperRegisterSearch/'+({paperRequests:'r',paperConversations:'c',paperDrafts:'p'}[row.path.split('/')[0]])+'-'+row.id).get()).data();};
async function check(name,run){try{await run();result.checks.push({name,passed:true});console.log('PASS '+name);}catch(error){result.checks.push({name,passed:false,error:String(error.stack??error)});console.error('FAIL '+name+': '+error.message);}}
try{
 await db.doc('users/'+uid).set({role:'admin',displayName:'Independent timestamp QA'});
 const older=await put('paperRequests','older',{updatedAt:stamp(2018),updatedAtIso:iso(2024)});
 const middle=await put('paperRequests','middle',{updatedAt:stamp(2022)});
 const tsNewer=await put('paperRequests','ts-newer',{updatedAt:stamp(2025),updatedAtIso:iso(2020)});
 const malformed=await put('paperRequests','malformed',{updatedAt:stamp(2021),updatedAtIso:'not-a-date'});
 const noUpdated=await put('paperRequests','iso-only',{updatedAtIso:iso(2023)});
 const published=await put('paperDrafts','published',{status:'ready',updatedAt:stamp(2017),publishedAt:stamp(2020)});
 const fallback=await put('paperDrafts','fallback',{status:'ready',updatedAt:'invalid',updatedAtIso:'invalid'});
 const dateless=await put('paperDrafts','dateless',{status:'ready'});await db.doc(dateless.path).update({createdAt:require('firebase-admin/firestore').FieldValue.delete()});const datelessSnap=await db.doc(dateless.path).get();const drecord=sourceRecords.find(r=>r.path===dateless.path);drecord.data=datelessSnap.data();drecord.updateTime=datelessSnap.updateTime.toMillis();
 const expected=new Map([[older.id,t(2024)],[middle.id,t(2022)],[tsNewer.id,t(2025)],[malformed.id,t(2021)],[noUpdated.id,t(2023)],[published.id,t(2020)],[fallback.id,t(2010)],[dateless.id,datelessSnap.createTime.toMillis()]]);
 for(const row of [older,middle,tsNewer,malformed,noUpdated,published,fallback,dateless])await check('projection timestamp '+row.id.slice(prefix.length+1),async()=>{const p=await projected(row);assert.equal(p.updatedAt,expected.get(row.id));assert.equal(p.sortTime,expected.get(row.id));});
 await check('searched and unsearched cursor order both use latest source timestamp',async()=>{const expectedIds=[dateless,tsNewer,older,noUpdated,middle,malformed,published,fallback].map(r=>(r.path.startsWith('paperDrafts/')?'legacy-paper-':'legacy-request-')+r.id);const traversals=[];for(const query of [{mine:'1',limit:'2'},{mine:'1',q:term,limit:'2'}]){const ids=[];let cursor;for(let page=0;page<10;page++){const data=await searchRegister(db,{...query,...(cursor?{cursor}:{})},uid);ids.push(...data.items.map(x=>x.id));cursor=data.nextCursor;if(!cursor)break;}assert(!cursor,'Pagination must terminate');assert.deepEqual(ids,expectedIds);traversals.push(ids);}result.cursorOrder=traversals;});
 await check('family summary reads current request and conversation ISO timestamps',async()=>{const chat=await put('paperConversations','chat',{updatedAt:stamp(2015),updatedAtIso:iso(2026)});const request=await put('paperRequests','chat-request',{conversationId:chat.id,updatedAt:stamp(2016),updatedAtIso:iso(2027)});await db.doc(chat.path).update({activeRequestId:request.id});const snap=await db.doc(chat.path).get();const canonical=sourceRecords.find(r=>r.path===chat.path);canonical.data=snap.data();canonical.updateTime=snap.updateTime.toMillis();await projected(chat);await projected(request);assert.equal((await db.doc('paperRegister/'+chat.id).get()).data().updatedAt,t(2027));await db.doc(request.path).update({updatedAtIso:iso(2028)});const rs=await db.doc(request.path).get(),rrecord=sourceRecords.find(r=>r.path===request.path);rrecord.data=rs.data();rrecord.updateTime=rs.updateTime.toMillis();await refreshRegister(db,chat.id);assert.equal((await db.doc('paperRegister/'+chat.id).get()).data().updatedAt,t(2028),'Current authoritative request must outrank lagging derived source');});
 await check('projection and family refresh preserve every canonical source and update time',async()=>{for(const before of sourceRecords){const after=await db.doc(before.path).get();assert.deepEqual(after.data(),before.data,before.path);assert.equal(after.updateTime.toMillis(),before.updateTime,before.path);}});
}catch(error){result.error=String(error.stack??error);process.exitCode=1;console.error(error);}
finally{result.finishedAt=new Date().toISOString();result.verdict=!result.error&&result.checks.every(c=>c.passed)?'PASS':'FAIL';writeFileSync(new URL(baseline?'./timestamp-baseline-result.json':'./timestamp-final-result.json',import.meta.url),JSON.stringify(result,null,2));await db.terminate();}
if(result.verdict!=='PASS')process.exitCode=1;
