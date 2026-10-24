import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pollingDelay,phaseLabel,workerPresentation,readableError,artifactKind,visibleJobs,formatAssistantText} from '../src/presentation.mjs';
import {artifactPresentationVersion,presentArtifact} from '../src/artifact-presentation.mjs';
import {createHash} from 'node:crypto';
import {escapeChatText,renderAssistantFormula} from '../src/chat-math.mjs';
import {readFileSync} from 'node:fs';
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
  assert.equal(artifactPresentationVersion,3);
  assert.equal(createHash('sha256').update(original).digest('hex'),hash);
  assert.match(view,/data-presentation-version="3"/);
  assert(view.indexOf('gtop-artifact-presentation')<view.indexOf('</head>'));
  assert.match(view,/@media screen[\s\S]*overflow-x:auto/);
  assert.match(view,/padding-inline-end:\.35em/);
  assert.match(view,/@media print[\s\S]*display:inline; max-width:none; padding-inline-end:0; overflow:visible/);
  assert.match(view,/<body><p>Original question<\/p><span class="katex">long chemical equation<\/span><\/body>/);
  assert(!/<script/i.test(view));
});

test('exam view removes actual schema directions and uses the controller revision without editing questions or stored content',()=>{
  const original='<html><head></head><body><h1>Chemistry, Version 1</h1><ol class="instructions"><li>Attempt all 38 questions.</li><li>Separate answers use markingPoints and answer fields.</li><li>This corrected version addresses the independent content review.</li></ol><article class="question">Which fields change? $x^2$</article></body></html>';
  const before=createHash('sha256').update(original).digest('hex');const view=presentArtifact(original,2);
  assert.match(view,/<h1>Chemistry<\/h1>/);
  assert.match(view,/<ol class="instructions"><li>Attempt all 38 questions.<\/li><\/ol>/);
  assert.match(view,/<article class="question">Which fields change\? \$x\^2\$<\/article>/);
  assert.equal(createHash('sha256').update(original).digest('hex'),before);
});
test('existing paper copies remove admin caveats and preserve student rules, questions and answers',()=>{
  const original='<html><head></head><body><h1>Science — Custom Practice Paper, Version 2</h1><p class="notice">GTOP saved syllabus; not official; teacher review.</p><ol class="instructions"><li>Attempt all questions. This paper follows GTOP syllabus.</li><li>Draw labelled diagrams.</li><li>Not an official board paper.</li></ol><p class="section-note">Answer either alternative. Teacher review required.</p><article class="question">Explain the official language policy.</article><div class="answer">Retained worked answer.</div><p class="source">Curriculum source: https://example.invalid</p></body></html>';
  const before=createHash('sha256').update(original).digest('hex'),view=presentArtifact(original,1);
  assert.match(view,/<h1>Science Practice Paper<\/h1>/);assert(!/GTOP saved|GTOP syllabus|not official|Not an official|Teacher review|Curriculum source|Version 2|Document revision/.test(view));assert.match(view,/Attempt all questions\./);assert.match(view,/Draw labelled diagrams/);assert.match(view,/Answer either alternative\./);assert.match(view,/Explain the official language policy/);assert.match(view,/Retained worked answer/);assert.equal(createHash('sha256').update(original).digest('hex'),before);
});
test('mixed Markdown/math preserves TeX sources then renders bounded KaTeX with local chemistry support',()=>{
  const raw=String.raw`**Half-life**\n* At $30.0\,\mathrm{min}$, use \(k=\frac{0.693}{t_{1/2}}\).`.replaceAll('\\n','\n');
  const formatted=formatAssistantText(raw);
  assert.match(formatted,/<strong>Half-life<\/strong>/);
  assert.equal((formatted.match(/class="assistant-math-source"/g)||[]).length,2);
  const rendered=renderAssistantFormula(String.raw`$30.0\,\mathrm{min}$`);
  assert.equal(rendered.valid,true);assert.match(rendered.html,/class="katex"/);assert.match(rendered.html,/<math/);
  assert.equal(renderAssistantFormula(String.raw`$\ce{CH3COCH3}$`).valid,true);
  assert.equal(renderAssistantFormula(String.raw`$$x^2+y^2=z^2$$`).display,true);
  assert.equal(formatAssistantText(String.raw`Literal \$80 and unfinished $x`),'<p>Literal \\$80 and unfinished $x</p>');
});
test('hostile TeX commands, expansion loops and malformed formulas fall back to escaped literal text',()=>{
  for(const raw of [String.raw`$\href{javascript:alert(1)}{bad}$`,String.raw`$\includegraphics{https://example.invalid/x}$`,String.raw`$\htmlStyle{background:url(x)}{y}$`,String.raw`$\def\boom{\boom}\boom$`,String.raw`$\frac{1}{$`]){
    const rendered=renderAssistantFormula(raw);assert.equal(rendered.valid,false);assert.equal(rendered.html,escapeChatText(raw));
  }
  const withLiteralMarkup=renderAssistantFormula(String.raw`$\text{<script>alert(1)</script>}$`);
  assert(!/<(?:script|img|a)(?:\s|>)/i.test(withLiteralMarkup.html));
  const mixed=formatAssistantText('**Safe** $x^2$ <img src=x onerror="alert(1)"> [bad](javascript:alert(2))');
  assert.match(mixed,/&lt;img src=x/);assert(!/<(?:script|img|a)(?:\s|>)/i.test(mixed));
});
test('captured actual local Q6 reply renders every delimited formula without another inference run',()=>{
  const fixture=JSON.parse(readFileSync(new URL('../src/fixtures/actual-local-q6-reply.json',import.meta.url),'utf8'));
  assert.equal(fixture.messageId,'6c62f1a9-55b9-44df-91b8-5228e9914160');
  const sources=[...formatAssistantText(fixture.text).matchAll(/<span class="assistant-math-source">([\s\S]*?)<\/span>/g)].map(match=>match[1].replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&quot;','"').replaceAll('&#39;',"'"));
  assert(sources.length>=15);
  assert(sources.every(source=>renderAssistantFormula(source).valid));
  assert.match(fixture.text,/30\.0\\,\\mathrm\{min\}/);
});

test('curriculum checks have separate progress and retry visibility alongside a paper',()=>{const detail={conversation:{activePaperJobId:'p',activeCurriculumJobId:'c'},jobs:[{id:'p',kind:'paper',state:'running',phase:'codex_generating'},{id:'c',kind:'curriculum',state:'validating',phase:'reviewing_curriculum'},{id:'old',kind:'curriculum',state:'failed'}]};assert.equal(visibleJobs(detail).length,2);assert.equal(phaseLabel(detail.jobs[1]),'Reviewing curriculum sources');});
