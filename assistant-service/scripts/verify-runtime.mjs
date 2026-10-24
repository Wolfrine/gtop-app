import assert from 'node:assert/strict';

// Import the real entry point after npm ci --omit=dev, before cloud credentials
// or deployment. Development dependencies must never hide a missing runtime dep.
process.env.GCLOUD_PROJECT='demo-gtop-assistant-runtime-check';
process.env.FIREBASE_CONFIG=JSON.stringify({projectId:process.env.GCLOUD_PROJECT});
const {gtopAssistantGateway}=await import('../runtime.mjs');
assert.equal(typeof gtopAssistantGateway,'function');
console.log('Production-only gateway entry point loaded without cloud access.');
