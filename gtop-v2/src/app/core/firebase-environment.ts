import { environment } from '../../environments/environment';

const productionOrigins = new Set([
  'https://gtop.growthtutorials.in',
  'https://gtop-app.web.app',
  'https://gtop-app.firebaseapp.com',
]);

export const useEmulators = !environment.production || environment.uat || !productionOrigins.has(location.origin);
