import {HttpError} from './service.mjs';
import {directoryCollection, namePrefixes, normalizeName, profileFields, searchLimit, studentSummary} from './student-index.mjs';

const pageSize = 12;

function checkUid(uid) {
  if (typeof uid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) {
    throw new HttpError(400, 'invalid_student', 'Select a GTOP student.');
  }
}

export async function getStudent(store, uid) {
  checkUid(uid);
  const [profile] = await store.getSelected(['users/' + uid], profileFields);
  const student = studentSummary(uid, profile);
  if (!student) throw new HttpError(404, 'student_unavailable', 'This GTOP student is unavailable.');
  return student;
}

export async function resolveStudent(store, studentUid) {
  const {displayName: studentLabel} = await getStudent(store, studentUid);
  return {studentUid, studentLabel};
}

export async function searchStudents(store, query, cursor) {
  const prefix = typeof query === 'string' ? normalizeName(query) : '';
  const length = Array.from(prefix).length;
  if (length < 2 || length > searchLimit) {
    throw new HttpError(400, 'invalid_student_query', 'Enter 2–' + searchLimit + ' characters of the student’s name.');
  }
  if (cursor) checkUid(cursor);
  const entries = await store.list(directoryCollection, [['prefixes', 'array-contains', prefix]], pageSize + 1, {
    orderBy: ['__name__', 'asc'], startAfter: cursor, includeId: true, select: []
  });
  const ids = entries.slice(0, pageSize).map(entry => entry.id);
  const profiles = await store.getSelected(ids.map(uid => 'users/' + uid), profileFields);
  const students = ids.flatMap((uid, index) => {
    const student = studentSummary(uid, profiles[index]);
    return student && namePrefixes(student.displayName).includes(prefix) ? [student] : [];
  });
  students.sort((a, b) => a.displayName.localeCompare(b.displayName) || a.uid.localeCompare(b.uid));
  const hasMore = entries.length > pageSize;
  return {students, hasMore, nextCursor: hasMore ? ids.at(-1) : null};
}
