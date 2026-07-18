import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthStore } from '../core/auth.store';
import { LearningRepository, PracticeFilters } from '../core/learning.repository';
import { Question, QuizAnswer, QuizResult, SyllabusItem, asDate } from '../core/models';
import { QuizSessionState, QuizSessionStore } from '../core/quiz-session.store';

@Component({
  selector: 'app-learner-dashboard',
  imports: [RouterLink],
  template: `
    <div class="page">
      <div class="page-head"><div><p class="eyebrow">Your practice desk</p><h1>Good {{ greeting }}, {{ firstName }}.</h1><p class="lede">Start small, review honestly, and leave each attempt knowing what deserves attention next.</p></div><a class="btn btn-primary" routerLink="/practice">Start practice</a></div>
      <div class="grid grid-3">
        <article class="card stat"><span class="muted small">Recent accuracy</span><p class="stat-value">{{ average() }}%</p><span class="pill" [class.success]="average() >= 70">Across {{ results().length }} attempts</span></article>
        <article class="card stat"><span class="muted small">Questions answered</span><p class="stat-value">{{ answered() }}</p><span class="muted small">Every answer adds useful evidence</span></article>
        <article class="card stat"><span class="muted small">Current context</span><p class="stat-value" style="font-size:23px">{{ auth.profile()?.board || 'Set board' }} · {{ auth.profile()?.standard || '—' }}</p><a class="muted small" routerLink="/profile">Update profile →</a></article>
      </div>
      <section class="section grid grid-2">
        <article class="card">
          <p class="eyebrow">Recommended next</p><h2>{{ recommendation().title }}</h2><p class="muted">{{ recommendation().copy }}</p><div class="button-row"><a class="btn btn-primary" routerLink="/practice">Build this practice</a><a class="btn btn-secondary" routerLink="/reports">Review reports</a></div>
        </article>
        <article class="card">
          <div class="section-head"><div><p class="eyebrow">Recent attempts</p><h3>Your latest evidence</h3></div><a class="muted small" routerLink="/reports">See all →</a></div>
          @if (loading()) { <p class="muted">Loading your practice history…</p> }
          @else if (!results().length) { <div class="empty">Complete your first quiz to start a useful history.</div> }
          @else { @for (result of results().slice(0,4); track result.id) { <div class="attempt-row"><span><strong>{{ result.subject || 'Practice' }}</strong><small>{{ result.chapter || result.quizType }}</small></span><strong>{{ result.percentage }}%</strong></div> } }
        </article>
      </section>
      <section class="section"><div class="section-head"><div><p class="eyebrow">Ways to practise</p><h2>Choose the energy you need today.</h2></div></div><div class="grid grid-3"><a class="card card-hover" routerLink="/practice"><span class="pill info">Focused</span><h3>Solo practice</h3><p class="muted">Quick or custom question sets from your syllabus.</p></a><a class="card card-hover" routerLink="/live"><span class="pill danger">Live</span><h3>Teacher-led quiz</h3><p class="muted">Join a scheduled session and answer in sync.</p></a><a class="card card-hover" routerLink="/quiz-run"><span class="pill warning">Peer</span><h3>Quiz run</h3><p class="muted">Create a lightweight challenge or join by code.</p></a></div></section>
    </div>
  `,
  styles: [`.attempt-row{display:flex;align-items:center;justify-content:space-between;padding:13px 0;border-bottom:1px solid var(--line)}.attempt-row:last-child{border:0}.attempt-row span>*{display:block}.attempt-row small{margin-top:3px;color:var(--muted)}`],
})
export class LearnerDashboardPage implements OnInit {
  readonly results = signal<QuizResult[]>([]); readonly loading = signal(true);
  readonly answered = computed(() => this.results().reduce((sum, item) => sum + Number(item.totalQuestions || 0), 0));
  readonly average = computed(() => { const total = this.answered(); return total ? Math.round(this.results().reduce((sum, item) => sum + Number(item.correctAnswers || 0), 0) / total * 100) : 0; });
  readonly recommendation = computed(() => { const weakest = [...this.results()].filter((r) => r.chapter).sort((a,b) => a.percentage-b.percentage)[0]; return weakest ? { title: `Revisit ${weakest.chapter}`, copy: `Your recent ${weakest.percentage}% result suggests a short focused round in ${weakest.subject}.` } : { title: 'Start with a ten-question round', copy: 'A small first attempt gives GTOP enough evidence to make the next review useful.' }; });
  constructor(public readonly auth: AuthStore, private readonly learning: LearningRepository) {}
  get firstName(): string { return (this.auth.profile()?.displayName || 'learner').split(' ')[0]; }
  get greeting(): string { const hour = new Date().getHours(); return hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'; }
  async ngOnInit(): Promise<void> { const uid = this.auth.profile()?.uid; if (uid) this.results.set(await this.learning.results(uid)); this.loading.set(false); }
}

@Component({
  selector: 'app-practice-builder',
  imports: [FormsModule],
  template: `
    <div class="page"><div class="page-head"><div><p class="eyebrow">Build a practice</p><h1>What do you want to strengthen?</h1><p class="lede">Use quick practice for a low-friction start, or choose a chapter when you already know where attention is needed.</p></div></div>
      <div class="mode-tabs"><button [class.active]="mode==='quick'" (click)="mode='quick'">Quick practice</button><button [class.active]="mode==='custom'" (click)="mode='custom'">Custom practice</button></div>
      <section class="card builder">
        @if (mode === 'custom') {
          <div class="form-grid">
            <div class="field"><label>Board</label><select [(ngModel)]="filters.board" (ngModelChange)="resetAfter('board')"><option value="">Choose board</option>@for (item of boards(); track item){<option>{{ item }}</option>}</select></div>
            <div class="field"><label>Standard</label><select [(ngModel)]="filters.standard" (ngModelChange)="resetAfter('standard')"><option value="">Choose standard</option>@for (item of standards(); track item){<option>{{ item }}</option>}</select></div>
            <div class="field"><label>Subject</label><select [(ngModel)]="filters.subject" (ngModelChange)="resetAfter('subject')"><option value="">Any subject</option>@for (item of subjects(); track item){<option>{{ item }}</option>}</select></div>
            <div class="field"><label>Chapter</label><select [(ngModel)]="filters.chapter"><option value="">Any chapter</option>@for (item of chapters(); track item){<option>{{ item }}</option>}</select></div>
          </div>
        } @else { <div class="quick-note"><span class="quick-icon">✦</span><div><h2>Let GTOP choose a useful chapter</h2><p class="muted">We will use your {{ auth.profile()?.board }} · {{ auth.profile()?.standard }} profile and available question coverage.</p></div></div> }
        <div class="count-row"><div><strong>Question count</strong><span class="muted small">Choose a set you can finish and review.</span></div><div class="count-options">@for (count of counts; track count){<button [class.active]="filters.count===count" (click)="filters.count=count">{{ count }}</button>}</div></div>
        @if (error()) { <p class="error">{{ error() }}</p> }
        <button class="btn btn-primary start" (click)="start()" [disabled]="loading()">{{ loading() ? 'Preparing questions…' : 'Start practice' }}</button>
      </section>
    </div>
  `,
  styles: [`.builder{max-width:820px}.mode-tabs{display:flex;gap:6px;margin-bottom:14px}.mode-tabs button,.count-options button{padding:10px 14px;color:var(--ink-2);background:#fff;border:1px solid var(--line);border-radius:10px;font-weight:700}.mode-tabs button.active,.count-options button.active{color:var(--teal-strong);background:var(--teal-soft);border-color:var(--teal)}.quick-note{display:flex;align-items:center;gap:20px;padding:22px;background:#f5f8f7;border-radius:14px}.quick-icon{display:grid;width:52px;height:52px;place-items:center;color:#fff;background:var(--teal);border-radius:16px;font-size:22px}.count-row{display:flex;align-items:center;justify-content:space-between;gap:20px;margin:28px 0}.count-row span{display:block;margin-top:4px}.count-options{display:flex;gap:7px}.start{width:100%}@media(max-width:600px){.count-row{align-items:flex-start;flex-direction:column}}`],
})
export class PracticeBuilderPage implements OnInit {
  readonly syllabus = signal<SyllabusItem[]>([]); readonly loading = signal(false); readonly error = signal('');
  mode: 'quick'|'custom' = 'quick'; filters: PracticeFilters = { count: 10, board: '', standard: '', subject: '', chapter: '' }; readonly counts=[5,10,15,20];
  boards = () => this.unique(this.syllabus().map((item)=>item.board));
  standards = () => this.unique(this.syllabus().filter((item)=>!this.filters.board||item.board===this.filters.board).map((item)=>item.standard));
  subjects = () => this.unique(this.syllabus().filter((item)=>(!this.filters.board||item.board===this.filters.board)&&(!this.filters.standard||item.standard===this.filters.standard)).map((item)=>item.subject));
  chapters = () => this.unique(this.syllabus().filter((item)=>(!this.filters.board||item.board===this.filters.board)&&(!this.filters.standard||item.standard===this.filters.standard)&&(!this.filters.subject||item.subject===this.filters.subject)).map((item)=>item.chapter));
  constructor(public readonly auth: AuthStore, private readonly learning: LearningRepository, private readonly sessions: QuizSessionStore, private readonly route: ActivatedRoute, private readonly router: Router) {}
  async ngOnInit(): Promise<void> { this.syllabus.set(await this.learning.syllabus()); this.filters.board=this.auth.profile()?.board||''; this.filters.standard=this.auth.profile()?.standard||''; }
  resetAfter(field:string):void { if(field==='board'){this.filters.standard='';this.filters.subject='';this.filters.chapter='';} if(field==='standard'){this.filters.subject='';this.filters.chapter='';} if(field==='subject') this.filters.chapter=''; }
  async start(): Promise<void> { this.loading.set(true);this.error.set(''); try { const questions=this.mode==='quick'?await this.learning.quickQuestions(this.auth.profile()??{},this.filters.count):await this.learning.questions({...this.filters,quizType:'custom'}); if(!questions.length)throw new Error('No questions were found for this scope. Choose another chapter.'); const qp=this.route.snapshot.queryParamMap; this.sessions.start({questions,filters:{...this.filters,quizType:this.mode},startedAt:Date.now(),returnTo:qp.get('returnTo')||undefined,hubReturnPath:qp.get('hubReturnPath')||undefined}); await this.router.navigate(['/quiz'],{queryParams:{returnTo:qp.get('returnTo'),hubReturnPath:qp.get('hubReturnPath')}}); } catch(error){this.error.set(error instanceof Error?error.message:'Practice could not be prepared.');} finally{this.loading.set(false);} }
  private unique(values:string[]):string[]{return [...new Set(values.filter(Boolean))].sort();}
}

@Component({
  selector: 'app-quiz-player',
  template: `
    <div class="page quiz-wrap">
      @if (!session()) { <div class="card empty"><h2>No active practice</h2><p>Build a practice set before opening the quiz player.</p><button class="btn btn-primary" (click)="router.navigateByUrl('/practice')">Build practice</button></div> }
      @else {
        <div class="quiz-top"><div><p class="eyebrow">{{ session()?.filters?.quizType }} practice</p><strong>Question {{ index()+1 }} of {{ questions().length }}</strong></div><button class="btn btn-secondary" (click)="leave()">Exit</button></div>
        <div class="progress-track"><div class="progress-fill" [style.width.%]="progress()"></div></div>
        <article class="card question-card"><div class="question-meta"><span class="pill info">{{ current().subject }}</span><span class="muted small">{{ current().chapter }}</span></div><h1>{{ current().question }}</h1>
          <div role="radiogroup" aria-label="Answer options">@for (option of current().options || []; track $index) { <button class="option" [class.selected]="current().selectedIndex===$index" (click)="select($index)" [attr.aria-checked]="current().selectedIndex===$index"><span class="option-key">{{ letters[$index] }}</span><span>{{ option }}</span></button> }</div>
          <div class="quiz-actions"><span class="muted small">You can move back before submitting.</span><div class="button-row"><button class="btn btn-secondary" [disabled]="index()===0" (click)="previous()">Previous</button>@if(index()<questions().length-1){<button class="btn btn-primary" [disabled]="current().selectedIndex==null" (click)="next()">Next question</button>}@else{<button class="btn btn-primary" [disabled]="!complete()||saving()" (click)="submit()">{{ saving()?'Saving…':'Finish and review' }}</button>}</div></div>
        </article>
      }
    </div>
  `,
  styles: [`.quiz-wrap{max-width:900px}.quiz-top,.question-meta,.quiz-actions{display:flex;align-items:center;justify-content:space-between;gap:16px}.quiz-wrap>.progress-track{margin:16px 0 24px}.question-card{padding:34px}.question-card h1{margin:28px 0;font-size:clamp(23px,3vw,34px);line-height:1.35;letter-spacing:-.025em}.quiz-actions{margin-top:28px;padding-top:20px;border-top:1px solid var(--line)}@media(max-width:600px){.question-card{padding:20px}.quiz-actions{align-items:stretch;flex-direction:column}.quiz-actions .button-row>*{flex:1}}`],
})
export class QuizPlayerPage {
  readonly session = signal<QuizSessionState|null>(null); readonly index=signal(0); readonly saving=signal(false); readonly letters=['A','B','C','D','E','F'];
  readonly questions=computed(()=>this.session()?.questions??[]); readonly current=computed(()=>this.questions()[this.index()]??null); readonly progress=computed(()=>((this.index()+1)/Math.max(this.questions().length,1))*100); readonly complete=computed(()=>this.questions().every((q)=>q.selectedIndex!=null));
  constructor(private readonly sessions:QuizSessionStore,private readonly learning:LearningRepository,private readonly auth:AuthStore,public readonly router:Router){this.session.set(sessions.restore());}
  select(value:number):void{const current=this.current();if(current)current.selectedIndex=value;this.session.update((value)=>value?({...value,questions:[...value.questions]}):value);}
  next():void{if(this.index()<this.questions().length-1)this.index.update((v)=>v+1);} previous():void{if(this.index()>0)this.index.update((v)=>v-1);}
  leave():void{if(confirm('Leave this practice? Your selected answers will remain in this browser.'))this.router.navigateByUrl('/practice');}
  async submit():Promise<void>{const session=this.session();const profile=this.auth.profile();if(!session||!profile)return;this.saving.set(true);const answers:QuizAnswer[]=session.questions.map((q)=>({questionId:q.id,selectedIndex:q.selectedIndex??-1,correctIndex:q.correctIndex,isCorrect:q.selectedIndex===q.correctIndex}));const first=session.questions[0];await this.learning.saveResult({userId:profile.uid,userName:profile.displayName,board:first?.board||profile.board||'',standard:first?.standard||profile.standard||'',subject:first?.subject||'Mixed',chapter:first?.chapter||'Mixed',quizType:session.filters.quizType||'custom',answers,duration:this.duration(session.startedAt)});sessionStorage.setItem('gtop-v2-summary',JSON.stringify({...session,questions:session.questions}));this.sessions.finish();await this.router.navigate(['/quiz-summary'],{queryParams:{returnTo:session.returnTo,hubReturnPath:session.hubReturnPath}});}
  private duration(start:number):string{const seconds=Math.round((Date.now()-start)/1000);return `${Math.floor(seconds/60)}m ${seconds%60}s`;}
}

@Component({
  selector: 'app-quiz-summary',
  imports: [RouterLink],
  template: `
    <div class="page summary-page"><div class="page-head"><div><p class="eyebrow">Practice complete</p><h1>{{ message() }}</h1><p class="lede">Review the evidence before deciding what to practise next.</p></div></div>
      <div class="grid grid-3"><div class="card stat"><span class="muted small">Accuracy</span><p class="stat-value">{{ accuracy() }}%</p></div><div class="card stat"><span class="muted small">Correct</span><p class="stat-value">{{ correct() }}/{{ questions().length }}</p></div><div class="card stat"><span class="muted small">Needs review</span><p class="stat-value">{{ questions().length-correct() }}</p></div></div>
      <section class="section"><div class="section-head"><div><p class="eyebrow">Question review</p><h2>Understand each answer</h2></div><div class="button-row"><a class="btn btn-secondary" routerLink="/reports">Open reports</a><a class="btn btn-primary" routerLink="/practice">Practise again</a></div></div>
        <div class="grid">@for(question of questions();track question.id;let i=$index){<article class="card review-card"><div class="section-head"><span class="pill" [class.success]="question.selectedIndex===question.correctIndex" [class.danger]="question.selectedIndex!==question.correctIndex">Question {{ i+1 }} · {{ question.selectedIndex===question.correctIndex?'Correct':'Review' }}</span><span class="muted small">{{ question.chapter }}</span></div><h3>{{ question.question }}</h3>@for(option of question.options;track $index){<div class="option" [class.correct]="$index===question.correctIndex" [class.incorrect]="$index===question.selectedIndex&&$index!==question.correctIndex"><span class="option-key">{{ letters[$index] }}</span>{{ option }}</div>}@if(question.solutions.length){<div class="solution"><strong>Explanation</strong><p>{{ question.solutions[0] }}</p></div>}</article>}</div>
      </section>
      @if(returnTo){<a class="btn btn-primary" [href]="returnTarget">Return to connected app</a>}
    </div>
  `,
  styles:[`.summary-page{max-width:980px}.review-card h3{margin:20px 0;font-size:19px;line-height:1.5}.review-card .option{cursor:default}.solution{margin-top:18px;padding:16px;background:#f4f7f6;border-radius:12px}.solution p{margin:7px 0 0;color:var(--muted);line-height:1.6}`],
})
export class QuizSummaryPage {
  readonly session=signal<QuizSessionState|null>(null);readonly letters=['A','B','C','D','E','F'];readonly questions=computed(()=>this.session()?.questions??[]);readonly correct=computed(()=>this.questions().filter((q)=>q.selectedIndex===q.correctIndex).length);readonly accuracy=computed(()=>this.questions().length?Math.round(this.correct()/this.questions().length*100):0);readonly message=computed(()=>this.accuracy()>=80?'Strong work. Keep the rhythm.':this.accuracy()>=50?'Useful attempt. Now tighten the gaps.':'This is good evidence for what to revisit.');returnTo='';returnTarget='';
  constructor(route:ActivatedRoute){try{this.session.set(JSON.parse(sessionStorage.getItem('gtop-v2-summary')||'null'));}catch{}this.returnTo=route.snapshot.queryParamMap.get('returnTo')||'';const path=route.snapshot.queryParamMap.get('hubReturnPath')||'';this.returnTarget=this.returnTo?new URL(path||'/',this.returnTo).toString():'';}
}

@Component({
  selector:'app-reports',
  imports:[RouterLink],
  template:`<div class="page"><div class="page-head"><div><p class="eyebrow">Practice evidence</p><h1>Progress you can act on.</h1><p class="lede">Patterns become more useful as you practise consistently. Until then, GTOP keeps guidance simple and transparent.</p></div><a class="btn btn-primary" routerLink="/practice">New practice</a></div>
  @if(loading()){<div class="card empty">Loading reports…</div>}@else if(!results().length){<div class="card empty"><h2>No attempts yet</h2><p>Complete one quiz to begin your report.</p><a class="btn btn-primary" routerLink="/practice">Start practice</a></div>}@else{
  <div class="grid grid-4"><div class="card stat"><span class="muted small">Attempts</span><p class="stat-value">{{results().length}}</p></div><div class="card stat"><span class="muted small">Questions</span><p class="stat-value">{{total()}}</p></div><div class="card stat"><span class="muted small">Average</span><p class="stat-value">{{average()}}%</p></div><div class="card stat"><span class="muted small">Latest</span><p class="stat-value">{{results()[0].percentage}}%</p></div></div>
  <section class="section grid grid-2"><article class="card"><p class="eyebrow">Accuracy trend</p><h2>Recent attempts</h2><div class="chart" [style.--count]="results().slice(0,12).length">@for(result of reverseRecent();track result.id){<div class="bar-col"><span [style.height.%]="result.percentage"></span><small>{{result.percentage}}%</small></div>}</div></article><article class="card"><p class="eyebrow">Next focus</p><h2>{{weakest()?.chapter||'Keep practising'}}</h2><p class="muted">@if(weakest()){Your lowest recent accuracy is {{weakest()?.percentage}}% in {{weakest()?.subject}}. A short focused retry is the most useful next move.}@else{More attempts will reveal a useful pattern.}</p><a class="btn btn-quiet" routerLink="/practice">Build focused practice</a></article></section>
  <section class="section"><div class="section-head"><h2>Attempt history</h2></div><div class="table-wrap"><table><thead><tr><th>Date</th><th>Scope</th><th>Mode</th><th>Score</th><th>Accuracy</th></tr></thead><tbody>@for(result of results();track result.id){<tr><td>{{date(result.timestamp)}}</td><td><strong>{{result.subject}}</strong><br><span class="muted small">{{result.chapter}}</span></td><td>{{result.quizType}}</td><td>{{result.correctAnswers}}/{{result.totalQuestions}}</td><td><span class="pill" [class.success]="result.percentage>=70" [class.warning]="result.percentage<70">{{result.percentage}}%</span></td></tr>}</tbody></table></div></section>}
  </div>`,
  styles:[`.chart{display:grid;height:240px;grid-template-columns:repeat(var(--count),1fr);align-items:end;gap:10px;margin-top:28px;border-bottom:1px solid var(--line)}.bar-col{display:flex;height:100%;align-items:center;justify-content:flex-end;flex-direction:column;gap:8px}.bar-col span{width:100%;min-height:3px;background:var(--teal);border-radius:7px 7px 0 0}.bar-col small{font-size:9px;transform:rotate(-45deg);transform-origin:center}`]
})
export class ReportsPage implements OnInit{
  readonly results=signal<QuizResult[]>([]);readonly loading=signal(true);readonly total=computed(()=>this.results().reduce((s,r)=>s+r.totalQuestions,0));readonly average=computed(()=>this.total()?Math.round(this.results().reduce((s,r)=>s+r.correctAnswers,0)/this.total()*100):0);readonly weakest=computed<QuizResult|undefined>(()=>[...this.results()].filter((r)=>r.chapter).sort((a,b)=>a.percentage-b.percentage)[0]);
  constructor(private auth:AuthStore,private learning:LearningRepository){}async ngOnInit():Promise<void>{const uid=this.auth.profile()?.uid;if(uid)this.results.set(await this.learning.results(uid));this.loading.set(false);}reverseRecent():QuizResult[]{return this.results().slice(0,12).reverse();}date(value:unknown):string{return asDate(value)?.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})||'—';}
}
