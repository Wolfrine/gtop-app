import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

const json=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
test('independent manifest identifies this app and provides real install icons',()=>{
  const m=json('../public/manifest.webmanifest');assert.equal(m.id,'/');assert.equal(m.scope,'/');assert.equal(m.start_url,'/');assert.equal(m.short_name,'GT Papers');assert.equal(m.display,'standalone');
  for(const size of [192,512]){const icon=m.icons.find(i=>i.sizes===`${size}x${size}`);assert(icon.purpose.includes('maskable'));const png=readFileSync(new URL('../public'+icon.src,import.meta.url));assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);}
});
test('offline caching is limited to the public shell and never stores private API data',()=>{
  const c=json('../ngsw-config.json');assert.deepEqual(c.dataGroups,[]);assert(c.navigationUrls.includes('!/api/**'));assert(c.navigationUrls.includes('!/__/**'));
  assert.equal(c.assetGroups.length,1);const files=c.assetGroups[0].resources.files;
  assert(files.includes('/index.html'));assert(files.includes('/manifest.webmanifest'));assert(files.includes('/assistant-config.json'));
  assert(!c.assetGroups.some(group=>group.resources.urls));
  for(const pattern of files)assert(!/api|paper(?:s)?\/|conversation|artifact|firebaseio|googleapis|firestore/.test(pattern),pattern);
  const html=readFileSync(new URL('../src/index.html',import.meta.url),'utf8');assert.match(html,/rel="manifest"/);assert.match(html,/apple-touch-icon/);
});

// Exercise the actual controller methods with browser/Angular adapters replaced;
// real service-worker registration and browser rendering are checked separately.
function controls(){
  let versionListener,unrecoverableListener;let reloads=0,focuses=0,unsubscribed=0;
  const draft={value:''};const subscription={unsubscribe(){unsubscribed++;}};
  const sw={isEnabled:true,versionUpdates:{subscribe(fn){versionListener=fn;return subscription;}},unrecoverable:{subscribe(fn){unrecoverableListener=fn;return subscription;}}};
  const decorator=()=>()=>{};const exports={};
  const source=readFileSync(new URL('../src/pwa-controls.ts',import.meta.url),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;
  runInNewContext(code,{exports,require(name){if(name==='@angular/core')return {Component:decorator,HostListener:decorator,ViewChild:decorator,inject:()=>sw};return {};},matchMedia:()=>({matches:false}),navigator:{onLine:true,userAgent:'Chrome',platform:'Win32',maxTouchPoints:0},document:{querySelector:()=>draft},location:{reload(){reloads++;}}});
  const ui=new exports.GtPwaControls();ui.installAction={nativeElement:{focus(){focuses++;}}};
  return {ui,draft,ready(){versionListener({type:'VERSION_READY'});},failed(){unrecoverableListener();},counts:()=>({reloads,focuses,unsubscribed})};
}

test('updates are offered without automatic reload and preserve an unsent draft',()=>{
  const c=controls();c.ready();assert.equal(c.ui.updateReady,true);assert.equal(c.counts().reloads,0);
  c.draft.value='Change question 4';c.ui.update();assert.equal(c.counts().reloads,0);assert.equal(c.draft.value,'Change question 4');assert.match(c.ui.notice,/draft has not been changed/);
  c.draft.value='';c.ui.update();assert.equal(c.counts().reloads,1);
});

test('native installation is invoked only from the install action',async()=>{
  const c=controls();let prevented=0,prompted=0;
  c.ui.onPrompt({preventDefault(){prevented++;},async prompt(){prompted++;},userChoice:Promise.resolve({outcome:'accepted'})});
  assert.equal(prevented,1);assert.equal(prompted,0);await c.ui.install();assert.equal(prompted,1);
  c.ui.onInstalled();assert.equal(c.ui.installed,true);assert.equal(c.ui.help,false);
});

test('manual install help closes with focus restoration and connection state stays factual',async()=>{
  const c=controls();c.ui.close();assert.equal(c.counts().focuses,0);
  await c.ui.install();assert.equal(c.ui.help,true);c.ui.close();assert.equal(c.ui.help,false);assert.equal(c.counts().focuses,1);
  c.ui.wentOffline();assert.equal(c.ui.offline,true);c.ui.online();assert.equal(c.ui.offline,false);
  c.failed();assert.equal(c.ui.updateReady,true);c.ui.ngOnDestroy();assert.equal(c.counts().unsubscribed,2);
});
