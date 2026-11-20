import {syncStudentIndex} from './student-index.mjs';

const checkpointPath = 'assistantMaintenance/studentDirectoryV1';

// Install the write trigger first. A new account with an ID before the scan
// cursor is then included, and a resumed scan sees renames and deletions safely.
export async function backfillStudentDirectory(store) {
  let state = await store.get(checkpointPath);
  while (!state?.ready) {
    const cursor = state?.cursor || '';
    const users = await store.list('users', [], 100, {
      orderBy: ['__name__', 'asc'], startAfter: cursor, select: [], includeId: true
    });
    for (let offset = 0; offset < users.length; offset += 12) {
      await Promise.all(users.slice(offset, offset + 12).map(({id}) => syncStudentIndex(store, id)));
    }
    const next = {cursor: users.at(-1)?.id || cursor, ready: users.length < 100};
    state = await store.transaction(async tx => {
      const recorded = await tx.get(checkpointPath);
      if (recorded?.ready || (recorded?.cursor || '') !== cursor) return recorded;
      tx.set(checkpointPath, next);
      return next;
    });
  }
}
