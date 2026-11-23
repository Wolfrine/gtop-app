import {createHash} from 'node:crypto';

// Public facets are derived only from non-native-private papers. Each owner also
// receives own facets so private records never influence another owner's menu.
const hash=s=>createHash('sha256').update(s,'utf8').digest('hex').slice(0,32);
const scope=(visibility,uid,path)=>['paperCatalogueFacetScopes',hash([visibility,uid||'',path].join('\n')),'options'].join('/');
const valid=s=>typeof s==='string'&&s.length<=160&&/^[\p{L}\p{N}-]+$/u.test(s);
export function paperFacetOptionsPath(path,{ownerUid='',visibility='shared'}={}){
  if(!['shared','owner'].includes(visibility)||visibility==='owner'&&!/^[A-Za-z0-9_-]{1,128}$/.test(ownerUid))
    throw Error('Invalid paper facet scope.');
  if(typeof path!=='string'||path.length>500||!['root'].includes(path)&&
    !/^b:[\p{L}\p{N}-]+(?:\|c:[\p{L}\p{N}-]+(?:\|s:[\p{L}\p{N}-]+)?)?$/u.test(path))
    throw Error('Invalid curriculum path.');
  return scope(visibility,visibility==='owner'?ownerUid:'',path);
}
export function paperCatalogueFacetEntries(record){
  const b=record.board?.key,c=record.standard?.key,s=record.subject?.key;
  if(!valid(b)||!valid(c)||!valid(s))return [];
  const family=[
    {path:'root',kind:'board',key:b,label:record.board.raw||record.board.label||b},
    {path:'b:'+b,kind:'standard',key:c,label:'Class '+(record.standard.raw||c)},
    {path:'b:'+b+'|c:'+c,kind:'subject',key:s,label:record.subject.raw||record.subject.label||s}
  ];
  for(const chapter of record.chapterBreakdown||[])if(valid(chapter.key))
    family.push({path:'b:'+b+'|c:'+c+'|s:'+s,kind:'chapter',key:chapter.key,label:chapter.title||chapter.key});
  const unique=new Map();
  for(const value of family){
    for(const visibility of ['owner',...(record.nativePrivate?[]:['shared'])]){
      const folder=paperFacetOptionsPath(value.path,{visibility,ownerUid:record.ownerUid});
      const id=hash([value.kind,value.key].join(':'));
      unique.set(folder+'/'+id,{kind:value.kind,key:value.key,label:String(value.label).slice(0,170),path:value.path,schemaVersion:1});
    }
  }
  return [...unique.entries()].map(([path,fields])=>({path,fields}));
}
export function writePaperCatalogueFacets(tx,record){
  for(const {path,fields} of paperCatalogueFacetEntries(record))tx.set(path,fields);
}
export function paperFacetScopeFromFilters(filters={}){
  const b=filters.boardKey,c=filters.standardKey,s=filters.subjectKey;
  if(s)return {path:'b:'+b+'|c:'+c+'|s:'+s,level:'chapter'};
  if(c)return {path:'b:'+b+'|c:'+c,level:'subject'};
  if(b)return {path:'b:'+b,level:'standard'};
  return {path:'root',level:'board'};
}
