import {readConfig} from './adapters.js';
import {Worker} from './worker.js';
import {acquireWorkerLock} from './singleton.js';
const configFile=process.argv[2];if(!configFile)throw Error('Usage: npm start -- <absolute private worker config.json>');
const config=await readConfig(configFile);const stop=new AbortController();for(const s of ['SIGINT','SIGTERM'] as const)process.on(s,()=>stop.abort());
console.log('GTOP controller starting; logs remain in the configured private directory.');
const release=await acquireWorkerLock(config.dataDirectory);
try{await new Worker(config).start(stop.signal);}finally{await release();}
