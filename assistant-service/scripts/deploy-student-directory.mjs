import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {FirestoreStore} from '../store.mjs';
import {backfillStudentDirectory} from '../student-directory-backfill.mjs';

const project = 'gtop-app';
const name = 'gtopAssistantIndexStudent';
const account = '78765581239-compute@developer.gserviceaccount.com';
const release = process.env.GITHUB_SHA;
if (process.env.GITHUB_REF !== 'refs/heads/main' || !/^[a-f0-9]{40}$/.test(release || '')) {
  throw Error('Student directory deployment requires a verified main commit.');
}
const target = ['--project=' + project, '--no-gen2', '--region=us-central1'];
const resource = 'projects/' + project + '/databases/(default)/documents/users/{uid}';
const eventType = 'providers/cloud.firestore/eventTypes/document.write';
execFileSync('gcloud', [
  'functions', 'deploy', name, ...target, '--runtime=nodejs22', '--source=assistant-service',
  '--entry-point=' + name, '--service-account=' + account,
  '--build-service-account=projects/' + project + '/serviceAccounts/' + account,
  '--memory=256Mi', '--timeout=60s', '--max-instances=2', '--trigger-event=' + eventType,
  '--trigger-resource=' + resource, '--retry',
  '--update-labels=firebase-functions-codebase=gtop-assistant,gtop-release=' + release, '--quiet'
], {stdio: 'inherit'});
const deployed = JSON.parse(execFileSync('gcloud', ['functions', 'describe', name, ...target, '--format=json'], {encoding: 'utf8'}));
assert.equal(deployed.status, 'ACTIVE');
assert.equal(deployed.entryPoint, name);
assert.equal(deployed.runtime, 'nodejs22');
assert.equal(deployed.serviceAccountEmail, account);
assert.equal(deployed.labels?.['gtop-release'], release);
assert.equal(deployed.eventTrigger?.resource, resource);
assert.equal(deployed.eventTrigger?.eventType, eventType);
assert(deployed.eventTrigger?.failurePolicy?.retry);

initializeApp({projectId: project});
await backfillStudentDirectory(new FirestoreStore(getFirestore()));
console.log('Verified the student profile trigger and completed the student directory backfill.');
