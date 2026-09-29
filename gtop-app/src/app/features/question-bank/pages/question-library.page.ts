import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { QuestionModuleHeaderComponent } from './question-module-header.component';
import { QuestionPaperRepository, typeLabel } from '../core/question-paper.repository';
import { QuestionLibraryRepository, type LibraryEdits, type LibraryQuestion } from '../core/question-library.repository';
import { QuestionOperationsRepository, type ScopeCounts } from '../core/question-operations.repository';
import { SyllabusItem } from '../core/models';
import { AuthService } from '../../../services/auth.service';
import { AdminUsageService } from '../../../services/admin-usage.service';

@Component({selector:'app-question-library',standalone:true,imports:[FormsModule,RouterLink,QuestionModuleHeaderComponent],templateUrl:'./question-library.page.html'})
export class QuestionLibraryPage implements OnInit {
  scopes=signal<SyllabusItem[]>([]);rows=signal<LibraryQuestion[]>([]);counts=signal<ScopeCounts|null>(null);scope=signal<SyllabusItem|null>(null);
  board=signal('');standard=signal('');subject=signal('');source=signal<'questions'|'devQuestions'>('questions');search=signal('');type=signal('all');
  loading=signal(false);busy=signal(false);error=signal('');message=signal('');next=signal<string|null>(null);selection=signal(new Set<string>());confirmArchive=false;
  editing:LibraryQuestion|null=null;editorOpen=false;answer='';optionsText='';edits:LibraryEdits=this.blank();label=typeLabel;
  private generation=0;
  boards=computed(()=>this.unique(this.scopes().map(s=>s.board)));
  standards=computed(()=>this.unique(this.scopes().filter(s=>s.board===this.board()).map(s=>s.standard)));
  subjects=computed(()=>this.unique(this.scopes().filter(s=>s.board===this.board()&&s.standard===this.standard()).map(s=>s.subject)));
  chapters=computed(()=>{const result=new Map<string,SyllabusItem>();for(const scope of this.scopes().filter(s=>s.board===this.board()&&s.standard===this.standard()&&s.subject===this.subject()).sort((a,b)=>a.id.localeCompare(b.id)))if(!result.has(scope.chapter))result.set(scope.chapter,scope);return [...result.values()].sort((a,b)=>a.chapter.localeCompare(b.chapter));});
  types=computed(()=>this.unique(this.rows().map(q=>q.questionType)));
  visible=computed(()=>this.rows().filter(q=>(this.type()==='all'||q.questionType===this.type())&&(!this.search()||q.question.toLowerCase().includes(this.search().toLowerCase()))));
  allSelected=computed(()=>this.visible().length>0&&this.visible().every(q=>this.selection().has(q.id)));
  constructor(private readonly paper:QuestionPaperRepository,private readonly library:QuestionLibraryRepository,private readonly operations:QuestionOperationsRepository,private readonly auth:AuthService,private readonly usage:AdminUsageService){}
  async ngOnInit():Promise<void>{this.loading.set(true);try{this.scopes.set(await this.paper.syllabus());this.board.set(this.boards().includes(this.auth.profile()?.board)?this.auth.profile().board:this.boards()[0]??'');this.changeBoard();}catch(e){this.fail(e);}finally{this.loading.set(false);}}
  changeBoard():void{this.standard.set(this.standards()[0]??'');this.changeStandard();}
  changeStandard():void{this.subject.set(this.subjects()[0]??'');this.changeSubject();}
  changeSubject():void{void this.openChapter(this.chapters()[0]?.id??'');}
  async openChapter(id:string):Promise<void>{const scope=this.chapters().find(s=>s.id===id)??null;this.scope.set(scope);this.counts.set(null);this.closeEditor();const version=++this.generation;
    if(!scope){this.rows.set([]);return;}
    await this.load(true);}
  async changeKind(source:'questions'|'devQuestions'):Promise<void>{this.source.set(source);this.closeEditor();await this.load(true);}
  async load(reset=false):Promise<void>{const scope=this.scope();if(!scope||(!reset&&!this.next()))return;const version=++this.generation;
    if(reset){this.rows.set([]);this.next.set(null);this.search.set('');this.type.set('all');this.selection.set(new Set());}
    this.loading.set(true);this.error.set('');
    try{const page=await this.library.list(scope,this.source(),reset?undefined:this.next()??undefined);if(version!==this.generation)return;this.rows.update(rows=>reset?page.items:[...rows,...page.items]);this.next.set(page.next);const counts=await this.operations.counts(scope);if(version===this.generation)this.counts.set(counts);}
    catch(e){if(version===this.generation)this.fail(e);}finally{if(version===this.generation)this.loading.set(false);}}
  toggle(id:string):void{this.selection.update(ids=>{const next=new Set(ids);next.has(id)?next.delete(id):next.add(id);return next;});this.confirmArchive=false;}
  selectVisible():void{const all=this.allSelected();this.selection.update(ids=>{const next=new Set(ids);this.visible().forEach(q=>all?next.delete(q.id):next.add(q.id));return next;});}
  edit(row:LibraryQuestion|null):void{this.editing=row;this.edits=row?{question:row.question,solutions:[...row.solutions],options:[...row.options],correctIndex:row.correctIndex,questionType:row.questionType,marks:row.marks,difficulty:row.difficulty,referenceUsed:''}:this.blank();this.answer=this.edits.solutions.join('\n\n');this.optionsText=this.edits.options.join('\n');this.editorOpen=true;this.error.set('');setTimeout(()=>document.getElementById('bank-editor')?.scrollIntoView({block:'start',behavior:'smooth'}));}
  closeEditor():void{this.editorOpen=false;this.editing=null;}
  async save():Promise<void>{if(!this.scope()||this.busy())return;this.busy.set(true);this.error.set('');try{await this.library.save(this.scope()!,this.editing,{...this.edits,solutions:[this.answer],options:this.editing?.options.length?this.optionsText.split('\n'):[]},this.actor());this.closeEditor();this.message.set('Question saved in the approved bank.');this.usage.track('bank_saved');await this.load(true);}catch(e){this.fail(e);}finally{this.busy.set(false);}}
  async archive():Promise<void>{if(!this.scope()||this.busy()||!this.confirmArchive)return;this.busy.set(true);const selected=this.rows().filter(q=>this.selection().has(q.id));let done=0;const failures:string[]=[];
    for(const row of selected){try{await this.library.archive(this.scope()!,row,this.actor());done++;}catch(e){failures.push(e instanceof Error?e.message:'Question could not be archived.');}}
    this.message.set(`${done} archived. Saved papers keep their original copies.`);this.usage.track('bank_archived',done);this.confirmArchive=false;await this.load(true);this.error.set(failures.join(' '));this.busy.set(false);}
  private actor():string{if(!this.auth.isAdmin())throw new Error('Sign in with an admin account.');return this.auth.profile()?.uid??'';}
  private blank():LibraryEdits{return {question:'',solutions:[],options:[],correctIndex:-1,questionType:'short_answer',marks:2,difficulty:'moderate',referenceUsed:''};}
  private unique(values:string[]):string[]{return [...new Set(values)].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));}
  private fail(e:unknown):void{this.error.set(e instanceof Error?e.message:'The question bank could not load.');this.usage.track('operation_failed');}
}
