const learnerSites = new Set([
  'https://gtop.growthtutorials.in',
  'https://gtop-app.web.app',
  'https://gtop-app.firebaseapp.com',
  'https://dev-gtop-app.web.app',
  'https://dev-gtop-app.firebaseapp.com'
]);
const emulatorSites = new Set([
  'http://localhost:4200',
  'http://127.0.0.1:4200'
]);

// GTOP serves the learner flow. Its origin does not open staff or worker APIs.
export function allowsStudentOrigin(origin, path, emulated) {
  const endpoint = path.split('?')[0].replace(/^\/api(?=\/|$)/u, '');
  const studentEndpoint = /^\/student-submissions(?:\/|$)/u.test(endpoint);
  return studentEndpoint && (learnerSites.has(origin) || (emulated && emulatorSites.has(origin)));
}
