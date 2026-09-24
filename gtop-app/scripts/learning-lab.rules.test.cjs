// Run against demo Firestore only. See docs/learning-lab.md for the isolated test runtime.
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os");
const assert = require("node:assert/strict");
const { build } = require("esbuild");
const modules = process.env.GTOP_TEST_MODULE_ROOT || path.join(__dirname, "../node_modules");
const { initializeTestEnvironment, assertFails, assertSucceeds } = require(
  path.join(modules, "@firebase/rules-unit-testing"),
);
const dbApi = require(path.join(modules, "firebase/firestore"));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gtop-rules-"));
let env;
(async () => {
  await build({
    entryPoints: [
      path.join(
        __dirname,
        "../src/app/pages/learning-lab/learning-lab.service.ts",
      ),
    ],
    bundle: true,
    platform: "node",
    format: "cjs",
    external: [path.join(modules, "firebase/firestore")],
    outfile: path.join(dir, "service.cjs"),
    plugins: [
      {
        name: "inject-test-context",
        setup(b) {
          b.onResolve({ filter: /^@angular\// }, (args) => ({
            path: args.path,
            namespace: "test-injection",
          }));
          b.onLoad({ filter: /.*/, namespace: "test-injection" }, (args) => ({
            contents:
              args.path === "@angular/core"
                ? `exports.Injectable = () => value => value; exports.inject = key => global.__GTOP_LAB_TEST_DEPS[key];`
                : args.path === "@angular/fire/firestore"
                  ? `module.exports = {...require(${JSON.stringify(path.join(modules, "firebase/firestore"))}), Firestore: 'Firestore'};`
                  : args.path === "@angular/fire/auth"
                    ? `exports.Auth = 'Auth';`
                    : `exports.Router = 'Router';`,
            loader: "js",
          }));
        },
      },
    ],
  });
  const { LearningLabService, labGuard } = require(
    path.join(dir, "service.cjs"),
  );
  env = await initializeTestEnvironment({
    projectId: "demo-gtop-learning-lab",
    firestore: {
      host: "127.0.0.1",
      port: Number(process.env.GTOP_TEST_FIRESTORE_PORT || 8080),
      rules: fs.readFileSync(
        path.join(__dirname, "../firestore.rules"),
        "utf8",
      ),
    },
  });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (const [uid, role] of [
      ["learner", "user"],
      ["other", "user"],
      ["admin", "admin"],
      ["institute", "institute-admin"],
    ])
      await dbApi.setDoc(dbApi.doc(ctx.firestore(), "users", uid), {
        uid,
        role,
        displayName: uid,
        board: "CBSE",
        standard: "10",
      });
  });
  const context = (uid, profileUid = uid) => {
    const db = uid
      ? env.authenticatedContext(uid).firestore()
      : env.unauthenticatedContext().firestore();
    global.__GTOP_LAB_TEST_DEPS = {
      Auth: {
        authStateReady: async () => {},
        currentUser: uid ? { uid: profileUid } : null,
      },
      Firestore: db,
      Router: { createUrlTree: (paths) => ({ paths }) },
    };
    return { db, service: new LearningLabService() };
  };
  const learner = context("learner");
  let a = await learner.service.start({ "pre-voltage": 2, "pre-parallel": 2 });
  assert.equal((await learner.service.load())[0].id, a.id);
  console.log(
    "PASS: actual service starts and restores an account-owned attempt",
  );
  const other = context("other");
  await assertFails(dbApi.getDoc(dbApi.doc(other.db, "users", "learner")));
  await assertFails(
    dbApi.updateDoc(dbApi.doc(other.db, "users", "learner"), {
      learningLab: {},
    }),
  );
  await assert.rejects(other.service.results());
  const anonymous = context(null);
  await assertFails(dbApi.getDoc(dbApi.doc(anonymous.db, "users", "learner")));
  await assert.rejects(anonymous.service.load());
  console.log(
    "PASS: other learners and signed-out clients cannot read or alter attempts",
  );
  await Promise.all([
    learner.service.change(a.id, {
      kind: "prediction",
      mission: "voltage",
      answer: 0,
    }),
    learner.service.change(a.id, {
      kind: "prediction",
      mission: "voltage",
      answer: 2,
    }),
  ]);
  const firstPrediction = (await learner.service.load())[0].predictions.voltage;
  for (const [mission, answer] of [
    ["voltage", 2],
    ["resistance", 0],
    ["paths", 2],
  ]) {
    await learner.service.change(a.id, { kind: "prediction", mission, answer });
    await learner.service.change(a.id, { kind: "experiment", mission });
  }
  const answers = {
    "q-voltage": 1,
    "q-resistance": 2,
    "q-series": 1,
    "q-parallel": 2,
    "q-power": 1,
  };
  await learner.service.change(a.id, {
    kind: "assessment",
    answers,
    confidence: 3,
  });
  await learner.service.change(a.id, {
    kind: "assessment",
    answers: {},
    confidence: 1,
  });
  await learner.service.change(a.id, {
    kind: "feedback",
    rating: 4,
    feedback: "The branches helped.",
    friction: "",
  });
  a = (await learner.service.load())[0];
  assert.equal(a.predictions.voltage, firstPrediction);
  assert.deepEqual(a.answers, answers);
  assert.equal(a.confidence, 3);
  assert.equal(a.phase, "complete");
  console.log(
    "PASS: concurrent predictions, assessment retries, and feedback preserve the first saved responses",
  );
  const profile = (
    await dbApi.getDoc(dbApi.doc(learner.db, "users", "learner"))
  ).data();
  assert.equal(profile.board, "CBSE");
  assert.equal(profile.standard, "10");
  assert.equal(profile.role, "user");
  await assertFails(
    dbApi.updateDoc(dbApi.doc(learner.db, "users", "learner"), {
      role: "admin",
    }),
  );
  const admin = context("admin");
  const page = await admin.service.results();
  assert.equal(page.rows[0].attempts[0].feedback, "The branches helped.");
  assert.equal(await labGuard({ data: { adminOnly: true } }), true);
  context("institute");
  assert.equal(await labGuard({ data: {} }), true);
  assert.deepEqual(await labGuard({ data: { adminOnly: true } }), {
    paths: ["/learning-lab"],
  });
  context("other");
  assert.equal(await labGuard({ data: {} }), true);
  assert.deepEqual(await labGuard({ data: { adminOnly: true } }), {
    paths: ["/learning-lab"],
  });
  context(null);
  assert.deepEqual(await labGuard({ data: {} }), { paths: ["/"] });
  console.log(
    "PASS: existing profile fields are preserved; only admins can open cross-account results",
  );
  for (let i = 0; i < 6; i++)
    await learner.service.start({ "pre-voltage": 0, "pre-parallel": 3 });
  assert.equal((await learner.service.load()).length, 5);
  await assert.rejects(
    learner.service.change(a.id, {
      kind: "feedback",
      rating: 5,
      feedback: "",
      friction: "",
    }),
  );
  console.log(
    "PASS: retention is bounded and expired attempts cannot overwrite newer history",
  );
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (env) await env.cleanup();
    fs.rmSync(dir, { recursive: true, force: true });
    delete global.__GTOP_LAB_TEST_DEPS;
  });
