// Local execution sandbox supports loopback TCP, but not filesystem Unix sockets.
// Adapt only Firebase CLI worker transport; handlers/runtime/requests are unchanged.
const base='/root/.npm/_npx/735f5eb4e60f1e66/node_modules/firebase-tools/lib/emulator/';
const shared=require(base+'functionsEmulatorShared.js');
let port=12500;
shared.getTemporarySocketPath=()=>String(port++);
const {IPCConn}=require(base+'functionsEmulator.js');
IPCConn.prototype.httpReqOpts=function(){return {host:'127.0.0.1',port:Number(this.socketPath)};};
