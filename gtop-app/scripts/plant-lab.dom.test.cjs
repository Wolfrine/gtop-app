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
w.scrollTo = () => {};
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
  await wait(() => d.querySelector('.pl-flower-touch'));
  assert.equal(d.querySelectorAll('app-lab-choices').length,0,'no pre-test blocks the flower');
  const act=async(label)=>{const el=d.querySelector(`[aria-label="${label}"]`);assert.ok(el,label);el.click();await new Promise(r=>setTimeout(r,25));};
  const primary=async()=>{const el=d.querySelector('.pl-action-bar .pl-primary');assert.ok(el);await wait(()=>!el.disabled);el.click();await new Promise(r=>setTimeout(r,30));};
  const saved=()=>JSON.parse(w.sessionStorage.getItem('gtop-plant-qa-attempts'))[0];
  await act('Open the flower'); await act('Inspect Anther');
  await act('Explore Deliver the pollen'); await act('Explore Inside a flower');
  assert.match(d.querySelector('.pl-small-progress').textContent,/✓ Pollen maker/,'unfinished inspection survives navigation');
  await act('Inspect Ovary'); await primary();
  await act('Land pollen on a petal');assert.match(d.querySelector('.pl-task').textContent,/Try the stigma/);
  await act('A different species');await act('Land pollen on the stigma');assert.match(d.querySelector('.pl-observation').textContent,/Incompatible pollen/);
  await act('Another plant of the same species');await act('Land pollen on the stigma');assert.match(d.querySelector('.pl-observation').textContent,/Cross-pollination/);
  assert.equal(saved().fieldwork.pollenTrials.length,3);await primary();
  await primary(); assert.equal(saved().fieldwork.journeyStage,1);
  await act('Explore Inside a flower');await act('Explore A journey within');assert.equal(saved().fieldwork.journeyStage,1);
  await primary(); await act('Fuse a male gamete with the egg cell');assert.match(d.querySelector('app-plant-scene').textContent,/Zygote/);
  await click('↻ Follow again');await primary();await primary();await primary();assert.equal(saved().fieldwork.journeyStage,3,'replay really advances through events');
  await primary();await primary();await primary();await primary();
  await click('Release a fruit ↗');assert.equal(saved().experiments.includes('seeds'),false,'still air prompts another condition');
  await click('≈Breeze');await click('Release a fruit ↗');assert.equal(saved().experiments.includes('seeds'),true);
  await click('↻ Watch fruit development again');await primary();assert.equal(saved().fieldwork.fruitStage,1,'completed fruit sequence can replay');
  await primary();await primary();await click('Release a fruit ↗');await primary();
  await primary();await primary();await primary();await act('Plant a Bryophyllum leaf bud');
  await click('← Back to potato pieces');assert.equal(saved().experiments.includes('propagation'),true,'closing leaf does not revoke discovery');
  await click('↻ Try another comparison');await primary();await primary();await primary();await primary();
  assert.equal(saved().experiments.length,5);await primary();
  await click('Try five fresh situations →');
  for(const [id,n] of [['q-pollination',1],['q-fusion',2],['q-seed',3],['q-dispersal',0],['q-bud',1]]){await choose(id,n);if(id!=='q-bud')await click('Next question →');}
  await choose('plant-confidence',2);await click('Check my answers →');assert.match(d.querySelector('.pl-score').textContent,/5\s*\/5 correct/);
  await act('4 out of 5 useful');
  const feedback=d.getElementById('plant-feedback');feedback.value='The flower cutaway helped.';feedback.dispatchEvent(new w.Event('input',{bubbles:true}));
  await click('Send feedback →');assert.match(d.querySelector('.pl-finished').textContent,/Your feedback is saved/);
  await click('Back to Learning Lab →');
  w.history.pushState({},'', '/learning-lab/plants/results');w.dispatchEvent(new w.PopStateEvent('popstate'));
  await wait(()=>d.querySelector('.student-feedback'));assert.match(d.querySelector('.student-feedback').textContent,/The flower cutaway helped/);
  await click('Lessons');await click('Open Plant Reproduction →');await wait(()=>button('Continue that visit →'));await click('Continue that visit →');
  assert.match(d.querySelector('.pl-score').textContent,/5\s*\/5 correct/);assert.match(d.querySelector('.pl-finished').textContent,/Your feedback is saved/);
  await click('Back to Learning Lab →');await click('Open Plant Reproduction →');
  const before=w.sessionStorage.getItem('gtop-plant-qa-attempts');await click('Explore without saving');await act('Open the flower');await act('Inspect Anther');
  assert.equal(w.sessionStorage.getItem('gtop-plant-qa-attempts'),before,'practice does not write progress');
  w.history.pushState({},'', '/learning-lab/plants/results');w.dispatchEvent(new w.PopStateEvent('popstate'));
  await wait(()=>d.querySelector('.student-feedback'));w.dispatchEvent(new w.Event('gtop-qa-account-change'));
  await wait(()=>w.location.pathname === '/learning-lab' && !d.querySelector('.student-feedback'));
  assert.equal(d.querySelector('.pl-score'),null);assert.equal(errors.length,0,errors.map(String).join('\n'));
  console.log('PASS: real Angular shell/sign-in, immediate exploration, five guided experiments, failed trials, persistent navigation, replays, assessment, feedback, admin results, resume, practice isolation and account cleanup');

})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => dom.window.close());
