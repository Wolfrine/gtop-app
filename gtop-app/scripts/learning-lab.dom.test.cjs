const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { JSDOM, VirtualConsole } = require(
  path.join(process.env.GTOP_TEST_MODULE_ROOT, "jsdom"),
);
const root = path.join(__dirname, "../dist/lab-preview/browser");
const errors = [];
const log = new VirtualConsole();
log.on("jsdomError", (e) => errors.push(e));
log.on("error", (e) => errors.push(e));
const dom = new JSDOM(
  "<!doctype html><html><body><app-root></app-root></body></html>",
  {
    url: "http://localhost/learning-lab",
    runScripts: "outside-only",
    pretendToBeVisual: true,
    virtualConsole: log,
  },
);
const w = dom.window,
  d = w.document;
w.crypto.randomUUID = require("node:crypto").randomUUID;
const wait = async (check) => {
  for (let i = 0; i < 200; i++) {
    if (check()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error(
    "DOM did not reach expected state. " +
      d.body.textContent.slice(-1800) +
      "\n" +
      errors.map(String).join("\n"),
  );
};
const button = (text) =>
  [...d.querySelectorAll("button,a")].find(
    (x) => x.textContent.trim() === text,
  );
const click = async (text) => {
  const el = button(text);
  assert.ok(el, text + " exists");
  assert.equal(el.disabled || false, false, text + " enabled");
  el.click();
  await new Promise((r) => setTimeout(r, 15));
};
const choose = async (id, index) => {
  const group = [...d.querySelectorAll("app-lab-choices")].find(
    (x) => x.getAttribute("ng-reflect-id") === id,
  );
  assert.ok(group, id + " choices exist");
  const input = group.querySelectorAll("input")[index];
  assert.equal(input.disabled || input.closest("fieldset").disabled, false);
  input.click();
  await new Promise((r) => setTimeout(r, 15));
};
const range = async (id, value) => {
  const el = d.getElementById(id);
  el.value = String(value);
  el.dispatchEvent(new w.Event("input", { bubbles: true }));
  el.dispatchEvent(new w.Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 15));
};
(async () => {
  w.eval(fs.readFileSync(path.join(root, "polyfills.js"), "utf8"));
  w.eval(
    "(function(){\n" +
      fs.readFileSync(path.join(root, "main.js"), "utf8") +
      "\n})();",
  );
  await wait(() => button("Open Current Lab →"));
  await click("Open Current Lab →");
  await wait(() => button("Start student attempt →"));
  assert.equal(button("Start student attempt →").disabled, true);
  await choose("pre-voltage", 2);
  await choose("pre-parallel", 2);
  await click("Start student attempt →");
  await wait(() => d.querySelector(".workbench"));
  assert.equal(button("Record observation ✓").disabled, true);
  assert.equal(
    d.getElementById("voltage-control").closest("fieldset").disabled,
    true,
  );
  await choose("mission-voltage", 2);
  await range("voltage-control", 12);
  assert.match(d.querySelector(".meter-row").textContent, /2\s*A/);
  await click("Record observation ✓");
  await click("Next experiment →");
  await choose("mission-resistance", 0);
  await range("r1-control", 12);
  await click("Record observation ✓");
  await click("Next experiment →");
  await choose("mission-paths", 2);
  const parallel = [...d.querySelectorAll(".mode-selector label")]
    .find((el) => el.textContent.trim() === "Parallel")
    .querySelector("input");
  parallel.click();
  await new Promise((r) => setTimeout(r, 15));
  assert.match(d.querySelector(".meter-row").textContent, /2\s*A/);
  assert.ok(d.querySelector('svg path[d="M170 80 V205 H240"]'));
  await click("Record observation ✓");
  await click("Check understanding →");
  for (const [id, answer] of [
    ["q-voltage", 1],
    ["q-resistance", 2],
    ["q-series", 1],
    ["q-parallel", 2],
    ["q-power", 1],
  ])
    await choose(id, answer);
  await choose("confidence", 2);
  await click("Check my answers →");
  assert.match(d.querySelector(".score-card").textContent, /5\s*\/5/);
  await choose("usefulness", 3);
  const feedback = d.getElementById("feedback");
  feedback.value = "The parallel circuit helped.";
  feedback.dispatchEvent(new w.Event("input", { bubbles: true }));
  await click("Send feedback →");
  assert.match(
    d.querySelector(".feedback-success").textContent,
    /Your feedback is saved/,
  );
  await click("Return to Learning Lab");
  await click("Results & Feedback");
  await wait(() => d.querySelector(".student-feedback"));
  assert.match(
    d.querySelector(".student-feedback").textContent,
    /The parallel circuit helped/,
  );
  assert.match(d.querySelector(".student-feedback").textContent, /4\/5 useful/);
  await click("Lessons");
  await click("Open Current Lab →");
  await wait(() => button("Open attempt"));
  await click("Open attempt");
  assert.match(
    d.querySelector(".feedback-success").textContent,
    /Your feedback is saved/,
  );
  assert.match(d.querySelector(".score-card").textContent, /5\s*\/5/);
  assert.equal(errors.length, 0, errors.map(String).join("\n"));
  console.log(
    "PASS: compiled Angular lesson, disabled states, sliders, parallel SVG, all observations, assessment, feedback, admin results and resume",
  );
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => dom.window.close());
