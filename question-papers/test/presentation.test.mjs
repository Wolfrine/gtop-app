import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pollingDelay,phaseLabel,workerPresentation,readableError,artifactKind,visibleJobs,formatAssistantText} from '../src/presentation.mjs';
import {artifactPresentationVersion,presentArtifact} from '../src/artifact-presentation.mjs';
import {createHash} from 'node:crypto';
test('only actual pending states use active polling',()=>{assert.equal(pollingDelay([{state:'running'}]),2000);assert.equal(pollingDelay([{state:'completed'},{state:'failed'}]),15000);assert.equal(pollingDelay([]),15000);});
test('offline queue does not claim execution or completion',()=>{assert.match(phaseLabel({state:'queued'},true),/waiting/);assert.match(workerPresentation({state:'offline',modelReady:false}).detail,/wait safely/);assert.equal(workerPresentation({state:'ready',modelReady:false}).tone,'waiting');assert.equal(workerPresentation({state:'busy',modelReady:true}).tone,'online');});
test('status uses fresh facts and maps unrecognized phases safely',()=>{assert.equal(phaseLabel({state:'running',phase:'reviewing',kind:'paper'}),'Reviewing questions and answers');assert.equal(phaseLabel({state:'running',phase:'structure_validation',kind:'paper'}),'Checking structure, marks and coverage');assert.equal(phaseLabel({state:'running',phase:'codex_correcting',kind:'paper'}),'Making corrections');assert.equal(phaseLabel({state:'cancelled',phase:'reviewing'}),'Cancelled');assert.equal(phaseLabel({state:'running',phase:'secret_internal_command',kind:'paper'}),'Working on your paper');});
test('authentication failures and unknown artifacts are constrained',()=>{assert.match(readableError(new Error('403 forbidden')),/invited/);assert.match(readableError(new Error('Failed to fetch')),/connect/);assert.equal(artifactKind('student'),'student');assert.throws(()=>artifactKind('../logs'));});
test('retry chain exposes only the controller-designated current paper attempt',()=>{
  const jobs=[{id:'paper-original',kind:'paper',state:'failed',retryJobId:'paper-retry-1'},{id:'paper-retry-1',kind:'paper',state:'failed',retryJobId:'paper-retry-2'},{id:'paper-retry-2',kind:'paper',state:'failed'}];
  const detail={conversation:{activePaperJobId:'paper-retry-2'},jobs};
  assert.deepEqual(visibleJobs(detail).map(job=>job.id),['paper-retry-2']);
  assert.deepEqual(visibleJobs({...detail,conversation:{activePaperJobId:'paper-retry-3'},jobs:[...jobs,{id:'paper-retry-3',kind:'paper',state:'queued'}]}).map(job=>job.id),['paper-retry-3']);
  assert.deepEqual(visibleJobs({...detail,conversation:{activePaperJobId:'not-yet-in-snapshot'}}),[]);
});
test('completed papers use result cards while conversation can continue independently',()=>{
  const detail={conversation:{activePaperJobId:'ready'},jobs:[{id:'ready',kind:'paper',state:'completed'},{id:'old-turn',kind:'turn',state:'failed',createdAt:'2026-10-24T10:00:00Z'},{id:'new-turn',kind:'turn',state:'running',createdAt:'2026-10-24T10:01:00Z'}]};
  assert.deepEqual(visibleJobs(detail).map(job=>job.id),['new-turn']);
  assert.deepEqual(visibleJobs({...detail,jobs:[{id:'ready',kind:'paper',state:'review_required'}]}),[]);
});
test('assistant formatting supports paragraphs, line breaks, strong text and simple bullet lists',()=>{
  assert.equal(formatAssistantText('**Paper details**\n80 marks\n\n* Chemistry\n- **Worked answers**\n\nहिन्दी में भी समझा सकते हैं।'),'<p><strong>Paper details</strong><br>80 marks</p><ul><li>Chemistry</li><li><strong>Worked answers</strong></li></ul><p>हिन्दी में भी समझा सकते हैं।</p>');
  assert.equal(formatAssistantText('V = I × R\r\n-1 is a number\n**unfinished'),'<p>V = I × R<br>-1 is a number<br>**unfinished</p>');
});
test('hostile assistant markup remains inert text and cannot create links, scripts or attributes',()=>{
  const hostile='**<img src=x onerror="alert(1)">**\n\n* <script>alert(2)</script>\n- [open](javascript:alert(3))\n- <a href="https://example.invalid">link</a>\n- &#60;svg onload=alert(4)&#62;';
  const formatted=formatAssistantText(hostile);
  assert.match(formatted,/&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(formatted,/&lt;script&gt;alert\(2\)&lt;\/script&gt;/);
  assert.match(formatted,/\[open\]\(javascript:alert\(3\)\)/);
  assert.match(formatted,/&amp;#60;svg/);
  assert(!/<(?:img|script|svg|a)(?:\s|>)/i.test(formatted));
  assert((formatted.match(/<[^>]+>/g)||[]).every(tag=>/^<\/?(?:p|strong|ul|li)>$|^<br>$/.test(tag)));
});
test('versioned formula presentation derives a view without changing immutable HTML or print content',()=>{
  const original='<!doctype html><html><head><style>.katex{font-size:1em}</style></head><body><p>Original question</p><span class="katex">long chemical equation</span></body></html>';
  const hash=createHash('sha256').update(original).digest('hex');
  const view=presentArtifact(original);
  assert.equal(artifactPresentationVersion,1);
  assert.equal(createHash('sha256').update(original).digest('hex'),hash);
  assert.match(view,/data-presentation-version="1"/);
  assert(view.indexOf('gtop-artifact-presentation')<view.indexOf('</head>'));
  assert.match(view,/@media screen[\s\S]*overflow-x:auto/);
  assert.match(view,/padding-inline-end:\.35em/);
  assert.match(view,/@media print[\s\S]*display:inline; max-width:none; padding-inline-end:0; overflow:visible/);
  assert.match(view,/<body><p>Original question<\/p><span class="katex">long chemical equation<\/span><\/body>/);
  assert(!/<script/i.test(view));
});
