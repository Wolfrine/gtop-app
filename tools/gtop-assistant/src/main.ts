import {readPaperConfig} from './adapters.js';
import {Worker} from './worker.js';
import {acquireWorkerLock} from './singleton.js';
import path from 'node:path';
const [configFile,paperProfile]=process.argv.slice(2);
if(!configFile||!paperProfile||!path.isAbsolute(configFile)||!path.isAbsolute(paperProfile))throw Error('Usage: npm start -- <absolute private worker config.json> <absolute Papers runtime profile.json>');
const config=await readPaperConfig(configFile,paperProfile);const stop=new AbortController();for(const s of ['SIGINT','SIGTERM'] as const)process.on(s,()=>stop.abort());
console.log('GTOP controller starting; logs remain in the configured private directory.');
const release=await acquireWorkerLock(config.dataDirectory);
try{await new Worker(config).start(stop.signal);}finally{await release();}
