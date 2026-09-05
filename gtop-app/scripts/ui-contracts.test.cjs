// Guard the existing application contracts during presentation-only changes.
// This supplements browser checks; it does not prove visual or runtime correctness.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const base = process.env.GTOP_UI_BASE_REF || '3893926975caa16af9ca623afb130283e8703de6';
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
const files = git('diff', '--name-only', base, '--', 'gtop-app/src/app').trim().split('\n').filter(Boolean);
function contracts(html) {
  const clean = html.replace(/<!--[\s\S]*?-->/g, '');
  const attributes = /(?:^|\s)(\([^\)]+\)|\[[^\]]+\]|\*[\w-]+|routerLink|href|formControlName|name|type|value)\s*=\s*(["'])([\s\S]*?)\2/g;
  return [...clean.matchAll(attributes)].map(m => `${m[1]}=${m[3]}`).sort();
}
let templates = 0;
let logic = 0;
for (const file of files) {
  if (file.includes('/ui-kitchen/')) continue; // The explicitly approved review tool.
  if (!/\.(html|ts)$/.test(file)) continue;
  const before = git('show', `${base}:${file}`);
  const after = fs.readFileSync(path.join(root, file), 'utf8');
  if (file.endsWith('.html')) {
    assert.deepEqual(contracts(after), contracts(before), `Changed bindings/action targets: ${file}`);
    templates++;
  } else {
    // Sidebar labels/tooltips are presentation. Keep routes, roles and methods exact.
    const labels = source => file.endsWith('/side-nav.component.ts')
      ? source.replace(/\b(label|tooltip):\s*'[^']*'/g, '$1: PRESENTATION')
      : source;
    assert.equal(labels(after), labels(before), `Changed application logic: ${file}`);
    logic++;
  }
}
console.log(`PASS: ${templates} changed templates preserve bindings/action targets; ${logic} changed logic files preserve behaviour.`);
