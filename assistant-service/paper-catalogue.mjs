import {createHash} from 'node:crypto';
import {writePaperCatalogueFacets} from './paper-library-facets.mjs';

// A derived, private, versioned view; never a replacement for assistantPapers.
export const catalogueSchemaVersion=1;
export const catalogueMigrationPath='assistantCatalogueMigrations/generatedV1';
const boardNames=new Set(['CBSE','ICSE','ISC','Maharashtra State Board','Cambridge IGCSE','Cambridge','IB']);
const idPattern=/^[A-Za-z0-9_-]{1,128}$/;
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const safeText=(value,max=200)=>typeof value==='string'?value.trim().slice(0,max):'';
export const catalogueKey=value=>safeText(String(value??''),160).normalize('NFKC').toLocaleLowerCase('en-IN')
  .replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-+|-+$/g,'').slice(0,100);
const terms=value=>[...new Set(safeText(value,800).normalize('NFKC').toLocaleLowerCase('en-IN')
  .split(/[^\p{L}\p{N}]+/u).map(x=>x.trim()).filter(x=>x.length>=2&&x.length<=40))];
const compareLatest=(a,b)=>a.createdAt===b.createdAt?a.paperId.localeCompare(b.paperId):a.createdAt.localeCompare(b.createdAt);

function paths(record){
  const b=record.board.key,c=record.standard.key,s=record.subject.key;
  const result=['root'];
  if(b&&c&&s){
    result.push('b:'+b,'b:'+b+'|c:'+c,'b:'+b+'|c:'+c+'|s:'+s);
    for(const chapter of record.chapterKeys)result.push('b:'+b+'|c:'+c+'|s:'+s+'|ch:'+chapter);
  }else if(b)result.push('b:'+b);
  return [...new Set(result)];
}
function lookupKeys(record,latest){
  const base=paths(record);
  const variants=['all',...(latest?['latest']:[])];
  const keys=new Set();
  const words=record.searchTokens.slice(0,20);
  for(const variant of variants){
    for(const path of base){
      keys.add(variant+'|'+path);
      // Structured, indexed exact-year and paper-format narrowing.
      if(record.academicYear)keys.add(variant+'|'+path+'|y:'+record.academicYear);
      if(record.format)keys.add(variant+'|'+path+'|f:'+record.format);
      if(record.academicYear&&record.format)keys.add(variant+'|'+path+'|y:'+record.academicYear+'|f:'+record.format);
    }
    // Title/subject/chapter token search needs one array index, not a scan.
    // Chapter + free-text refinement is supported as a bounded server scan.
    for(const path of base.slice(0,4))for(const word of words)keys.add(variant+'|'+path+'|w:'+word);
  }
  return [...keys];
}
export function paperCatalogueProjection(paper,{familyId=paper.id,issues=[],latest=true,now=new Date().toISOString()}={}){
  if(!paper||!idPattern.test(paper.id||'')||!idPattern.test(paper.ownerUid||''))throw Error('Invalid paper identity for derived catalogue.');
  const boardRaw=safeText(paper.board),standardRaw=safeText(paper.standard),subjectRaw=safeText(paper.subject);
  const board={raw:boardRaw,label:boardRaw,key:catalogueKey(boardRaw)};
  const standard={raw:standardRaw,label:standardRaw,key:catalogueKey(standardRaw.replace(/^class\s+/i,''))};
  const subject={raw:subjectRaw,label:subjectRaw,key:catalogueKey(subjectRaw)};
  const warnings=[...issues];
  if(!boardNames.has(boardRaw))warnings.push('unrecognized_board');
  if(!/^(?:[5-9]|1[0-2])$/.test(standard.key))warnings.push('unrecognized_class');
  if(!subject.key)warnings.push('missing_subject');
  const nativeDelivery=paper.nativePrivate===true&&paper.deliveryValidation?.schemaVersion===1;
  if(!nativeDelivery){
    if(!paper.curriculumSnapshot)warnings.push('curriculum_snapshot_missing');
    if(paper.validation?.passed!==true)warnings.push('validation_unconfirmed');
  }
  const questions=(Array.isArray(paper.sections)?paper.sections:[]).flatMap(section=>Array.isArray(section.questions)?section.questions:[]);
  const byChapter=new Map(),questionTypes={};
  for(const question of questions){
    const type=safeText(question.type,50)||'unknown';
    questionTypes[type]=(questionTypes[type]||0)+1;
    const raw=safeText(question.chapter);
    if(!raw){warnings.push('question_chapter_missing');continue;}
    const key=catalogueKey(raw);
    if(!key){warnings.push('question_chapter_invalid');continue;}
    let entry=byChapter.get(key);
    if(!entry){entry={key,title:raw,questionCount:0,questionNumbers:[]};byChapter.set(key,entry);}
    entry.questionCount++;
    if(Number.isInteger(question.number))entry.questionNumbers.push(question.number);
  }
  const validated=Array.isArray(paper.validation?.chaptersCovered)?paper.validation.chaptersCovered:[];
  if(!nativeDelivery&&(!validated.length||byChapter.size!==new Set(validated.map(catalogueKey)).size||
    [...byChapter.keys()].some(k=>!validated.some(v=>catalogueKey(v)===k))))warnings.push('chapter_coverage_mismatch');
  // Bound native facet writes independently of the complete printable paper.
  // Only the derived browse index is clipped.
  if(nativeDelivery&&byChapter.size>100)warnings.push('chapter_index_limit');
  const chapterBreakdown=nativeDelivery?[...byChapter.values()].slice(0,100):[...byChapter.values()];
  const chapterKeys=chapterBreakdown.map(c=>c.key);
  const format=['practice','board'].includes(paper.requirements?.format)?paper.requirements.format:undefined;
  const academicYear=safeText(paper.academicYear,16);
  const searchTokens=[...new Set([
    ...terms(paper.title),...terms(boardRaw),...terms('Class '+standardRaw),
    ...terms(subjectRaw),...chapterBreakdown.flatMap(x=>terms(x.title))
  ])].slice(0,20);
  const sourceFingerprint=digest([
    paper.id,paper.ownerUid,paper.conversationId,paper.parentPaperId||null,paper.revision,
    paper.createdAt,paper.board,paper.standard,paper.subject,paper.academicYear,
    paper.marks,paper.deliveryValidation?.paperContentSha256||paper.validation?.paperContentSha256||null,
    paper.validation?.chaptersCovered||null,
    questions.map(q=>[q.number,q.chapter,q.type,q.marks])
  ]);
  const result={
    paperId:paper.id,sourceKind:'generated',ownerUid:paper.ownerUid,
    nativePrivate:paper.nativePrivate===true,
    sourceConversationId:safeText(paper.conversationId,128),
    familyId,parentPaperId:paper.parentPaperId||null,revision:paper.revision||1,
    title:safeText(paper.title),board,standard,subject,academicYear,
    curriculumVersionId:safeText(paper.curriculumSnapshot?.provenance?.versionId,128)||null,
    chapterKeys,chapterBreakdown,questionCount:questions.length,
    questionTypeCounts:questionTypes,marks:Number(paper.marks)||0,
    format:format||null,createdAt:paper.createdAt,
    classificationStatus:warnings.length?'needs_review':'verified_structure',
    classificationIssues:[...new Set(warnings)].slice(0,15),
    sourceFingerprint,indexSchemaVersion:catalogueSchemaVersion,
    searchTokens,isFamilyLatest:latest,indexedAt:now
  };
  result.lookupKeys=lookupKeys(result,latest);
  return result;
}
export function notLatest(record){
  return {...record,isFamilyLatest:false,lookupKeys:(record.lookupKeys||[]).filter(key=>!key.startsWith('latest|'))};
}

