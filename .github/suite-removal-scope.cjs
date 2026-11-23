const { execFileSync } = require('node:child_process');

// Removing verification tooling and local test sign-in hooks does not require a shared backend release.
const [before, current] = process.argv.slice(2);
if (![before, current].every(value => /^[0-9a-f]{40}$/.test(value ?? ''))) process.exit(1);

const scopeFiles = new Set([
  '.github/suite-removal-scope.cjs',
  '.github/workflows/firebase-deploy.yml',
  '.github/workflows/firebase-v2-backend.yml',
  '.github/workflows/firebase-v2-production.yml',
  '.github/workflows/firebase-v2-uat.yml',
  '.github/workflows/gt-papers-growth-preview.yml',
  '.github/workflows/gtop-assistant-release.yml',
  '.github/workflows/gtop-mcp-access.yml',
  'gtop-app/angular.json',
  'gtop-app/src/app/app.config.ts',
  'gtop-v2/src/app/core/auth.store.ts',
  'tools/gtop-assistant/tsconfig.json',
  'gtop-app/AGENTS.md',
]);
const packageMetadata = /^(?:assistant-service|gtop-app(?:\/functions)?|gtop-v2|question-papers|tools\/(?:gtop-assistant|gtop-mcp))\/package(?:-lock)?\.json$/;
const removedTooling = /(?:^|\/)(?:e2e|test)\/|\.(?:test|spec|integration)\.[cm]?[jt]sx?$|\/(?:playwright|vitest|jest|cypress)\.config\.|\/tsconfig\.spec\.json$|^design-upgrade\/capture-tools\/|^\.github\/workflows\/design-(?:baseline-capture|reference-capture|reference-interactions)\.yml$/;
const retiredChecks = new Set([
  'assistant-service/scripts/verify-live.mjs',
  'assistant-service/scripts/seed-emulator.mjs',
  'gtop-app/functions/verify-deployment.mjs',
  'gtop-app/scripts/verify-live-paper-rules.mjs',
  'question-papers/scripts/fixture-smoke.mjs',
  'question-papers/scripts/growth-design-capture.mjs',
  'tools/gtop-mcp-runner/fixtures/server.mjs',
]);

let changes;
try {
  const paths = execFileSync('git', ['diff', '--no-renames', '--name-status', '-z', before, current], {encoding: 'utf8'}).split('\0');
  paths.pop();
  changes = [];
  for (let index = 0; index < paths.length; index += 2) changes.push({status: paths[index], path: paths[index + 1]});
} catch {
  process.exit(1);
}
const isToolRemoval = ({status, path}) => status === 'D' && (removedTooling.test(path) || retiredChecks.has(path));
const onlySuiteRemoval = changes.some(isToolRemoval) && changes.every(change =>
  isToolRemoval(change) || scopeFiles.has(change.path) || packageMetadata.test(change.path)
);
process.exit(onlySuiteRemoval ? 0 : 1);
