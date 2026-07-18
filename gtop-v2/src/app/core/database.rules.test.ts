import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { get, ref, set } from 'firebase/database';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

describe('GTOP Realtime Database rules', () => {
  let environment: RulesTestEnvironment;
  beforeAll(async () => {
    environment = await initializeTestEnvironment({
      projectId: 'demo-gtop',
      database: { rules: readFileSync('database.rules.json', 'utf8'), host: '127.0.0.1', port: 9000 },
    });
  });
  beforeEach(async () => environment.clearDatabase());
  afterAll(async () => environment.cleanup());

  it('requires authentication for presence reads and validated writes', async () => {
    const anonymous = environment.unauthenticatedContext().database();
    const signedIn = environment.authenticatedContext('user-1').database();
    await assertFails(get(ref(anonymous, 'activeUsers')));
    await assertSucceeds(set(ref(signedIn, 'activeUsers/user-1'), { userId: 'user-1', isOnline: true, lastActive: 1 }));
    await assertFails(set(ref(signedIn, 'activeUsers/user-1'), { userId: 'another-user', isOnline: true }));
    await assertSucceeds(get(ref(signedIn, 'activeUsers')));
  });
});
