const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { JSDOM, VirtualConsole } = require(
  path.join(process.env.GTOP_TEST_MODULE_ROOT, "jsdom"),
);
const root = path.join(__dirname, "../dist/plant-preview/browser");
const errors = [];
const log = new VirtualConsole();
log.on("jsdomError", (e) => errors.push(e));
log.on("error", (...e) => errors.push(e.map(x=>x?.stack || String(x)).join(" ")));
const dom = new JSDOM(
  "<!doctype html><html><body><app-root></app-root></body></html>",
  {
    url: "http://localhost/",
    runScripts: "outside-only",
    pretendToBeVisual: true,
    virtualConsole: log,
  },
);
const w = dom.window,
  d = w.document;
w.crypto.randomUUID = require("node:crypto").randomUUID;
w.matchMedia = () => ({matches:true,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});
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
    require("esbuild").transformSync(
      fs.readFileSync(path.join(root, "main.js"), "utf8"),
      { format: "iife", target: "es2022" },
    ).code,
  );
  await wait(() => button("Sign in ↗"));
  await click("Sign in ↗");
  await wait(() => button("Sign in with Google"));
  await click("Sign in with Google");
  await wait(() => button("Learning Lab"));
  await click("Learning Lab");
  await click("Open Plant Reproduction →");
  await wait(() => button("Enter the garden →"));
  assert.equal(button("Enter the garden →").disabled,true);
  await choose("pre-pollen",1); await choose("pre-clone",0);
  await click("Enter the garden →");
  await wait(()=>d.querySelector(".plant-bench"));
  assert.equal(button("Record observation ✓").disabled,true);
  assert.equal(button("Open the flower").closest("fieldset").disabled,true);
  await choose("mission-anatomy",1); await click("Open the flower");
  await click("Anther"); await click("Ovary & ovules");
  await click("Record observation ✓"); await click("Next exploration →");
  await choose("mission-pollination",2); await click("Transfer pollen →");
  assert.match(d.querySelector(".plant-controls").textContent,/Pollen on a petal/);
  assert.equal(button("Record observation ✓").disabled,true);
  const select = async(id,value)=>{const el=d.getElementById(id);el.value=value;el.dispatchEvent(new w.Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,20));};
  await select('pollen-source','other-species'); await select('pollen-target','stigma');
  await click("Transfer pollen →"); assert.match(d.querySelector('.plant-controls').textContent,/Incompatible pollen/);
  await select('pollen-source','other-plant'); await click("Transfer pollen →");
  assert.match(d.querySelector('.plant-controls').textContent,/Cross-pollination/);
  await click("Record observation ✓"); await click("Next exploration →");
  await choose("mission-fertilisation",0);
  await click("Next event →"); await click("Next event →");
  assert.equal(d.querySelector('path[pathLength="100"]').getAttribute('stroke-dashoffset'),'0');
  await click("Next event →"); await click("Record observation ✓"); await click("Next exploration →");
  await choose("mission-seeds",2); await range('fruit-time',100); await select('dispersal','water');
  assert.equal(button("Record observation ✓").disabled,true);
  await select('dispersal','wind'); await click("Record observation ✓"); await click("Next exploration →");
  await choose("mission-propagation",0); await click("Start comparison"); await range('clone-time',100);
  assert.equal(button("Record observation ✓").disabled,true);
  await click("Explore a Bryophyllum leaf"); await click("Record observation ✓"); await click("Check my understanding →");
  for(const [id,n] of [['q-pollination',1],['q-fusion',2],['q-seed',3],['q-dispersal',0],['q-bud',1]]) await choose(id,n);
  await choose('plant-confidence',2); await click('Check my answers →');
  assert.match(d.querySelector('.score-card').textContent,/5\s*\/5/);
  await choose('plant-usefulness',3);
  const feedback=d.getElementById('plant-feedback');feedback.value='The flower cutaway helped.';feedback.dispatchEvent(new w.Event('input',{bubbles:true}));
  await click('Send feedback →'); assert.match(d.querySelector('.feedback-success').textContent,/Your feedback is saved/);
  await click('Return to Learning Lab');
  w.history.pushState({},'', '/learning-lab/plants/results');w.dispatchEvent(new w.PopStateEvent('popstate'));
  await wait(()=>d.querySelector('.student-feedback'));assert.match(d.querySelector('.student-feedback').textContent,/The flower cutaway helped/);
  await click('Lessons');await click('Open Plant Reproduction →');await wait(()=>button('Resume attempt'));await click('Resume attempt');
  assert.match(d.querySelector('.score-card').textContent,/5\s*\/5/);
  assert.match(d.querySelector('.feedback-success').textContent,/Your feedback is saved/);
  await click('Return to Learning Lab');await click('Open Plant Reproduction →');
  const before=w.sessionStorage.getItem('gtop-plant-qa-attempts');
  await choose('pre-pollen',0);await choose('pre-clone',1);await click('Try without saving');await choose('mission-anatomy',1);
  assert.equal(w.sessionStorage.getItem('gtop-plant-qa-attempts'),before);
  w.history.pushState({},'', '/learning-lab/plants/results');w.dispatchEvent(new w.PopStateEvent('popstate'));
  await wait(()=>d.querySelector('.student-feedback'));
  w.dispatchEvent(new w.Event('gtop-qa-account-change'));
  await wait(()=>w.location.pathname === '/learning-lab' && !d.querySelector('.student-feedback'));
  assert.equal(d.querySelector('.student-feedback'),null);
  assert.equal(d.querySelector('.score-card'),null);
  assert.equal(errors.length,0,errors.map(String).join('\n'));
  console.log('PASS: compiled Angular sign-in, all five explorations, pollen compatibility, tube timing, assessment, feedback, admin view, resume, practice without saving, and account-switch cleanup');

})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => dom.window.close());
