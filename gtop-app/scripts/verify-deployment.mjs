import assert from 'node:assert/strict';

const [origin, expectedCommit] = process.argv.slice(2);
assert(origin && expectedCommit, 'Usage: node scripts/verify-deployment.mjs ORIGIN COMMIT');
const base = new URL(origin);
assert.equal(base.protocol, 'https:');

async function get(path) {
  const response = await fetch(new URL(path, base), { cache: 'no-store', signal: AbortSignal.timeout(20000) });
  assert(response.ok, `${path} returned HTTP ${response.status}`);
  return response;
}

let release;
for (let attempt = 0; attempt < 12; attempt++) {
  release = await (await get('/version.json')).json();
  if (release.commit === expectedCommit) break;
  await new Promise(resolve => setTimeout(resolve, 5000));
}
assert.equal(release.commit, expectedCommit, 'Hosted release does not match the validated commit');
const html = await (await get('/')).text();
const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match => match[1]);
assert(scripts.length, 'No application entry scripts found');
for (const path of scripts.filter(path => new URL(path, base).origin === base.origin)) {
  const response = await get(path);
  assert(/javascript/.test(response.headers.get('content-type') ?? ''), `${path} is not JavaScript`);
  assert(!(await response.text()).trimStart().startsWith('<'), `${path} returned fallback HTML`);
}

console.log(`Verified deployed release ${release.commit} and its served application entry assets.`);
