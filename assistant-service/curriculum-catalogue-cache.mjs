import {createHash,randomUUID} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {boards,catalogueWithCounts} from './domain/catalogue.mjs';
import {readCurriculumOutline} from './curriculum-outline.mjs';

const path='assistantConfig/curriculumCatalogue';
const freshnessMs=6*60*60_000;
const staleGraceMs=60*60_000;
const leaseMs=60_000;
const maxEncodedBytes=850_000;
const maxDecodedBytes=16_000_000;

function cachedValue(record){
  if(record?.schemaVersion!==2||!Number.isFinite(record.expiresAt)||typeof record.version!=='string'||typeof record.content!=='string'||record.content.length>maxEncodedBytes)return null;
  try{
    const value=JSON.parse(gunzipSync(Buffer.from(record.content,'base64'),{maxOutputLength:maxDecodedBytes}));
    return {value,version:record.version,expiresAt:record.expiresAt};
  }catch{return null;}
}

// The derived cache is private, shared across gateway instances, and rebuilt only
// when a legacy curriculum consumer asks after expiry. The syllabus stays authoritative.
export class CurriculumCatalogueCache {
  constructor(store,sleep,fail){this.store=store;this.sleep=sleep;this.fail=fail;this.lastLog=new Map();}
  report(outcome,consumer,details={}){
    const key=outcome+':'+consumer,now=Date.now();
    if(outcome!=='rebuild'&&now-(this.lastLog.get(key)||0)<60_000)return;
    this.lastLog.set(key,now);
    console.info(JSON.stringify({event:'gt_papers_curriculum_catalogue',outcome,consumer,...details}));
  }
  async get(consumer){
    if(this.local?.expiresAt>Date.now()){
      this.report('memory-hit',consumer);return this.local.value;
    }
    if(this.pending){this.report('coalesced',consumer);return this.pending;}
    const pending=this.load(consumer);
    this.pending=pending;
    try{return await pending;}finally{if(this.pending===pending)this.pending=undefined;}
  }
  async load(consumer,canReclaim=true){
    const started=Date.now();
    const publish=(entry,outcome)=>{this.local=entry;this.report(outcome,consumer,{durationMs:Date.now()-started});return entry.value;};
    let previous;
    try{previous=await this.store.get(path);}
    catch{return this.recover(consumer,this.local);}
    const warm=cachedValue(previous);
    if(warm?.expiresAt>Date.now())return publish(warm,'shared-hit');

    const leaseId=randomUUID();
    let claim;
    try{
      claim=await this.store.transaction(async tx=>{
        const record=await tx.get(path),now=Date.now();
        const hit=cachedValue(record);
        if(hit?.expiresAt>now)return {hit};
        if(record?.leaseUntil>now)return {waiting:true};
        tx.set(path,{...record,schemaVersion:2,leaseId,leaseUntil:now+leaseMs});
        return {waiting:false};
      });
    }catch{return this.recover(consumer,warm??this.local);}
    if(claim.hit)return publish(claim.hit,'shared-hit');
    if(claim.waiting){
      for(const delay of [400,1000,2000,3500,5000]){
        await this.sleep(delay);
        let record;
        try{record=await this.store.get(path);}
        catch{return this.recover(consumer,warm??this.local);}
        const entry=cachedValue(record);
        if(entry?.expiresAt>Date.now())return publish(entry,'shared-after-wait');
        if(canReclaim&&!(record?.leaseUntil>Date.now()))return this.load(consumer,false);
      }
      this.report('refresh-pending',consumer);
      return this.recover(consumer,warm??this.local);
    }

    try{
      const {value,version,counts}=await this.readSource();
      const expiresAt=Date.now()+freshnessMs;
      const encoded=Buffer.from(JSON.stringify(value));
      const content=encoded.length<=maxDecodedBytes?gzipSync(encoded).toString('base64'):null;
      if(!content||content.length>maxEncodedBytes)throw Error('Curriculum catalogue exceeds its shared content budget.');
      const stored=await this.store.transaction(async tx=>{
        const record=await tx.get(path);
        if(record?.leaseId!==leaseId)return false;
        if(record.version===version&&cachedValue(record)){
          tx.update(path,{expiresAt,leaseId:null,leaseUntil:0});
        }else{
          tx.set(path,{schemaVersion:2,version,expiresAt,content});
        }
        return true;
      }).catch(()=>{this.report('cache-write-unavailable',consumer);return false;});
      this.report('rebuild',consumer,{...counts,encodedBytes:content.length,shared:stored,
        versionChanged:warm?.version!==version,durationMs:Date.now()-started});
      this.local={value,version,expiresAt};
      return value;
    }catch(error){
      this.report('rebuild-error',consumer);
      await this.store.transaction(async tx=>{
        if((await tx.get(path))?.leaseId===leaseId)tx.update(path,{leaseId:null,leaseUntil:0});
      }).catch(()=>{});
      if(warm&&warm.expiresAt+staleGraceMs>Date.now())return this.recover(consumer,warm);
      throw error;
    }
  }
  async readSource(){
    const {scopes,...counts}=await readCurriculumOutline(this.store,boards);
    const value=catalogueWithCounts(scopes);
    const version=createHash('sha256').update(JSON.stringify(value)).digest('hex');
    return {value,version,counts};
  }
  recover(consumer,entry){
    if(entry?.expiresAt+staleGraceMs>Date.now()){
      this.report('stale-shared',consumer,{expiredMs:Math.max(0,Date.now()-entry.expiresAt)});
      return entry.value;
    }
    this.fail(503,'curriculum_refresh_pending','The curriculum catalogue is refreshing. Please try again shortly.');
  }
}
