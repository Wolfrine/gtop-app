import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

// Independent saved-byte check; no model, gateway, browser or production writes.
const root=process.argv[2],output=process.argv[3];
assert(root&&/^F:[\\/]/i.test(root),'Use the explicit F-drive acceptance directory');
const summary=JSON.parse(await readFile(root+'/summary.json','utf8'));
assert.equal(summary.evidenceKind,'actual-inference-synthetic-in-memory-application');
assert.equal(summary.productionWrites,false);assert.equal(summary.productionQueueClaims,false);
assert.equal(summary.validation.passed,true);assert.equal(summary.validation.attemptedMarks,10);
const artifacts={};
for(const kind of ['student','answers']){
  const bytes=await readFile(root+'/'+kind+'.html');
  const sha256=createHash('sha256').update(bytes).digest('hex');
  assert.equal(sha256,summary.artifacts[kind].sha256);
  assert.equal(bytes.length,summary.artifacts[kind].bytes);
  const html=bytes.toString('utf8'),questions=(html.match(/<article class="question">/g)||[]).length;
  assert.equal(questions,2);assert(html.includes('Maximum marks: 10'));assert(html.includes('15 minutes'));
  artifacts[kind]={bytes:bytes.length,sha256,questions,marks:10,durationMinutes:15};
}
assert.notEqual(artifacts.student.sha256,artifacts.answers.sha256);
const report={checkedAt:new Date().toISOString(),independentFileCheck:true,artifacts};
if(output){assert(/^F:[\\/]/i.test(output));await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});}
console.log(JSON.stringify(report,null,2));
