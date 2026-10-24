import test from 'node:test';import assert from 'node:assert/strict';
import {assistantOnlyRelease,withoutWorkerDatabaseRule} from '../scripts/release-scope.mjs';
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
  assert(!assistantOnlyRelease(['assistant-service/runtime.mjs'],old,current));
  assert.deepEqual(withoutWorkerDatabaseRule(newDatabase),JSON.parse(oldDatabase));
});
