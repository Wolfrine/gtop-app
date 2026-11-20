// This collection is server-only. Keep the profile itself in users/{uid}.
export const directoryCollection = 'assistantStudentDirectory';
export const searchLimit = 100;
export const profileFields = ['role', 'displayName', 'name', 'board', 'standard', 'email'];

function label(value, max) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value).replace(/\s+/gu, ' ').trim().slice(0, max);
}

export function studentName(profile) {
  if (profile?.role !== 'user') return '';
  return label(profile.displayName, 100) || label(profile.name, 100);
}

export function normalizeName(value) {
  // Retain vowel signs and other marks used in Indian names.
  return value.normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim();
}

export function namePrefixes(name) {
  const fullName = normalizeName(name);
  const prefixes = new Set();
  for (const part of new Set([fullName, ...fullName.split(' ')])) {
    const characters = Array.from(part).slice(0, searchLimit);
    let prefix = '';
    for (const [index, character] of characters.entries()) {
      prefix += character;
      if (index >= 1 && character !== ' ') prefixes.add(prefix);
    }
  }
  return [...prefixes].sort();
}

export function studentSummary(uid, profile) {
  const name = studentName(profile);
  if (!name) return null;
  const email = label(profile.email, 254);
  const address = /^([^@\s]+)@([^@\s]+)$/u.exec(email);
  const masked = address ? Array.from(address[1])[0] + '•••@' + address[2] + ' · ' : '';
  return {
    uid, displayName: name, board: label(profile.board, 80), standard: label(profile.standard, 40),
    accountHint: masked + uid.slice(-6)
  };
}

export async function syncStudentIndex(store, uid) {
  const indexPath = directoryCollection + '/' + uid;
  // Read the current profile in the same transaction as the index write. Replayed
  // or out-of-order events and a concurrent backfill cannot restore an old name.
  await store.transaction(async tx => {
    const [profile, entry] = await Promise.all([
      tx.getSelected(['users/' + uid], ['role', 'displayName', 'name']).then(rows => rows[0]),
      tx.get(indexPath)
    ]);
    const prefixes = namePrefixes(studentName(profile));
    if (!prefixes.length) {
      if (entry) tx.delete(indexPath);
    } else if (!Array.isArray(entry?.prefixes) || prefixes.length !== entry.prefixes.length ||
               prefixes.some((value, i) => value !== entry.prefixes[i])) {
      tx.set(indexPath, {prefixes});
    }
  });
}
