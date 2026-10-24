import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assistantOnlyRelease,withoutWorkerDatabaseRule,parseRulesJson,equivalentDatabaseRules} from '../scripts/release-scope.mjs';
const oldFirestore="function signedIn(){return request.auth != null;}";
const newFirestore="function signedIn(){return request.auth != null\n && request.auth.token.get('assistantWorker', false) != true;}";
const oldDatabase=JSON.stringify({rules:{activeUsers:{'.read':'auth != null',$uid:{'.write':'auth != null','.validate':'existing validation'}}}});
const newDatabase=oldDatabase.replaceAll('auth != null','auth != null && auth.token.assistantWorker !== true');
const old=p=>p.endsWith('firestore.rules')?oldFirestore:oldDatabase,current=p=>p.endsWith('firestore.rules')?newFirestore:newDatabase;
test('assistant-only exact security prerequisite avoids core promotion while arbitrary application/rule changes do not',()=>{
  const files=['gtop-app/firestore.rules','gtop-app/database.rules.json','assistant-service/runtime.mjs','question-papers/src/main.ts','.github/workflows/firebase-deploy.yml'];
  assert(assistantOnlyRelease(files,old,current));
  assert(!assistantOnlyRelease([...files,'gtop-app/src/app/app.component.ts'],old,current));
  assert(!assistantOnlyRelease(files,old,path=>current(path).replace('existing validation','broadened validation')));
  assert(!assistantOnlyRelease(files,old,path=>current(path)+'unexpected-rule-change'));
  assert(assistantOnlyRelease(['assistant-service/runtime.mjs'],old,current));
  assert(assistantOnlyRelease(['.github/workflows/firebase-deploy.yml','assistant-service/scripts/release-scope.mjs'],old,current));
  assert(!assistantOnlyRelease(['gtop-app/functions/hosting-readiness.test.mjs'],old,current));
  assert.deepEqual(withoutWorkerDatabaseRule(newDatabase),JSON.parse(oldDatabase));
});
test('live commented RTDB rule JSON parses without altering strings or accepting malformed source',()=>{
  assert.deepEqual(parseRulesJson('{\n// live comment\n"rules": {/* block */".read":"auth != null", "url":"https://example.test/a//b", "quote":"\\\"/*literal*/"}}'),{rules:{'.read':'auth != null',url:'https://example.test/a//b',quote:'"/*literal*/'}});
  assert.throws(()=>parseRulesJson('{/* unterminated'));assert.throws(()=>parseRulesJson('{"rules": nope}'));
});
test('rule expression formatting is equivalent while quoted values and human permission changes remain distinct',()=>{
  assert(equivalentDatabaseRules({rules:{'.read':"auth != null && auth.uid == 'a b'"}},{rules:{'.read':"auth!=null&&auth.uid=='a b'"}}));
  assert(!equivalentDatabaseRules({rules:{'.read':"auth.uid=='a b'"}},{rules:{'.read':"auth.uid=='ab'"}}));
  assert(!equivalentDatabaseRules({rules:{'.read':'auth != null'}},{rules:{'.read':'true'}}));
});
test('pilot presence rules preserve the inspected collection-level human baseline exactly',()=>{
  const config=JSON.parse(readFileSync(new URL('../../firebase.assistant.json',import.meta.url),'utf8'));
  assert.equal(config.database.rules,'assistant-service/security/worker-database.rules.json');
  const source=readFileSync(new URL('../security/worker-database.rules.json',import.meta.url),'utf8');
  assert.deepEqual(withoutWorkerDatabaseRule(source),{rules:{activeUsers:{'.read':'auth != null','.write':'auth != null'}}});
  const current=JSON.parse(source);assert(current.rules.activeUsers['.read'].includes('assistantWorker !== true'));assert(current.rules.activeUsers['.write'].includes('assistantWorker !== true'));
});
