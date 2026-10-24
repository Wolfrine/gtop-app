export const pendingStates = new Set(['queued','running','validating']);
export function formatAssistantText(value) {
  // Escape model output before recognizing a deliberately tiny formatting grammar.
  // Never parse links, images, attributes, raw HTML, or executable Markdown.
  const escaped=String(value ?? '').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const strong=text=>text.replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>');
  const blocks=[];let paragraph=[],bullets=[];
  const flushParagraph=()=>{if(paragraph.length){blocks.push('<p>'+paragraph.map(strong).join('<br>')+'</p>');paragraph=[];}};
  const flushBullets=()=>{if(bullets.length){blocks.push('<ul>'+bullets.map(text=>'<li>'+strong(text)+'</li>').join('')+'</ul>');bullets=[];}};
  for(const line of escaped.replace(/\r\n?/g,'\n').split('\n')){
    if(!line.trim()){flushParagraph();flushBullets();continue;}
    const bullet=line.match(/^\s*[-*]\s+(.+)$/);
    if(bullet){flushParagraph();bullets.push(bullet[1]);}
    else{flushBullets();paragraph.push(line);}
  }
  flushParagraph();flushBullets();return blocks.join('');
}
export function visibleJobs(detail) {
  if(!detail)return [];
  const jobs=detail.jobs || [];
  const latestTurn=jobs.filter(job=>job.kind==='turn').sort((a,b)=>(b.createdAt || '').localeCompare(a.createdAt || '') || b.id.localeCompare(a.id))[0];
  return jobs.filter(job=>job.kind==='paper'
    ? job.id===detail.conversation?.activePaperJobId && !['completed','review_required'].includes(job.state)
    : pendingStates.has(job.state) || (job.id===latestTurn?.id && ['failed','cancelled'].includes(job.state)));
}
export function pollingDelay(jobs) { return jobs.some(j=>pendingStates.has(j.state)) ? 2000 : 15000; }
export function workerPresentation(worker) {
  if (!worker || worker.state === 'offline') return {label:'Assistant offline',detail:'You can send a request. It will wait safely until the assistant reconnects.',tone:'offline'};
  if (worker.state === 'loading' || !worker.modelReady) return {label:'Assistant getting ready',detail:'The assistant is starting. Your messages are saved while it gets ready.',tone:'waiting'};
  return {label:'Assistant available',detail:'Your private teaching workspace',tone:'online'};
}
export function phaseLabel(job, offline=false) {
  if (job.state==='queued') return offline ? 'Saved · waiting for the assistant' : 'Waiting to begin';
  if (job.state==='validating') return 'Checking the paper';
  if (job.state==='review_required') return 'Ready for your review';
  if (job.state==='completed') return 'Completed';
  if (job.state==='failed') return 'Could not complete this request';
  if (job.state==='cancelled') return 'Cancelled';
  if (job.state==='needs_info') return 'A few details are needed';
  const phases={interpreting:'Understanding your request',conversation:'Preparing a reply',local_conversation:'Preparing your reply',generating:'Writing your paper',codex_starting:'Starting your paper',codex_generating:'Writing your paper',structure_validation:'Checking structure, marks and coverage',codex_reviewing:'Reviewing questions and worked answers',codex_correcting:'Making corrections',preparing_documents:'Preparing printable documents',paper_ready_for_teacher_review:'Ready for your review',reviewing:'Reviewing questions and answers',correcting:'Making corrections',rendering:'Preparing printable documents',validating:'Checking the paper',starting:'Starting your request'};
  return phases[job.phase] || (job.kind==='paper' ? 'Working on your paper' : 'Preparing a reply');
}
export function readableError(error) {
  const text=typeof error==='string'?error:(error?.message || 'The request did not finish. You can try again.');
  if (/unauth|token|401/i.test(text)) return 'Please sign in again to continue.';
  if (/permission|forbidden|403|pilot_access/i.test(text)) return 'This private pilot is available to invited Growth Tutorials administrators.';
  if (/fetch|network|offline|timeout/i.test(text)) return 'Unable to connect. Your existing conversation is safe. Check your connection and try again.';
  return text.slice(0,400);
}
export function idForRequest(cryptoObject=globalThis.crypto) {return cryptoObject.randomUUID();}
export function artifactKind(value) {if(value!=='student' && value!=='answers')throw new Error('Invalid artifact type');return value;}
