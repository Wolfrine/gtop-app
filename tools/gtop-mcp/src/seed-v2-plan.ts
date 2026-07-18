import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const projectId = process.env['GTOP_FIREBASE_PROJECT_ID'] || process.env['GOOGLE_CLOUD_PROJECT'] || 'gtop-app';
const sourceReference = process.env['GITHUB_SHA'] || process.env['GTOP_MCP_TASK_REF'] || 'feature/gtop-v2';
const app = getApps()[0] ?? initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore(app);
const actor = { name: 'GTOP v2 release workflow', kind: 'system' };

const workstreams = [
  {
    key: 'foundation', title: 'V2 foundation and design system', area: 'Platform foundation', status: 'review',
    description: 'Angular 21 foundation, readiness-based authentication, repositories, responsive shells, and premium academic design system.',
  },
  {
    key: 'learner', title: 'V2 learner practice loop', area: 'Learner experience', status: 'review',
    description: 'Profile setup, practice selection, quiz, summary, reporting, retry, and question feedback.',
  },
  {
    key: 'admin', title: 'V2 administration workspace', area: 'Admin operations', status: 'review',
    description: 'Question, syllabus, user, report, live-session, log, and action-plan administration.',
  },
  {
    key: 'live', title: 'V2 live practice', area: 'Live practice', status: 'review',
    description: 'Live quiz and quiz-run creation, lobby, participation, host control, and summary experiences.',
  },
  {
    key: 'mcp', title: 'Firestore MCP and agent workflow', area: 'Agent operations', status: 'review',
    description: 'Audited action-plan and bounded full-Firestore tools with concurrency and destructive-operation safeguards.',
  },
  {
    key: 'release', title: 'V2 UAT validation and release', area: 'Release', status: 'in-progress',
    description: 'Automated validation, owner review, authorized-domain setup, rollback rehearsal, and controlled production cutover.',
  },
] as const;

for (const workstream of workstreams) {
  const existing = await db.collection('actionPlans').where('v2Key', '==', workstream.key).limit(1).get();
  if (!existing.empty) continue;

  const ref = db.collection('actionPlans').doc();
  const latestUpdate = workstream.status === 'review'
    ? 'Implementation and automated checks are ready for UAT review.'
    : 'UAT deployment is active; owner validation and release rehearsal remain.';
  const value = {
    ...workstream,
    v2Key: workstream.key,
    owner: 'GTOP product and engineering agents',
    priority: 'high',
    milestone: 'GTOP v2',
    labels: ['v2'],
    dependencies: [],
    acceptanceCriteria: ['Implementation is complete.', 'Relevant automated checks pass.', 'Evidence is attached for owner review.'],
    sourceReferences: ['feature/gtop-v2', sourceReference],
    archived: false,
    latestUpdate,
    createdBy: actor,
    updatedBy: actor,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  await ref.create(value);
  await ref.collection('updates').add({
    message: latestUpdate,
    type: workstream.status === 'review' ? 'review' : 'progress',
    toStatus: workstream.status,
    actor,
    sourceReference,
    createdAt: FieldValue.serverTimestamp(),
  });
  await db.collection('mcpAuditLog').add({
    actor: actor.name,
    taskReference: sourceReference,
    tool: 'seed_v2_action_plan',
    target: ref.path,
    before: null,
    after: { v2Key: workstream.key, status: workstream.status, milestone: 'GTOP v2' },
    createdAt: FieldValue.serverTimestamp(),
  });
}

process.stdout.write('GTOP v2 Action Plan workstreams are present.\n');