// Works with the existing Firestore transaction adapter and MemoryStore.
// Read the complete, bounded ancestry before any writes; never alter source papers.
export async function stagePaperCatalogue(tx,paper,now=new Date().toISOString()){
  if(!paper)return null;
  const issues=[];
  let familyId=paper.id,parentId=paper.parentPaperId,steps=0;
  const seen=new Set([paper.id]);
  while(parentId){
    if(!idPattern.test(parentId)||seen.has(parentId)||++steps>24){issues.push('invalid_revision_ancestry');break;}
    seen.add(parentId);
    const parent=await tx.get('assistantPapers/'+parentId);
    if(!parent||parent.ownerUid!==paper.ownerUid||parent.conversationId!==paper.conversationId){
      issues.push('missing_or_cross_owner_parent');familyId=parentId;break;
    }
    if(parent.board!==paper.board||String(parent.standard)!==String(paper.standard)||parent.subject!==paper.subject)
      issues.push('revision_scope_mismatch');
    familyId=parent.id;
    parentId=parent.parentPaperId;
  }
  const familyPath='paperCatalogueFamilies/'+familyId,entryPath='paperCatalogue/'+paper.id;
  const [family,existing]=await Promise.all([tx.get(familyPath),tx.get(entryPath)]);
  let oldLatest=null;
  if(family?.latestPaperId&&family.latestPaperId!==paper.id)oldLatest=await tx.get('paperCatalogue/'+family.latestPaperId);
  const candidate={paperId:paper.id,createdAt:paper.createdAt};
  const old={paperId:family?.latestPaperId||'',createdAt:family?.latestCreatedAt||''};
  const latest=!family||family.latestPaperId===paper.id||compareLatest(candidate,old)>0;
  const entry=paperCatalogueProjection(paper,{familyId,issues,latest,now});
  const unchanged=existing?.sourceFingerprint===entry.sourceFingerprint&&
    existing?.familyId===entry.familyId&&existing?.isFamilyLatest===entry.isFamilyLatest&&
    existing?.indexSchemaVersion===catalogueSchemaVersion;
  if(!unchanged)tx.set(entryPath,entry);
  writePaperCatalogueFacets(tx,entry);
  if(latest&&family?.latestPaperId&&family.latestPaperId!==paper.id&&oldLatest)
    tx.set('paperCatalogue/'+family.latestPaperId,notLatest(oldLatest));
  if(latest&&(family?.latestPaperId!==paper.id||family?.latestCreatedAt!==paper.createdAt))
    tx.set(familyPath,{familyId,latestPaperId:paper.id,latestCreatedAt:paper.createdAt,updatedAt:now});
  return {paperId:paper.id,familyId,updated:!unchanged,classificationStatus:entry.classificationStatus};
}

