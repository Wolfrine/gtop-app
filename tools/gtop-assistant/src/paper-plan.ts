import {object, questionSchema} from '../../../assistant-service/domain/schemas.mjs';

type QuestionType = 'mcq' | 'assertion_reason' | 'short_answer' | 'long_answer' | 'numerical' | 'case_based';
export interface ShapeQuestion { marks: number; type: QuestionType; alternative: boolean; }
export interface PlannedQuestion extends ShapeQuestion { number: number; chapter: string; }
interface ShapeSection { title: string; attemptCount: number; questions: ShapeQuestion[]; }
interface PlannedSection extends ShapeSection { questions: PlannedQuestion[]; }
export interface PaperPlan { sections: PlannedSection[]; }
export class PaperStageError extends Error {
  constructor(public code: 'paper_scope_infeasible' | 'paper_draft_invalid' | 'paper_generation_timeout' | 'paper_delivery_unavailable', message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

const type = questionSchema.properties.type;
export const shapeSchema = object({
  sections: {type:'array', items:object({
    title:{type:'string'},
    attemptCount:{type:'integer'},
    questions:{type:'array', items:object({marks:{type:'integer'}, type, alternative:{type:'boolean'}})}
  })}
});

function defaultSection(title: string, count: number, marks: number, type: QuestionType): ShapeSection {
  return {title, attemptCount:count, questions:Array.from({length:count},()=>({marks,type,alternative:false}))};
}

function practiceShape(requirements: any, chapters: number): ShapeSection[] {
  const {marks,board,standard,subject,questionLanguage} = requirements;
  const english = questionLanguage !== 'Hindi';
  const titles = english
    ? ['Objective Questions','Short Answer Questions','Short Answer Questions','Case-Based Questions','Long Answer Questions']
    : ['वस्तुनिष्ठ प्रश्न','लघु उत्तरीय प्रश्न','लघु उत्तरीय प्रश्न','प्रकरण-आधारित प्रश्न','दीर्घ उत्तरीय प्रश्न'];
  const types: QuestionType[] = ['mcq','short_answer','short_answer','case_based','long_answer'];
  const chemistry70 = board==='CBSE' && String(standard)==='12' && subject==='Chemistry' && marks===70;
  let counts: number[];
  if (chemistry70) counts = [16,5,7,2,3];
  else {
    const objective = Math.max(1, Math.floor(marks * 0.24));
    const short2 = Math.floor(marks * 0.14 / 2);
    const short3 = Math.max(1, Math.floor(marks * 0.28 / 3));
    const cases = Number(standard) >= 8 && marks >= 35 ? Math.max(1,Math.floor(marks * 0.12 / 4)) : 0;
    const long = Math.floor((marks - objective - short2*2 - short3*3 - cases*4) / 5);
    counts = [marks - short2*2 - short3*3 - cases*4 - long*5, short2, short3, cases, long];
  }
  // Add more groups when broad scope would otherwise leave a chapter unrepresented.
  let questionCount = counts.reduce((sum,count)=>sum+count,0);
  for (let index=counts.length-1; index>0 && questionCount<chapters; index--) {
    while (counts[index]>0 && questionCount<chapters) {
      counts[index]--;
      counts[0]+=index+1;
      questionCount+=index;
    }
  }
  const sections = counts.map((count,index)=>defaultSection(titles[index],count,index+1,types[index]));
  if (chemistry70 && counts[0]===16) {
    for (const question of sections[0].questions.slice(12)) question.type='assertion_reason';
  }
  return sections.filter(section=>section.questions.length);
}

function officialShape(pattern: any): ShapeSection[] {
  return pattern.sections.map((section: any,index: number)=>{
    const {questionCount,attemptCount,attemptedMarks} = section;
    const marks = Math.floor(attemptedMarks/attemptCount);
    const typeFor = (value: number): QuestionType => value===1?'mcq':value>=4?'long_answer':'short_answer';
    const questions = Array.from({length:questionCount},(_,offset)=>{
      const allocation = marks + Number(offset < attemptedMarks%attemptCount);
      return {marks:allocation,type:typeFor(allocation),alternative:false};
    });
    return {title:section.title || 'Section '+String.fromCharCode(65+index),attemptCount,questions};
  });
}

export function paperPlan(requirements: any, pinned: any, proposed?: {sections: ShapeSection[]}): PaperPlan {
  const fail = (message: string): never => { throw new PaperStageError('paper_scope_infeasible',message); };
  const pattern = requirements.format==='board' ? pinned.paperPattern : null;
  if (requirements.format==='board' && (!pattern || pattern.academicYear!==requirements.academicYear || pattern.marks!==requirements.marks || pattern.durationMinutes!==requirements.durationMinutes)) {
    fail('No pinned board pattern matches these marks, duration and year.');
  }
  const sections: ShapeSection[] = structuredClone(proposed?.sections ?? (pattern?officialShape(pattern):practiceShape(requirements,pinned.chapters.length)));
  const questions = sections.flatMap(section=>section.questions);
  if (!sections.length || sections.length>12 || !questions.length || questions.length>100 || (pattern && sections.length!==pattern.sections.length)) {
    fail('The required section and question counts cannot be represented.');
  }
  let total=0;
  for (const [index,section] of sections.entries()) {
    const expected = pattern?.sections[index];
    const {title,attemptCount,questions} = section;
    if (!title.trim() || title.length>180 || !questions.length || attemptCount<1 || attemptCount>questions.length ||
        (!pattern && attemptCount!==questions.length) ||
        questions.some(question=>!Number.isInteger(question.marks)||question.marks<1||question.marks>20)) {
      fail('A section has invalid marks or attempt rules.');
    }
    const choices = attemptCount<questions.length;
    if (choices && new Set(questions.map(question=>question.marks)).size!==1) fail('Optional questions must carry equal marks.');
    const marks = choices ? attemptCount*questions[0].marks : questions.reduce((sum,question)=>sum+question.marks,0);
    if (expected && (expected.questionCount!==questions.length || expected.attemptCount!==attemptCount || expected.attemptedMarks!==marks)) {
      fail('The planned section does not match the pinned board pattern.');
    }
    total+=marks;
  }
  const chapters: string[] = pinned.chapters.map((chapter: any)=>chapter.title);
  if (total!==requirements.marks) fail('The planned marks do not match the required attempted total.');
  if (!chapters.length || chapters.length>questions.length) fail('The requested number of question groups cannot cover every pinned chapter.');
  const style=String(requirements.questionStyle||'').trim();
  const objective=(question:ShapeQuestion)=>question.type==='mcq'||question.type==='assertion_reason';
  const exclusive=style.match(/^(mcqs?(?:\s+questions?)?|(?:objective|multiple[\s-]+choice|subjective)(?:\s+questions?)?)\s+only$/i)?.[1].toLowerCase();
  if (exclusive) {
    const isAllowed=exclusive.startsWith('subjective')?(question:ShapeQuestion)=>!objective(question):
      exclusive.startsWith('objective')?objective:(question:ShapeQuestion)=>question.type==='mcq';
    if (!questions.every(isAllowed)) {
      throw new PaperStageError('paper_draft_invalid','The plan contains questions outside the requested exclusive style.');
    }
  } else {
    if (/\bcase[ -]+based\b/i.test(style)&&!questions.some(question=>question.type==='case_based')) {
      throw new PaperStageError('paper_draft_invalid','The section plan omitted the requested case-based style.');
    }
    if (/\b(?:mcq|objective|multiple[ -]choice)\b/i.test(style)&&!questions.some(objective)) {
      throw new PaperStageError('paper_draft_invalid','The section plan omitted the requested objective style.');
    }
  }
  if (!requirements.internalChoices && questions.some(question=>question.alternative)) fail('The plan contains unrequested internal choices.');
  if (requirements.internalChoices && !questions.some(question=>question.alternative)) {
    // A whole-question OR shares its slot and never changes attempted marks.
    for (const section of sections.filter(section=>section.questions.some(question=>question.marks>1)).slice(-3)) {
      section.questions[Math.floor(section.questions.length/2)].alternative=true;
    }
    if (!questions.some(question=>question.alternative)) questions.at(-1)!.alternative=true;
  }

  // Spread offered marks across chapters without treating syllabus topic weights
  // as fixed paper weights. Give each chapter a slot before reusing a chapter.
  const allocated=chapters.map((chapter,index)=>({chapter,index,marks:0}));
  const chapterFor=new Map<ShapeQuestion,string>();
  for (const question of questions.slice().sort((a,b)=>b.marks-a.marks)) {
    const next=allocated.reduce((current,candidate)=>candidate.marks<current.marks || (candidate.marks===current.marks && candidate.index<current.index)?candidate:current);
    chapterFor.set(question,next.chapter);
    next.marks+=question.marks;
  }
  let number=0;
  return {sections:sections.map(({title,attemptCount,questions})=>({
    title,attemptCount,questions:questions.map(question=>({...question,number:++number,chapter:chapterFor.get(question)!}))
  }))};
}

export function questionBatches(plan: PaperPlan): PlannedQuestion[][] {
  const batches: PlannedQuestion[][] = [];
  for (const section of plan.sections) {
    let batch: PlannedQuestion[] = [];
    let weight=0;
    for (const question of section.questions) {
      const next=(question.marks>2?2:1)+Number(question.alternative);
      if (batch.length && (weight+next>6 || batch.length>=5)) {
        batches.push(batch);
        batch=[];
        weight=0;
      }
      batch.push(question);
      weight+=next;
    }
    if(batch.length) batches.push(batch);
  }
  return batches;
}

export function assemblePaper(plan: PaperPlan, pinned: any, requirements: any, questions: Map<number, any>) {
  const english = requirements.questionLanguage!=='Hindi';
  const copy = Object.fromEntries(['board','standard','subject','academicYear','scope','marks','durationMinutes','questionLanguage','answerLanguage'].map(key=>[key,requirements[key]??pinned[key]]));
  const selective=plan.sections.some(section=>section.attemptCount<section.questions.length);
  const instructions=english
    ? [selective?'Follow the instructions for each section.':'All numbered questions are compulsory.', 'Show your working where required.']
    : [selective?'हर खंड के निर्देशों का पालन करें।':'सभी क्रमांकित प्रश्न अनिवार्य हैं।','जहाँ आवश्यक हो, गणना के चरण दिखाएँ।'];
  if (requirements.internalChoices) instructions.push(english?'Where a question gives an OR choice, answer either alternative.':'जहाँ किसी प्रश्न में विकल्प दिया गया है, उसका एक विकल्प हल करें।');
  return {
    ...copy,
    title:english?requirements.subject+' Question Paper':requirements.subject+' प्रश्नपत्र',
    instructions,
    sections:plan.sections.map((section,index)=>({
      title:(english?'Section ':'खंड ')+String.fromCharCode(65+index)+' · '+section.title.trim(),
      instructions:english?'Marks are shown against each question.':'हर प्रश्न के अंक उसके सामने दिए गए हैं।',
      attemptCount:section.attemptCount,
      questions:section.questions.map(question=>questions.get(question.number))
    })),
    sourceReferences:[{id:pinned.id,url:pinned.url,title:String(pinned.title||'Selected GTOP curriculum').slice(0,250)}]
  };
}
