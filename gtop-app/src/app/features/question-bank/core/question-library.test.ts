import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { bankRevision, validateLibraryEdits, type LibraryEdits } from './question-library.repository';

const written:LibraryEdits={question:'Explain the result.',solutions:['A reasoned worked answer.'],options:[],correctIndex:-1,questionType:'short_answer',marks:2,difficulty:'moderate',referenceUsed:'Textbook'};
describe('bank edit safety',()=>{
  it('requires a worked answer and valid marks for written content',()=>{
    expect(validateLibraryEdits(written,true)).toBe('');
    expect(validateLibraryEdits({...written,solutions:['']},true)).toMatch(/answer/);
    expect(validateLibraryEdits({...written,marks:0},true)).toMatch(/Marks/);
    expect(validateLibraryEdits({...written,questionType:'mcq'},true)).toMatch(/written/);
  });
  it('validates objective answers independently of paper-only storage',()=>{
    const objective={...written,questionType:'case_based',options:['Yes','No'],correctIndex:1};
    expect(validateLibraryEdits(objective,false)).toBe('');
    expect(validateLibraryEdits({...objective,correctIndex:3},false)).toMatch(/correct/);
    expect(validateLibraryEdits({...objective,options:['Yes',' yes ']},false)).toMatch(/distinct/);
  });
  it('detects simultaneous edits and changed approval state',()=>{
    const before=bankRevision({...written,reviewStatus:'approved-paper-only'});
    expect(bankRevision({...written,reviewStatus:'archived'})).not.toBe(before);
    expect(bankRevision({...written,solutions:['Corrected answer'],reviewStatus:'approved-paper-only'})).not.toBe(before);
  });
});
