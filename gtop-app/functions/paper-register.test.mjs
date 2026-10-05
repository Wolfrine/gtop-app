import test from 'node:test';
import assert from 'node:assert/strict';
import {searchTokens,isReadyPaper,parseRegisterQuery} from './paper-register.mjs';

test('metadata search preserves complete IDs, Unicode words and historical requirement terms',()=>{
  const tokens=searchTokens(['CELL-ReViSiOn_17','தமிழ் परीक्षा Cells','  No diagrams.  ']);
  for(const expected of ['cell-revision_17','cell','revision','17','தமிழ்','परीक्षा','cells','no','diagrams'])assert(tokens.includes(expected),expected);
});
test('legacy readiness requires a complete persisted paper and current ready papers remain ready',()=>{
  assert(isReadyPaper({status:'ready'}));
  const complete={status:'draft',sections:[{}],marks:20,actualMarks:20,coverage:{gapCount:0}};
  assert(isReadyPaper(complete));
  assert(isReadyPaper({...complete,coverage:undefined}),'Preserve pre-coverage legacy drafts that were already printable.');
  assert(!isReadyPaper({...complete,coverage:{gapCount:1}}));
  assert(!isReadyPaper({...complete,actualMarks:19}));
  assert(!isReadyPaper({...complete,sections:[]}));
  assert(!isReadyPaper({...complete,status:'superseded'}));
});
test('search limits and continuation binding are explicit',()=>{
  const parsed=parseRegisterQuery({q:'cells revision',view:'ready',mine:'1'},'admin');
  assert.equal(parsed.filters.mine,'admin');assert.equal(parsed.limit,30);
  assert.throws(()=>parseRegisterQuery({q:'a b c d e f g h i'},'admin'),/eight/);
  assert.throws(()=>parseRegisterQuery({q:'x'.repeat(241)},'admin'),/240/);
  const cursor=Buffer.from(JSON.stringify({v:1,signature:parsed.signature,time:1,id:'r-123'})).toString('base64url');
  assert(parseRegisterQuery({q:'cells revision',view:'ready',mine:'1',cursor},'admin').cursor);
  assert.throws(()=>parseRegisterQuery({q:'cells revision',view:'ready',mine:'1',cursor},'other'),/different search/);
  assert.throws(()=>parseRegisterQuery({q:'cells',cursor},'admin'),/different search/);
  const global=parseRegisterQuery({q:'cells'},'admin');
  const globalCursor=Buffer.from(JSON.stringify({v:1,signature:global.signature,time:1,id:'r-123'})).toString('base64url');
  assert.throws(()=>parseRegisterQuery({q:'cells',cursor:globalCursor},'other'),/different search/);
});