export function normaliseCatalogueSearch(body={}){
  if(!body||typeof body!=='object'||Array.isArray(body)||body.kind!=='papers')throw Error('Choose papers for catalogue search.');
  const filters=body.filters??{};
  if(!filters||typeof filters!=='object'||Array.isArray(filters))throw Error('Invalid curriculum filters.');
  const allowed=new Set(['boardKey','standardKey','subjectKey','chapterKey','academicYear','format','ownerScope']);
  if(Object.keys(filters).some(k=>!allowed.has(k)))throw Error('Unsupported curriculum filter.');
  const key=k=>filters[k]==null||filters[k]===''?'':catalogueKey(filters[k]);
  const boardKey=key('boardKey'),standardKey=key('standardKey'),subjectKey=key('subjectKey'),chapterKey=key('chapterKey');
  if((standardKey&&!boardKey)||(subjectKey&&!standardKey)||(chapterKey&&!subjectKey))
    throw Error('Browse in board, class, subject, then chapter order.');
  const academicYear=safeText(filters.academicYear,16),format=safeText(filters.format,20);
  if(academicYear&&!/^20\d{2}-\d{2}$/.test(academicYear))throw Error('Invalid academic year.');
  if(format&&!['practice','board'].includes(format))throw Error('Invalid paper format.');
  const ownerScope=filters.ownerScope||'accessible';
  if(!['accessible','mine'].includes(ownerScope))throw Error('Invalid owner scope.');
  const query=safeText(body.query,160),words=terms(query);
  if(query&&words.length===0)throw Error('Search needs letters or numbers.');
  const latestRevisionOnly=body.latestRevisionOnly!==false;
  const pageSize=body.pageSize===undefined?24:body.pageSize;
  if(!Number.isInteger(pageSize)||pageSize<1||pageSize>50)throw Error('Page size must be 1–50.');
  if(body.sort&&body.sort!=='recent')throw Error('Only recent-first ordering is available in this phase.');
  const parts=['root'];
  if(boardKey)parts.push('b:'+boardKey);
  if(standardKey)parts.push('b:'+boardKey+'|c:'+standardKey);
  if(subjectKey)parts.push('b:'+boardKey+'|c:'+standardKey+'|s:'+subjectKey);
  if(chapterKey)parts.push('b:'+boardKey+'|c:'+standardKey+'|s:'+subjectKey+'|ch:'+chapterKey);
  const path=parts.at(-1),prefix=latestRevisionOnly?'latest|':'all|';
  let lookupKey=prefix+path;
  if(academicYear)lookupKey+='|y:'+academicYear;
  if(format)lookupKey+='|f:'+format;
  // The first token is indexed for any curriculum level through subject;
  // when a chapter/year/format is selected, scan only that bounded slice.
  const indexWord=words.length&&path.indexOf('|ch:')===-1&&!academicYear&&!format?words[0]:null;
  if(indexWord)lookupKey+='|w:'+indexWord;
  const signature=digest({boardKey,standardKey,subjectKey,chapterKey,academicYear,format,ownerScope,query:words,latestRevisionOnly,pageSize});
  return {filters:{boardKey,standardKey,subjectKey,chapterKey,academicYear,format,ownerScope},
    words,query,lookupKey,signature,pageSize,latestRevisionOnly,sort:'recent'};
}
export function decodeCatalogueCursor(cursor,signature){
  if(cursor===undefined||cursor===null||cursor==='')return null;
  if(typeof cursor!=='string'||cursor.length>700||!cursor.startsWith('v1.'))throw Error('Invalid catalogue cursor.');
  let payload;
  try{payload=JSON.parse(Buffer.from(cursor.slice(3),'base64url').toString('utf8'));}
  catch{throw Error('Invalid catalogue cursor.');}
  if(!Array.isArray(payload)||payload.length!==3||payload[0]!==signature||
    typeof payload[1]!=='string'||!Number.isFinite(Date.parse(payload[1]))||
    !idPattern.test(payload[2]))throw Error('This page belongs to a different search. Start again.');
  return {createdAt:payload[1],paperId:payload[2]};
}
export function encodeCatalogueCursor(row,signature){
  return 'v1.'+Buffer.from(JSON.stringify([signature,row.createdAt,row.paperId])).toString('base64url');
}
export function publicCatalogueItem(record){
  return Object.fromEntries([
    'paperId','title','board','standard','subject','academicYear','chapterKeys',
    'chapterBreakdown','questionCount','questionTypeCounts','marks','format',
    'revision','familyId','parentPaperId','sourceConversationId','createdAt',
    'classificationStatus','classificationIssues','isFamilyLatest','ownerUid'
  ].filter(k=>record[k]!==undefined).map(k=>[k,record[k]]));
}
