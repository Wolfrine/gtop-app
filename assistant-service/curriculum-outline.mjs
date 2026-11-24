import {MemoryStore} from './store.mjs';

export async function readCurriculumOutline(store, boardDefinitions) {
  if(store instanceof MemoryStore){
    const rows=await store.list('syllabus',[],5001),scopes=[];
    for(const {board,standard,subject,chapter} of rows){
      if(!subject||!chapter||!boardDefinitions.some(definition=>definition.name===board&&definition.standards.includes(Number(standard))))continue;
      scopes.push({board,standard:String(standard),subject,chapters:1});
    }
    return {scopes,documentReads:0,countQueries:0,countedEntries:0};
  }
    const source=store.db.collection('syllabus');
    return store.db.runTransaction(async transaction=>{
      let documentReads=0, countQueries=0, countedEntries=0, probes=0;
      const byBoard=await Promise.all(boardDefinitions.map(async board=>{
        const catalogue=source.where('board','==',board.name)
          .orderBy('standard').orderBy('subject').orderBy('chapter');
        const scopes=[];
        let cursor;
        while(++probes<=384){
          const next=await transaction.get((cursor?catalogue.startAfter(...cursor):catalogue)
            .limit(1).select('standard','subject'));
          documentReads+=Math.max(1,next.size);
          if(next.empty)return scopes;
          const {standard,subject}=next.docs[0].data();
          cursor=[standard,subject];
          if(typeof subject!=='string'||!subject||!board.standards.includes(Number(standard)))continue;
          const count=await transaction.get(source.where('board','==',board.name)
            .where('standard','==',standard).where('subject','==',subject)
            .where('chapter','>','').limit(501).count());
          const chapters=count.data().count;
          countQueries++;countedEntries+=chapters;
          if(chapters>500)throw Error('Curriculum subject exceeds its catalogue count budget.');
          if(chapters)scopes.push({board:board.name,standard:String(standard),subject,chapters});
        }
        throw Error('Curriculum catalogue exceeds its distinct-scope budget.');
      }));
      return {scopes:byBoard.flat(),documentReads,countQueries,countedEntries};
    },{readOnly:true});
}
