const paperScopeKeys=['board','standard','subject','academicYear','scope','marks','durationMinutes','questionLanguage','answerLanguage'];
export class NativePaperError extends Error {}

export function workerPaper(domain,paper,conversation){
  if(paper?.ownerUid!==conversation.ownerUid||paper.conversationId!==conversation.id)return null;
  const content=domain.paperContent(paper);
  const delivery=paper.nativePrivate===true&&paper.deliveryValidation;
  if(delivery){
    if(delivery.schemaVersion!==1||delivery.paperContentSha256!==domain.hash(content))return null;
  }else if(paper.validation?.passed!==true||
    (paper.validation.paperContentSha256&&paper.validation.paperContentSha256!==domain.hash(content)))return null;
  const {id,revision,requirements,curriculumSnapshot}=paper;
  return {id,revision,...content,requirements,curriculumSnapshot};
}

export function nativePaper(domain,candidate,submitted){
  const paper=domain.paperContent(candidate);
  try{domain.assertSchema(paper,domain.paperSchema);}
  catch(error){throw new NativePaperError(error.message);}
  if(!paper.title.trim()||!paper.sections.some(section=>section.questions.length))throw new NativePaperError('The printable paper needs a title and at least one question.');
  if(submitted!==undefined&&(!submitted||typeof submitted!=='object'||Array.isArray(submitted)))throw new NativePaperError('Paper requirements must be an object.');
  if(Buffer.byteLength(JSON.stringify(paper.sourceReferences))>16000)throw new NativePaperError('Source references exceed the delivery size limit.');

  // Index and render the same author-supplied metadata. Sources are citations
  // from Codex. They are stored as data and never fetched by publication.
  const declared=Object.fromEntries(paperScopeKeys.map(key=>[key,paper[key]]));
  const requirements={...submitted,...declared};
  return {paper,requirements,deliveryValidation:{schemaVersion:1,paperContentSha256:domain.hash(paper)}};
}
