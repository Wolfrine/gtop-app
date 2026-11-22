import {createHash} from 'node:crypto';

// A short acknowledgement is not permission to create an expensive artifact.
export function proposalResponse(value){
  const t=String(value).normalize('NFKC').toLowerCase().trim().replace(/[.!।]+$/u,'').trim();
  if(/^(?:yes(?: please)?|yes[, ]+(?:go ahead|please proceed|create (?:it|the paper))|go ahead(?: please)?|please go ahead|proceed(?: please)?|confirmed|haan(?: ji)?(?:[, ]+(?:banao|bana do|kar do|aage badho))?|han ji|ji haan|हाँ(?: जी)?(?:[, ]+(?:बनाओ|बना दो|बनाइए|आगे बढ़ो))?|हां(?: जी)?|जी हाँ|जी हां|बना दो|बनाइए|आगे बढ़ो)$/u.test(t))return 'accept';
  if(/^(?:no(?: thanks)?|cancel(?: it| the paper)?|stop|not now|pause|nahi|nahin|mat banao|abhi nahi|नहीं|नही|रुको|मत बनाओ|अभी नहीं)$/u.test(t))return 'decline';
  if(/\b(?:but|instead|change|revise|replace|add|remove|exclude|make|create|generate|use|only|without|marks?|chapters?|class|board|subject|duration|minutes?|hours?|english|hindi|cbse|icse|isc|competency|case.based)\b|बदल|बनाओ|सिर्फ|केवल|अंक|अध्याय|हिंदी|अंग्रेजी/u.test(t))return 'revision';
  return 'ambiguous';
}

export function researchKey(r){
  const scope=['board','standard','subject','academicYear','programme','level','subjectCode','examYear','edition','scope','selectedChapters','marks','format'];
  const canonical=value=>typeof value==='string'?value.normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim():Array.isArray(value)?value.map(canonical).sort():value??null;
  return createHash('sha256').update(JSON.stringify(scope.map(k=>[k,canonical(r[k])]))).digest('hex');
}

export function pendingPaperTurns(job){
  const brief=job.taskBrief||job.context?.taskBrief;
  if(!brief?.creationRequestId||brief.creationPaused)return 0;
  const users=(job.history||[]).filter(m=>m.role==='user');
  const root=users.findIndex(m=>m.id===brief.creationRequestId);
  const latest=job.context?.latestPaper;
  if(latest&&users[root]?.createdAt<=latest.createdAt)return 0;
  return root<0?0:users.slice(root).length;
}

export function confirmationText(r,curriculum){
  const chapters=r.scope==='selected_chapters'?'only '+r.selectedChapters.join(', '):'the full selected syllabus';
  const style=r.questionStyle||'a balanced mix of question types';
  const format=r.format==='board'?'a practice format using the verified board section counts and marks':`a ${r.board}-aligned practice format`;
  const officialSource=['official-online-check','official-pinned-unit','official-pinned-syllabus','gtop-approved'].includes(curriculum?.provenance?.kind);
  const basis=officialSource?'Syllabus coverage is verified against the official source.':'The saved GTOP chapter list is the basis for coverage.';
  const allocation=r.markAllocation?` with the requested allocation (${r.markAllocation})`:'';
  return `I will create a ${r.marks}-mark ${r.board} Class ${r.standard} ${r.subject} paper for ${r.academicYear}, covering ${chapters}. It will use ${format} with ${r.durationMinutes} minutes, ${style}${allocation}, questions in ${r.questionLanguage}, and worked answers and marking points in ${r.answerLanguage}. ${basis} Shall I go ahead?`;
}
