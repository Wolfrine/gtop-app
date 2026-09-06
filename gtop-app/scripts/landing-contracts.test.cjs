// Public landing regressions: account navigation, teardown, sample retry and motion.
// Run with: node scripts/landing-contracts.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { Subject, Subscription } = require('rxjs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../src/app/pages/landing-page/landing-page.component.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: true } }).outputText;
const exported = {};
let reducedMotion = false;
let disconnected = false;
const context = {
  exports: exported,
  require(name) {
    if (name === 'rxjs') return { Subscription };
    if (name === '@angular/core') return { Component: () => target => target };
    return {};
  },
  window: { matchMedia: () => ({ matches: reducedMotion }), IntersectionObserver: true },
  IntersectionObserver: class { observe() {} unobserve() {} disconnect() { disconnected = true; } }
};
vm.runInNewContext(compiled, context);
const userStream = new Subject();
const navigations = [];
const scrolls = [];
const focusCalls = [];
const component = new exported.LandingPageComponent(
  { navigate: path => navigations.push(path.join('/')) },
  { getUser: () => userStream },
  { nativeElement: { querySelector: selector => selector === '.landing-experience' ? { classList: { add() {} } } : { scrollIntoView: options => scrolls.push(options.behavior), focus: options => focusCalls.push(options.preventScroll) }, querySelectorAll: () => [] } }
);
component.ngOnInit();
userStream.next(null);
userStream.next({ board: 'CBSE' });
assert.equal(navigations.length, 0, 'Signed-out and incomplete profiles stay on the landing page');
userStream.next({ board: 'CBSE', standard: '10' });
assert.deepEqual(navigations, ['/dashboard'], 'Completed profiles retain the existing dashboard destination');
component.ngAfterViewInit();
component.ngOnDestroy();
userStream.next({ board: 'ICSE', standard: '9' });
assert.equal(navigations.length, 1, 'A departed landing page cannot navigate after a later account update');
assert.equal(disconnected, true, 'Decorative observers are disconnected on teardown');
component.checkAnswer('A');
assert.equal(component.selectedAnswer, 'A');
assert.match(component.answerFeedback, /Paris/);
component.checkAnswer('C');
assert.match(component.answerFeedback, /^Correct/);
component.resetSample();
assert.equal(component.selectedAnswer, null);
assert.equal(component.answerFeedback, null);
assert.equal(navigations.length, 1, 'Sample interaction never signs in or writes quiz results');
component.signUp();
assert.equal(navigations.at(-1), '/profile-setup', 'Every sign-in CTA retains the account-setup destination');
let defaultPrevented = false;
component.scrollToSection('landing-question', { preventDefault() { defaultPrevented = true; } });
assert.equal(defaultPrevented, true, 'In-page navigation avoids fragment route changes');
assert.equal(scrolls.at(-1), 'smooth');
reducedMotion = true;
component.scrollToSection('landing-question');
assert.equal(scrolls.at(-1), 'auto', 'System reduced motion disables smooth scrolling');
reducedMotion = false;
component.motionPaused = true;
component.scrollToSection('landing-question');
assert.equal(scrolls.at(-1), 'auto', 'Manual pause also disables smooth scrolling');
assert.ok(focusCalls.every(Boolean), 'Section focus does not trigger a second scroll');
console.log('PASS: landing account redirects, subscription/observer teardown, answer retry, CTA destination and reduced-motion navigation.');
