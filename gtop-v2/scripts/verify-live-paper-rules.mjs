import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

assert(process.env.ACCESS_TOKEN, 'The existing Firebase workflow authentication is required');
async function readRules(path) {
  const response = await fetch(`https://firebaserules.googleapis.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${process.env.ACCESS_TOKEN}` }, signal: AbortSignal.timeout(20000),
  });
  assert(response.ok, `Active rule inspection returned HTTP ${response.status}`);
  return response.json();
}
const release = await readRules('projects/gtop-app/releases/cloud.firestore');
const ruleset = await readRules(release.rulesetName);
const source = ruleset.source.files.find(file => file.name === 'firestore.rules');
assert(source?.content, 'Active Firestore rule source is missing');
const directory = await mkdtemp(join(tmpdir(), 'gtop-active-rules-'));
try {
  const file = join(directory, 'firestore.rules');
  await writeFile(file, source.content);
  const { ACCESS_TOKEN: omitted, ...testEnvironment } = process.env;
  const result = spawnSync('npx', ['--yes', 'firebase-tools@15', 'emulators:exec', '--only', 'firestore', '--project', 'demo-paper-access', 'vitest run src/app/core/paper-access.rules.test.ts'], {
    stdio: 'inherit', env: { ...testEnvironment, GTOP_RULES_FILE: file },
  });
  if (result.status !== 0) {
    console.error('The deployed shared backend does not satisfy paper-module access checks. Use the existing protected Firebase backend workflow to deploy reviewed rules; hosting alone cannot fix this.');
    process.exitCode = 1;
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}
