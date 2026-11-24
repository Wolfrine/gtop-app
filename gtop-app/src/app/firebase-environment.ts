const productionOrigins = new Set([
    'https://gtop.growthtutorials.in',
    'https://gtop-app.web.app',
    'https://gtop-app.firebaseapp.com',
]);

export const useEmulators = !productionOrigins.has(location.origin);
export const emulatorProject = 'demo-gtop-assistant';
export const paperGatewayUrl = useEmulators
    ? `http://127.0.0.1:5001/${emulatorProject}/us-central1/paperGateway`
    : 'https://us-central1-gtop-app.cloudfunctions.net/paperGateway';
export const assistantGatewayUrl = useEmulators
    ? `http://127.0.0.1:5201/${emulatorProject}/us-central1/gtopAssistantGateway`
    : 'https://us-central1-gtop-app.cloudfunctions.net/gtopAssistantGateway';
