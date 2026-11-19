// Capture drafts live on the current browser until upload, explicit removal or expiry.
export type CameraSource = {veryDark?:boolean;key:string; name:string;size:number;modified:number;pages:number;starts:boolean;rotations:[number,number][]};
export type CameraDraft = {
  id:string;owner:string;revision:number;expires:number;updated:number;packetId:string;paperId:string;createId:string;defaultLabel:string;
  label:string;expected:number|null;sources:CameraSource[];
};
const duration=24*60*60*1000;
let connection:Promise<IDBDatabase>|undefined;
function database():Promise<IDBDatabase>{
  if(!connection){
    connection=new Promise<IDBDatabase>((resolve,reject)=>{
      const open=indexedDB.open('gt-papers-camera-drafts',1);
      open.onupgradeneeded=()=>{
        const drafts=open.result.createObjectStore('drafts',{keyPath:'id'});drafts.createIndex('owner','owner');drafts.createIndex('expires','expires');
        open.result.createObjectStore('photos',{keyPath:['owner','draft','key']});
      };
      open.onsuccess=()=>{const db=open.result;db.onversionchange=()=>{db.close();connection=undefined;};resolve(db);};
      open.onerror=()=>reject(open.error);
      open.onblocked=()=>reject(Error('Device storage is busy.'));
    }).catch(error=>{connection=undefined;throw error;});
  }
  return connection;
}
function read<T>(r:IDBRequest<T>):Promise<T>{return new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
function committed(t:IDBTransaction){
  const result=new Promise<void>((resolve,reject)=>{t.oncomplete=()=>resolve();t.onabort=t.onerror=()=>reject(t.error||Error('Device storage is unavailable.'));});
  // An individual read can reject before its transaction's abort event is delivered.
  void result.catch(()=>{});return result;
}
function remove(t:IDBTransaction,d:CameraDraft){
  t.objectStore('photos').delete(IDBKeyRange.bound([d.owner,d.id,''],[d.owner,d.id,'\uffff']));
  t.objectStore('drafts').delete(d.id);
}
export async function cameraDrafts(owner:string):Promise<CameraDraft[]>{
  const db=await database(),t=db.transaction(['drafts','photos'],'readwrite'),end=committed(t);
  const drafts=t.objectStore('drafts'),now=Date.now();
  const [records,expired]=await Promise.all([read<CameraDraft[]>(drafts.index('owner').getAll(owner)),read<CameraDraft[]>(drafts.index('expires').getAll(IDBKeyRange.upperBound(now)))]);
  for(const d of expired)remove(t,d);
  await end;
  return records.filter(d=>d.owner===owner&&d.expires>now).sort((a,b)=>b.updated-a.updated);
}
export async function storeCameraDraft(d:CameraDraft,images:{key:string;blob:Blob}[]){
  const db=await database(),t=db.transaction(['drafts','photos'],'readwrite'),end=committed(t);
  const manifest=t.objectStore('drafts'), photos=t.objectStore('photos');
  const old:CameraDraft|undefined=await read(manifest.get(d.id));
  if(old&&old.owner!==d.owner){await end;throw Error('Camera draft belongs to a different account.');}
  if((old?.revision??0)!==d.revision){await end;throw Error('Another tab changed this camera draft.');}
  const keys=new Set(d.sources.map(s=>s.key));
  for(const source of old?.sources??[])if(source.key&&!keys.has(source.key))photos.delete([d.owner,d.id,source.key]);
  for(const {key,blob} of images)photos.put({owner:d.owner,draft:d.id,key,blob});
  const now=Date.now();manifest.put({...d,revision:d.revision+1,updated:now,expires:now+duration});await end;return d.revision+1;
}
export async function loadCameraDraft(owner:string,id:string){
  const db=await database(),t=db.transaction(['drafts','photos']),manifest:CameraDraft|undefined=await read(t.objectStore('drafts').get(id));
  if(!manifest||manifest.owner!==owner||manifest.expires<=Date.now())throw Error('This camera draft is no longer available.');
  const camera=manifest.sources.filter(s=>s.key);
  const files=await Promise.all(camera.map(async s=>{const image=await read(t.objectStore('photos').get([owner,id,s.key]));if(!(image?.blob instanceof Blob))throw Error('A saved camera photo is unavailable.');return [s.key,new File([image.blob],s.name,{type:'image/jpeg',lastModified:s.modified})] as const;}));
  return {manifest,files:new Map(files)};
}
export async function clearCameraDraft(owner:string,id?:string){
  const db=await database(),t=db.transaction(['drafts','photos'],'readwrite'),end=committed(t);
  const records=await read<CameraDraft[]>(t.objectStore('drafts').index('owner').getAll(owner));
  for(const d of records)if(!id||d.id===id)remove(t,d);
  await end;
}
