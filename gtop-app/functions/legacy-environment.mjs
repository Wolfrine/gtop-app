const demoProject='demo-gtop-assistant';
const configuredProject=process.env.GCLOUD_PROJECT||process.env.GOOGLE_CLOUD_PROJECT;
export const localLegacy=process.env.FUNCTIONS_EMULATOR==='true'||configuredProject?.startsWith('demo-')||!!process.env.FIRESTORE_EMULATOR_HOST;
const isLoopback=(value,port)=>['127.0.0.1','localhost','[::1]'].some(host=>value===`${host}:${port}`||value===`http://${host}:${port}`);

if(localLegacy&&(configuredProject!==demoProject||!isLoopback(process.env.FIRESTORE_EMULATOR_HOST,8080)||
  !isLoopback(process.env.FIREBASE_AUTH_EMULATOR_HOST,9099)||
  !isLoopback(process.env.FIREBASE_STORAGE_EMULATOR_HOST,9199)||
  !isLoopback(process.env.STORAGE_EMULATOR_HOST,9199))){
  throw Error('Legacy Paper Chat requires the demo project and loopback Firestore, Auth and Storage emulators.');
}

export const legacyBucket=localLegacy?`${demoProject}.appspot.com`:'gtop-app.firebasestorage.app';
const localStorage='http://127.0.0.1:9199';
export const legacyAssetBase=localLegacy?localStorage:'https://firebasestorage.googleapis.com';
export const legacyFontRoot=localLegacy?'http://127.0.0.1:4300/assets/paper-fonts/':'https://gtop-app.web.app/assets/paper-fonts/';
export const localPaperPolicy="default-src 'none'; img-src http://127.0.0.1:9199; style-src 'unsafe-inline'; font-src http://127.0.0.1:4300";

export function permittedLegacyDiagram(url){
  if(!localLegacy)return url.protocol==='https:'&&['firebasestorage.googleapis.com','storage.googleapis.com'].includes(url.hostname);
  return url.origin===localStorage&&!url.username&&!url.password&&
    url.pathname.startsWith(`/v0/b/${legacyBucket}/o/paper-assets%2F`)&&url.searchParams.get('alt')==='media'&&!!url.searchParams.get('token');
}
