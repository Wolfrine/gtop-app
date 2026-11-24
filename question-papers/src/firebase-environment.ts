const productionOrigins = new Set([
  'https://gtop-question-papers.web.app',
  'https://gtop-question-papers.firebaseapp.com',
]);

export const useEmulators = !productionOrigins.has(location.origin);
export const emulatorConfig = {
  apiBase: 'http://127.0.0.1:5201/demo-gtop-assistant/us-central1/gtopAssistantGateway',
  firebase: { projectId: 'demo-gtop-assistant', apiKey: 'demo-key', authDomain: 'localhost' },
};
