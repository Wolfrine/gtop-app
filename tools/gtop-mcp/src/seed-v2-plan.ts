import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const projectId =
  process.env["GTOP_FIREBASE_PROJECT_ID"] ||
  process.env["GOOGLE_CLOUD_PROJECT"] ||
  "gtop-app";
const sourceReference =
  process.env["GITHUB_SHA"] ||
  process.env["GTOP_MCP_TASK_REF"] ||
  "feature/gtop-v2";
const app =
  getApps()[0] ??
  initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore(app);
const actor = { name: "GTOP v2 release workflow", kind: "system" };

const workstreams = [
  {
    key: "foundation",
    title: "V2 foundation and design system",
    area: "Platform foundation",
    status: "review",
    description:
      "Angular 21 foundation, readiness-based authentication, repositories, responsive shells, and premium academic design system.",
  },
  {
    key: "learner",
    title: "V2 learner practice loop",
    area: "Learner experience",
    status: "review",
    description:
      "Profile setup, practice selection, quiz, summary, reporting, retry, and question feedback.",
  },
  {
    key: "admin",
    title: "V2 administration workspace",
    area: "Admin operations",
    status: "review",
    description:
      "Question, syllabus, user, report, live-session, log, and action-plan administration.",
  },
  {
    key: "live",
    title: "V2 live practice",
    area: "Live practice",
    status: "review",
    description:
      "Live quiz and quiz-run creation, lobby, participation, host control, and summary experiences.",
  },
  {
    key: "mcp",
    title: "Firestore MCP and agent workflow",
    area: "Agent operations",
    status: "review",
    description:
      "Audited action-plan and bounded full-Firestore tools with concurrency and destructive-operation safeguards.",
  },
  {
    key: "release",
    title: "V2 UAT validation and release",
    area: "Release",
    status: "in-progress",
    description:
      "Automated validation, owner review, authorized-domain setup, rollback rehearsal, and controlled production cutover.",
  },
  {
    key: "parity-auth-presence",
    title: "V2 authentication and presence parity",
    area: "Platform foundation",
    status: "review",
    description:
      "Readiness-based authentication, deep-link restoration, profile timestamps, and Realtime Database presence.",
  },
  {
    key: "parity-quiz-reports",
    title: "V2 quiz, review, and report parity",
    area: "Learner experience",
    status: "review",
    description:
      "Admin and learner quiz access, multi-scope practice, timers, retry, flags, historical review, and reports.",
  },
  {
    key: "parity-user-activity",
    title: "V2 administrator user activity",
    area: "Admin operations",
    status: "review",
    description:
      "User drill-down, presence, profile, attempts, trends, live participation, and safe access controls.",
  },
  {
    key: "parity-content",
    title: "V2 question bank and syllabus parity",
    area: "Content operations",
    status: "review",
    description:
      "Validated bulk import, flags, JSON export, curriculum preview, count refresh, and hierarchy propagation.",
  },
  {
    key: "parity-live",
    title: "V2 live quiz and quiz-run parity",
    area: "Live practice",
    status: "review",
    description:
      "Scheduling, preview, lobby, shared timing, response control, result linking, and leaderboard.",
  },
  {
    key: "theme-motion",
    title: "V2 Theme Lab and motion system",
    area: "Experience design",
    status: "review",
    description:
      "Five semantic themes, private preview, UAT publishing, responsive previews, and reduced-motion-safe interactions.",
  },
] as const;

for (const workstream of workstreams) {
  const existing = await db
    .collection("actionPlans")
    .where("v2Key", "==", workstream.key)
    .limit(1)
    .get();
  const existingDocument = existing.docs[0];
  const before = existingDocument?.data() ?? null;
  const ref = existingDocument?.ref ?? db.collection("actionPlans").doc();
  const latestUpdate =
    workstream.status === "review"
      ? `Implementation and automated checks are ready for UAT review at ${sourceReference}.`
      : "UAT deployment is active; owner validation and release rehearsal remain.";
  const sourceReferences = Array.from(
    new Set([
      ...((before?.["sourceReferences"] as string[] | undefined) ?? []),
      "feature/gtop-v2",
      sourceReference,
    ]),
  );
  const status = before?.["status"] === "done" ? "done" : workstream.status;
  const value = {
    ...workstream,
    status,
    v2Key: workstream.key,
    owner: "GTOP product and engineering agents",
    priority: "high",
    milestone: "GTOP v2",
    labels: ["v2"],
    dependencies: [],
    blocker: null,
    acceptanceCriteria: [
      "Implementation is complete.",
      "Relevant automated checks pass.",
      "Evidence is attached for owner review.",
    ],
    sourceReferences,
    archived: false,
    latestUpdate,
    updatedBy: actor,
    updatedAt: FieldValue.serverTimestamp(),
    ...(before
      ? {}
      : {
          createdBy: actor,
          createdAt: FieldValue.serverTimestamp(),
        }),
  };
  const alreadyLinked =
    sourceReferences.includes(sourceReference) &&
    ((before?.["sourceReferences"] as string[] | undefined) ?? []).includes(
      sourceReference,
    );

  await ref.set(value, { merge: true });
  if (!alreadyLinked) {
    await ref.collection("updates").add({
      message: latestUpdate,
      type: status === "review" ? "review" : "progress",
      toStatus: status,
      actor,
      sourceReference,
      createdAt: FieldValue.serverTimestamp(),
    });
    await db.collection("mcpAuditLog").add({
      actor: actor.name,
      taskReference: sourceReference,
      tool: "seed_v2_action_plan",
      target: ref.path,
      before: before
        ? {
            status: before["status"],
            sourceReferences: before["sourceReferences"],
          }
        : null,
      after: {
        v2Key: workstream.key,
        status,
        milestone: "GTOP v2",
        sourceReference,
      },
      createdAt: FieldValue.serverTimestamp(),
    });
  }
}

process.stdout.write("GTOP v2 Action Plan workstreams are present.\n");
