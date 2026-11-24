const productionOrigins = new Set([
    'https://gtop.growthtutorials.in',
    'https://gtop-app.web.app',
    'https://gtop-app.firebaseapp.com',
]);

export const useEmulators = typeof location !== 'undefined' && !productionOrigins.has(location.origin);
export const emulatorProject = 'demo-gtop-assistant';
export const diagramEmulatorOrigin = 'http://127.0.0.1:9199';
export const localPaperContentPolicy = `default-src 'none'; img-src ${diagramEmulatorOrigin} data:; style-src 'unsafe-inline'; font-src 'self' http://127.0.0.1:4300`;

export function allowedPaperImage(url: string): boolean {
    if (!useEmulators) return /^https:\/\//i.test(url);
    try {
        const parsed = new URL(url);
        return parsed.origin === diagramEmulatorOrigin && parsed.pathname.startsWith(`/v0/b/${emulatorProject}.appspot.com/o/`);
    } catch { return false; }
}
export const paperGatewayUrl = useEmulators
    ? `http://127.0.0.1:5001/${emulatorProject}/us-central1/paperGateway`
    : 'https://us-central1-gtop-app.cloudfunctions.net/paperGateway';
export const assistantGatewayUrl = useEmulators
    ? `http://127.0.0.1:5201/${emulatorProject}/us-central1/gtopAssistantGateway`
    : 'https://us-central1-gtop-app.cloudfunctions.net/gtopAssistantGateway';
