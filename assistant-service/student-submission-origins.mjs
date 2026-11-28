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

const isGtopOrigin = (origin, emulated) => learnerSites.has(origin) || (emulated && emulatorSites.has(origin));

export function allowsStudentOrigin(origin, path, emulated) {
  const endpoint = path.split('?')[0].replace(/^\/api(?=\/|$)/u, '');
  const studentEndpoint = /^\/student-submissions(?:\/|$)/u.test(endpoint);
  return studentEndpoint && isGtopOrigin(origin, emulated);
}

export function allowsStaffResultsOrigin(origin, method, path, emulated) {
  if (method !== 'GET' || !isGtopOrigin(origin, emulated)) return false;
  const [raw, query] = path.split('?');
  const endpoint = raw.replace(/^\/api(?=\/|$)/u, '').replace(/\/$/u,'');
  return (endpoint === '/staff/student-submissions' && new URLSearchParams(query).get('status') === 'released') ||
    /^\/staff\/student-submissions\/[a-z0-9_-]+\/(?:result|report)$/iu.test(endpoint);
}
