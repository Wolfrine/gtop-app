import { Conversation, ConversationDetail, Job, Message, PaperSummary, Transport, LibraryItem } from './contracts';
import actualQ6 from './fixtures/actual-local-q6-reply.json';

// Development-only, localhost-only visual fixtures. Angular production replaces this entire file.
export function getDevTransport():{transport:Transport;scenario:string}|null {
  const scenario=new URLSearchParams(location.search).get('fixture');
  if(!['localhost','127.0.0.1','[::1]'].includes(location.hostname) || !scenario)return null;
  if(!['empty','working','replying','ready','offline','error','long','clarify','revisions','retry-chain','formatting','math','hindi','library','library-empty','library-error','library-loading'].includes(scenario))return null;
  return {transport:new FixtureTransport(scenario),scenario};
}
class FixtureTransport implements Transport {
  private stamp=new Date().toISOString();
  private conversation:Conversation={id:'preview-conversation',title:'Class 12 Chemistry · full syllabus',status:'active',updatedAt:this.stamp};
  private messages:Message[]=[];
  private jobs:Job[]=[];
  private papers:PaperSummary[]=[];
  constructor(private scenario:string) {
    if(scenario==='empty')return;
    this.messages=[this.message('user','Create a full-syllabus Class 12 Chemistry practice paper for 80 marks. Include internal choices and separate worked answers.'),this.message('assistant',scenario==='clarify'?'I can help with that. Would you like the worked answers in English, Hindi or Hinglish?':'I’ll prepare an 80-mark Growth Tutorials practice paper covering all 10 chapters, with internal choices and separate worked answers in English. This is a custom practice paper; the official CBSE theory paper is 70 marks.')];
    if(scenario==='formatting')this.messages=[this.message('user','Keep **my original wording** and <b>literal markup</b> unchanged.'),this.message('assistant','**Your paper details**\nI can help you refine these requirements.\n\n* **Class:** 12 Chemistry\n* **Marks:** 80\n- Answers in हिन्दी or Hinglish are available.\n\nLiteral untrusted text stays visible:\n<img src=x onerror="alert(1)">\n<script>alert(2)</script>\n[unsafe link](javascript:alert(3))')];
    if(scenario==='math')this.messages=[this.message('user',actualQ6.request.text),this.message('assistant',actualQ6.text),this.message('assistant',String.raw`**Additional synthetic rendering checks**

Malformed math stays literal: $\frac{1}{$
Untrusted commands stay literal: $\href{javascript:alert(1)}{bad}$
Literal HTML stays inert: <img src=x onerror="alert(1)">` )];
    if(scenario==='hindi'){this.conversation.title='Class 10 Mathematics · Geometry';this.messages=[this.message('user','कक्षा 10 गणित का 80 अंकों का प्रश्नपत्र बनाइए। ज्यामिति और निर्देशांक ज्यामिति के सभी विषय शामिल करें। उत्तर अलग रखिए।'),this.message('assistant','ज़रूर। दोनों अध्यायों के सभी विषय शामिल करूँगा और उत्तर अलग रखूँगा। यह किस बोर्ड के लिए है?'),this.message('user','CBSE. Paper English mein, answers Hindi mein samjhana. बाकी वही रखें।'),this.message('assistant','ठीक है—CBSE कक्षा 10 गणित, 80 अंक। प्रश्न अंग्रेज़ी में और अलग उत्तर हिन्दी में होंगे।')];}
    if(scenario==='long')this.messages.push(this.message('user','Please make the reasoning questions more challenging, but keep the marks and syllabus coverage the same.'),this.message('assistant','I’ll preserve the total marks and chapter coverage while making the reasoning more demanding. I’ll keep your existing paper unchanged and create a new revision.\n\nFor the Electrochemistry questions, I’ll ask students to connect cell potential with reaction feasibility. In Coordination Compounds, I’ll include interpretation of structures and bonding. The worked answers will explain the reasoning as well as award marks for each step.\n\nYou can continue discussing changes here while the paper is being prepared.'));
    if(scenario==='working'||scenario==='offline')this.jobs=[this.job(scenario==='offline'?'queued':'running',scenario==='offline'?'queued':'reviewing')];
    if(scenario==='replying')this.jobs=[{...this.job('running','local_conversation'),kind:'turn'}];
    if(scenario==='error')this.jobs=[{...this.job('failed','generating'),error:'The connection was interrupted before the paper finished. No incomplete paper was published.'}];
    if(scenario==='retry-chain')this.jobs=[{...this.job('failed','generating'),id:'preview-original',error:'The first attempt did not finish.'},{...this.job('failed','generating'),id:'preview-retry-1',error:'An earlier retry did not finish.'},{...this.job('failed','generating'),id:'preview-retry-2',error:'The latest attempt was interrupted. You can try again.'}];
    if(scenario==='ready'||scenario==='long'||scenario==='revisions'||scenario.startsWith('library')){
      this.papers=[{id:'preview-paper',title:'Class 12 Chemistry · Practice paper',revision:1,marks:80,createdAt:this.stamp,jobId:'preview-job'}];
      this.jobs=[{...this.job('review_required','completed'),paperId:'preview-paper'}];
      this.messages.push({...this.message('assistant','Your paper and separate worked answers are ready for your review. Please check the educational content before sharing with students.'),paperId:'preview-paper'});
      if(scenario==='revisions'){this.papers.push({...this.papers[0],id:'preview-paper-2',revision:2});this.messages.push(this.message('user','Make question 6 more challenging without changing its marks.'),this.message('assistant','Revision 2 is ready. Question 6 and its worked answer have been updated; the earlier paper is preserved.'))}
    }
    this.conversation.activePaperJobId=this.jobs.filter(job=>job.kind==='paper').at(-1)?.id;
  }
  private message(role:'user'|'assistant',text:string):Message{return {id:crypto.randomUUID(),conversationId:this.conversation.id,role,text,createdAt:this.stamp};}
  private job(state:string,phase:string):Job{return{id:'preview-job',kind:'paper',ownerUid:'preview-only',conversationId:this.conversation.id,state,phase,createdAt:this.stamp,updatedAt:this.stamp,elapsedSeconds:68};}
  private libraryItems(kind:string):LibraryItem[]{
    const papers:LibraryItem[]=[
      {id:'library-paper-own',title:'CBSE Class 12 Chemistry · 80 marks',revision:2,marks:80,createdAt:this.stamp,jobId:'preview-job',conversationId:this.conversation.id,ownerUid:'preview-only',creatorName:'Aparna',board:'CBSE',standard:'12',subject:'Chemistry',academicYear:'2026-27'},
      {id:'library-paper-maths',title:'ICSE Class 5 Mathematics · Fractions and everyday applications',revision:1,marks:50,createdAt:'2026-10-23T09:00:00.000Z',jobId:'library-job-other',conversationId:'library-conversation-other',ownerUid:'preview-other',creatorName:'Riya Rao',board:'ICSE',standard:'5',subject:'Mathematics',academicYear:'2026-27'},
      {id:'library-paper-science',title:'CBSE Class 10 Science · Full syllabus practice paper with worked answers',revision:3,marks:80,createdAt:'2026-10-22T09:00:00.000Z',jobId:'library-job-science',conversationId:'library-conversation-science',ownerUid:'preview-other',creatorName:'Riya Rao',board:'CBSE',standard:'10',subject:'Science',academicYear:'2026-27'},
      {id:'library-paper-chemistry',title:'ISC Class 12 Chemistry · Revision practice',revision:1,marks:70,createdAt:'2026-10-21T09:00:00.000Z',jobId:'library-job-chemistry',conversationId:'library-conversation-chemistry',ownerUid:'preview-only',creatorName:'Aparna',board:'ISC',standard:'12',subject:'Chemistry',academicYear:'2026-27'}
    ];
    return kind==='papers'?papers:papers.map(p=>({...p,id:p.conversationId!,status:'active',updatedAt:p.createdAt,latestPaperId:p.id}));
  }
  async request<T>(path:string,method='GET',body:any={}):Promise<T> {
    await new Promise(resolve=>setTimeout(resolve,130));
    let result:unknown;
    if(path==='/admin/library'){
      if(this.scenario==='library-loading')await new Promise(resolve=>setTimeout(resolve,3500));
      if(this.scenario==='library-error')throw Error('The library could not be loaded. Please try again.');
      const items=this.scenario==='library-empty'?[]:this.libraryItems(body.kind);result={items:body.cursor?items.slice(3):items.slice(0,3),nextCursor:!body.cursor&&items.length>3?'preview-page-2':null};
    }
    else if(path.startsWith('/admin/conversations/')){
      const id=decodeURIComponent(path.split('/').at(-1)!);const item=this.libraryItems('conversations').find(item=>item.id===id);
      if(!item)throw Error('Conversation unavailable.');
      const own=item.ownerUid==='preview-only';
      const paper=this.libraryItems('papers').find(paper=>paper.conversationId===id)!;
      result={conversation:{...this.conversation,...item},messages:own?this.messages:[{...this.message('user','Create a 50-mark Class 5 Mathematics paper on fractions, with separate answers.'),conversationId:id},{...this.message('assistant','Your practice paper and separate answers are ready. Please review them before sharing with students.'),conversationId:id}],jobs:[],papers:[paper],readOnly:!own,creatorName:item.creatorName};
    }
    else if(path==='/session')result={user:{uid:'preview-only',displayName:'Aparna',email:'preview@example.invalid',libraryAccess:true},worker:{state:this.scenario==='offline'?'offline':'ready',modelReady:this.scenario!=='offline',lastSeenAt:this.stamp},capabilities:[],defaults:{}};
    else if(path==='/conversations' && method==='GET')result={conversations:this.scenario==='empty'?[]:[this.conversation]};
    else if(path==='/conversations' && method==='POST'){this.messages=[];this.jobs=[];this.papers=[];this.conversation={...this.conversation,id:crypto.randomUUID(),title:'New conversation'};result={conversation:this.conversation};}
    else if(path.endsWith('/messages')){const message=this.message('user',body.text);this.messages.push(message);const job={...this.job('queued','queued'),kind:'turn' as const};this.jobs=[...this.jobs,job];result={message,job};}
    else if(path.endsWith('/cancel')){this.jobs=this.jobs.map(j=>({...j,state:'cancelled'}));result={job:this.jobs[0]};}
    else if(path.endsWith('/retry')){this.jobs=this.jobs.map(j=>({...j,state:'queued',phase:'queued',error:undefined}));result={job:this.jobs[0]};}
    else if(path==='/feedback')result={saved:true};
    else result={conversation:this.conversation,messages:this.messages,jobs:this.jobs,papers:this.papers} satisfies ConversationDetail;
    return result as T;
  }
  async adminArtifact(id:string,kind:'student'|'answers'):Promise<string>{return this.artifact(id,kind);}
  async artifact(id:string,kind:'student'|'answers'):Promise<string> {
    if(this.scenario.startsWith('library')){
      const item=this.libraryItems('papers').find(item=>item.id===id)||this.libraryItems('papers')[0];
      return `<!doctype html><html><head><meta charset="utf-8"><title>Library document fixture</title><style>body{font:16px/1.8 Georgia,serif;max-width:700px;margin:40px auto;padding:0 22px;color:#183d4e}h1{font-size:22px;text-align:center}header{border-bottom:1px solid #cdd9df;padding-bottom:20px}small{color:#6c7e89}@media print{body{margin:0;padding:0}}</style></head><body><header><small>LOCAL SYNTHETIC LIBRARY DOCUMENT · layout testing only</small><h1>${item.title}<br>${kind==='answers'?'Worked answers':'Question paper'}</h1><p>Class ${item.standard} · ${item.subject} · ${item.marks} marks</p></header><h2>Sample ${kind==='answers'?'worked answer':'question'}</h2><p>This clearly labelled document exercises read-only library viewing and printing. It is not a complete or validated educational paper.</p></body></html>`;
    }
    const longContent=this.scenario==='long'?Array.from({length:24},(_,i)=>`<section style="break-inside:avoid;margin:26px 0"><h2>${i+4}. Synthetic long-content question · [3 marks]</h2>${kind==='student'?'<p>Explain the relationship between the change in Gibbs energy and the electromotive force of an electrochemical cell. Include the sign convention for ΔG° = −nFE° and distinguish standard from non-standard conditions.</p><p style="text-align:center"><b>OR</b></p><p>एक विद्युत रासायनिक सेल के उदाहरण से समझाइए कि मानक इलेक्ट्रोड विभव अभिक्रिया की दिशा के बारे में क्या बताता है।</p>':'<p><b>Step 1 · Establish the relationship.</b> The expression ΔG° = −nFE° relates the standard Gibbs energy change to the standard cell potential. Here n is the number of electrons transferred and F is the Faraday constant. Keep the sign and unit conventions explicit.</p><p><b>Step 2 · Interpret the result.</b> A positive standard cell potential corresponds to a negative standard Gibbs energy change. Explain the conditions before drawing a conclusion about the direction of reaction. This deliberately lengthy paragraph exercises multi-line answer rendering and page breaks rather than validating Chemistry content.</p><p><b>उत्तर की व्याख्या:</b> विद्यार्थी को समीकरण, संकेत और भौतिक अर्थ को अलग-अलग स्पष्ट करना चाहिए। Hinglish explanation: pehle standard conditions identify karo, phir sign convention samjhao, aur last mein conclusion likho. [Illustrative marking points: equation 1, explanation 1, conclusion 1.]</p>'}</section>`).join(''):'';
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Local visual fixture</title><style>body{font:16px Georgia,serif;color:#13212a;max-width:700px;margin:45px auto;padding:0 28px;line-height:1.7}h1{text-align:center;font-size:22px}small{color:#586774}header{border-bottom:1px solid #24394a;padding-bottom:20px}.meta{display:flex;justify-content:space-between}li{padding:14px 0}mark{background:#fff1d0} @media print{body{margin:0;max-width:none}mark{background:none}}</style></head><body><mark>LOCAL VISUAL FIXTURE — not an educationally validated paper</mark><header><h1>GROWTH TUTORIALS<br>Class 12 · Chemistry<br>${kind==='answers'?'Worked answers':'Practice question paper'}</h1><div class="meta"><span>Time: 3 hours</span><b>Maximum marks: 80</b></div><small>Custom practice paper · English · Full syllabus</small></header><h2>${kind==='answers'?'Worked answers · Section A':'General instructions'}</h2>${kind==='student'?'<p>Attempt all questions. Where an internal choice is provided, answer either alternative.</p><h2>Section A · One-mark questions</h2>':''}<ol><li>${kind==='answers'?'For an ideal solution, Raoult’s law states that the partial vapour pressure of a component is proportional to its mole fraction.':'State Raoult’s law for an ideal solution. <b>[1]</b>'}</li><li>${kind==='answers'?'The standard cell potential is the cathode potential minus the anode potential.':'How is the standard potential of an electrochemical cell calculated? <b>[1]</b>'}</li><li>${kind==='answers'?'The half-life of a first-order reaction does not depend on the initial concentration.':'For a first-order reaction, how does half-life depend on initial concentration? <b>[1]</b>'}</li></ol>${longContent}<p><small>This synthetic document exercises layout and printing only. Real documents come from the authenticated gateway.</small></p></body></html>`;
  }
}
