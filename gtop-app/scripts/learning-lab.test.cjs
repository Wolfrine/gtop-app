const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { buildSync } = require("esbuild");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gtop-lesson-"));
buildSync({
  entryPoints: [
    path.join(__dirname, "../src/app/pages/learning-lab/attempt.ts"),
    path.join(__dirname, "../src/app/pages/learning-lab/lesson.ts"),
  ],
  bundle: true,
  platform: "node",
  format: "cjs",
  outdir: dir,
});
const { circuit, baseline, questions, missions, score } = require(
  path.join(dir, "lesson.js"),
);
const { newAttempt, changeAttempt, appendAttempt, readHistory } = require(
  path.join(dir, "attempt.js"),
);
process.on("exit", () => fs.rmSync(dir, { recursive: true, force: true }));
const correct = (items) =>
  Object.fromEntries(items.map((q) => [q.id, q.answer]));
const start = () => newAttempt("one", correct(baseline), 1);
const observed = () =>
  missions.reduce(
    (a, m) =>
      changeAttempt(
        changeAttempt(
          a,
          { kind: "prediction", mission: m.id, answer: m.answer },
          2,
        ),
        { kind: "experiment", mission: m.id },
        3,
      ),
    start(),
  );

test("Ohm’s law and all three experiments give the expected observations", () => {
  assert.equal(circuit(6, 6, 6, "single").current, 1);
  assert.equal(circuit(12, 6, 6, "single").current, 2);
  assert.equal(circuit(6, 12, 6, "single").current, 0.5);
  assert.equal(circuit(6, 6, 6, "series").current, 0.5);
  assert.equal(circuit(6, 6, 6, "parallel").current, 2);
  assert.equal(circuit(6, 12, 6, "single").power, 3);
});
test("charge and energy are conserved for unequal series and parallel resistors", () => {
  for (let v = 1; v <= 12; v++)
    for (let r = 1; r <= 12; r++) {
      const series = circuit(v, r, 5, "series");
      assert.ok(Math.abs(series.v1 + series.v2 - v) < 1e-10);
      assert.equal(series.i1, series.i2);
      const parallel = circuit(v, r, 5, "parallel");
      assert.ok(Math.abs(parallel.i1 + parallel.i2 - parallel.current) < 1e-10);
      assert.ok(Math.abs(parallel.v1 - v) < 1e-10);
      assert.ok(
        Math.abs(
          parallel.i1 * parallel.v1 +
            parallel.i2 * parallel.v2 -
            parallel.power,
        ) < 1e-10,
      );
      for (const mode of ["single", "series", "parallel"]) {
        const open = circuit(v, r, 5, mode, false);
        assert.deepEqual(
          [open.current, open.i1, open.i2, open.power],
          [0, 0, 0, 0],
        );
      }
    }
  assert.throws(() => circuit(6, 0, 6, "single"));
  assert.throws(() => circuit(NaN, 6, 6, "series"));
});
test("predictions and checked answers remain first submissions after retry or another tab", () => {
  let a = changeAttempt(
    start(),
    { kind: "prediction", mission: "voltage", answer: 0 },
    2,
  );
  a = changeAttempt(
    a,
    { kind: "prediction", mission: "voltage", answer: 2 },
    3,
  );
  assert.equal(a.predictions.voltage, 0);
  let checked = changeAttempt(
    observed(),
    { kind: "assessment", answers: correct(questions), confidence: 3 },
    4,
  );
  checked = changeAttempt(
    checked,
    { kind: "assessment", answers: {}, confidence: 1 },
    5,
  );
  assert.equal(score(checked.answers), 5);
  assert.equal(checked.confidence, 3);
});
test("incomplete and malformed submissions cannot advance the lesson", () => {
  assert.throws(() => newAttempt("one", {}, 1));
  assert.throws(() =>
    changeAttempt(start(), { kind: "experiment", mission: "voltage" }, 2),
  );
  assert.throws(() =>
    changeAttempt(
      start(),
      { kind: "prediction", mission: "invalid", answer: 2 },
      2,
    ),
  );
  assert.throws(() =>
    changeAttempt(
      start(),
      { kind: "assessment", answers: correct(questions), confidence: 3 },
      2,
    ),
  );
  assert.throws(() =>
    changeAttempt(
      observed(),
      {
        kind: "assessment",
        answers: { ...correct(questions), extra: 2 },
        confidence: 3,
      },
      2,
    ),
  );
  assert.throws(() =>
    changeAttempt(
      start(),
      { kind: "feedback", rating: 5, friction: "", feedback: "" },
      2,
    ),
  );
  const checked = changeAttempt(
    observed(),
    { kind: "assessment", answers: correct(questions), confidence: 3 },
    4,
  );
  assert.throws(() =>
    changeAttempt(
      checked,
      { kind: "feedback", rating: 6, friction: "", feedback: "" },
      5,
    ),
  );
  assert.throws(() =>
    changeAttempt(
      checked,
      { kind: "feedback", rating: 5, friction: "", feedback: "x".repeat(801) },
      5,
    ),
  );
});
test("retention and restore keep five recent complete records and real feedback", () => {
  let a = changeAttempt(
    observed(),
    { kind: "assessment", answers: correct(questions), confidence: 3 },
    4,
  );
  a = changeAttempt(
    a,
    {
      kind: "feedback",
      rating: 4,
      friction: "  Small text  ",
      feedback: "The circuit helped",
    },
    5,
  );
  let history = [];
  for (let i = 0; i < 7; i++)
    history = appendAttempt(history, { ...a, id: String(i) });
  assert.deepEqual(
    history.map((a) => a.id),
    ["6", "5", "4", "3", "2"],
  );
  const restored = readHistory(
    JSON.parse(JSON.stringify({ lessonId: "current-lab", attempts: history })),
  );
  assert.equal(restored[0].feedback, "The circuit helped");
  assert.equal(restored[0].friction, "Small text");
  assert.equal(restored[0].phase, "complete");
  assert.deepEqual(
    readHistory({ lessonId: "current-lab", attempts: [{ broken: true }] }),
    [],
  );
  assert.deepEqual(readHistory(null), []);
});
