import {ChangeDetectorRef,Component,EventEmitter,HostListener,Input,OnDestroy,OnInit,Output,inject} from '@angular/core';
import {DatePipe} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {AssistantApi} from './api.service';
import {scanFiles,scanBase64,type Scan} from './checking-intake';
import {maxExternalPages} from '../../assistant-service/domain/external-reference.mjs';

type Variant={question:string;answer:string;markingPoints:string[]};
type Question=Variant&{number:number|null;label:string;marks:number|null;sourcePage:number|null;alternative:Variant|null};
type Section={title:string;instructions:string;attemptCount:number|null;questions:Question[]};
type Paper={title:string;marks:number|null;instructions:string[];sections:Section[]};
type Status='uploading'|'queued'|'running'|'review'|'ready'|'failed';
type Summary={id:string;title:string;referenceRevision:number;state:Status;questionPages:number;pageCount:number;updatedAt:string;marks:number|null};
type RecordView=Omit<Summary,'marks'>&{version:number;paper:Paper|null;issues:string[];error:string|null;uploaded:number[];automatic?:boolean;hasReport?:boolean};
type Group='exam'|'scheme';
const base='/checking/references';
const newId=()=>'ext-'+crypto.randomUUID();
const shortError=(error:unknown)=>error instanceof Error?error.message:'The question paper could not be opened. Try again.';
const newQuestion=(number:number):Question=>({number,label:'Q'+number,question:'',marks:null,answer:'',markingPoints:[],sourcePage:null,alternative:null});
const newSection=(number:number):Section=>({title:'Section '+number,instructions:'',attemptCount:1,questions:[]});
const emptyPaper=(title:string):Paper=>({title,marks:null,instructions:[],sections:[]});

@Component({
  selector:'gtop-external-exam',standalone:true,imports:[FormsModule,DatePipe],
  templateUrl:'./external-exam.html',styleUrl:'./external-exam.css'
})
export class ExternalExamComponent implements OnInit,OnDestroy {
  @Input() referenceId='';
  @Input() autoSelect=false;
  @Output() ready=new EventEmitter<{id:string;title:string;marks?:number}>();
  @Output() recordChange=new EventEmitter<string>();
  @Output() closed=new EventEmitter<void>();
  private api=inject(AssistantApi);
  private cd=inject(ChangeDetectorRef);
  private disposed=false;
  private openVersion=0;
  private imageVersion=0;
  private pendingRefresh=false;
  private newReferenceId='';
  private revisionId='';
  private emittedReference='';
  readonly maxPages=maxExternalPages;
  readonly captions:Record<Status,string>={uploading:'Upload incomplete',queued:'Waiting for checker',running:'Reading paper',review:'Needs your review',ready:'Ready to use',failed:'Needs attention'};
  statusMessage='';
  error='';
  historyError='';
  processing=false;
  loading=false;
  title='';
  showScheme=false;
  showHistory=false;
  exam:Scan[]=[];
  scheme:Scan[]=[];
  references:Summary[]=[];
  cursor:string|null=null;
  current?:RecordView;
  editing=false;
  draft?:Paper;
  reviewed=false;
  sourcePage=1;
  sourceUrl='';
  sourceError='';
  sourceBusy=false;
  get total(){return this.exam.length+this.scheme.length;}
  get referencesShown(){return !this.current&&!this.loading;}
  get selecting(){return !this.current||this.current.state==='uploading';}
  get waiting(){return this.current?.state==='queued'||this.current?.state==='running';}
  get dirty(){return this.total>0||this.editing;}
  get questionCount(){return this.current?.paper?.sections.reduce((n,s)=>n+s.questions.length,0)??0;}
  @HostListener('window:beforeunload',['$event']) protect(e:BeforeUnloadEvent){if(this.dirty||this.processing){e.preventDefault();e.returnValue='';}}

  async ngOnInit(){
    if(this.referenceId)await this.open(this.referenceId);
    else await this.history();
  }
  ngOnDestroy(){this.disposed=true;this.clearLocal();this.dropSource();}
  @HostListener('window:gtop-paper-content-updated') ownerUpdated(){
    if(!this.waiting)return;
    if(this.processing||this.loading)this.pendingRefresh=true;
    else void this.refresh();
  }
  @HostListener('document:visibilitychange') visible(){if(!document.hidden)this.ownerUpdated();}
  private paint(){if(!this.disposed)this.cd.markForCheck();}
  private clearLocal(){for(const s of [...this.exam,...this.scheme])URL.revokeObjectURL(s.url);this.exam=[];this.scheme=[];}
  private dropSource(){this.imageVersion++;if(this.sourceUrl)URL.revokeObjectURL(this.sourceUrl);this.sourceUrl='';this.sourceError='';this.sourceBusy=false;}
  async history(more=false){
    if(more&&!this.cursor)return;
    this.historyError='';
    try{
      const page=await this.api.request<{references:Summary[];nextCursor:string|null}>(more?base+'/history':base,more?'POST':'GET',more?{cursor:this.cursor}:undefined);
      if(!this.disposed){this.references=more?[...this.references,...page.references]:page.references;this.cursor=page.nextCursor;}
    }catch(error){this.historyError=shortError(error);}finally{this.paint();}
  }
  private canLeave(){return !this.processing&&(!this.dirty||window.confirm('Leave these unsaved changes?'));}
  close(){if(this.canLeave())this.closed.emit();}
  list(){
    if(!this.canLeave())return;
    this.openVersion++;this.loading=false;this.current=undefined;this.editing=false;this.draft=undefined;this.clearLocal();this.dropSource();
    this.showHistory=true;this.showScheme=false;this.recordChange.emit('');this.newReferenceId='';this.revisionId='';this.title='';this.error='';this.statusMessage='';void this.history();
  }
  async downloadReport(){
    if(!this.current)return;
    try{await this.api.checkingReport(base+'/'+this.current.id+'/result-pdf');}
    catch(error){this.error=shortError(error);this.paint();}
  }
  async refresh(){if(this.current&&!this.editing&&!this.processing)await this.open(this.current.id,false);}
  async open(id:string,checkChanges=true){
    if(checkChanges&&!this.canLeave())return;
    const seq=++this.openVersion;
    this.error='';this.loading=true;
    try{
      const {reference}=await this.api.request<{reference:RecordView}>(base+'/'+id);
      if(this.disposed||seq!==this.openVersion)return;
      if(this.current?.id!==id||!this.selecting){this.clearLocal();this.dropSource();}
      this.current=reference;this.showScheme=reference.questionPages<reference.pageCount;this.recordChange.emit(id);this.newReferenceId=id;this.title=reference.title;
      this.editing=false;this.draft=undefined;this.reviewed=false;this.revisionId='';
      if(this.autoSelect&&reference.automatic&&reference.state==='ready'&&this.emittedReference!==id){
        this.emittedReference=id;
        this.ready.emit({id,title:reference.title,marks:reference.paper?.marks??undefined});
      }
    }catch(error){if(seq===this.openVersion)this.error=shortError(error);}
    finally{
      if(seq===this.openVersion){this.loading=false;this.paint();this.refreshIfPending();}
    }
  }
  private refreshIfPending(){
    if(!this.pendingRefresh||this.processing||this.loading)return;
    this.pendingRefresh=false;
    if(this.waiting)void this.refresh();
  }
  async pick(event:Event,group:Group){
    const input=event.target as HTMLInputElement, files=Array.from(input.files||[]);input.value='';
    if(!files.length||this.processing)return;
    this.processing=true;this.error='';
    try{
      const added=await scanFiles(files,this.maxPages-this.total);
      if(this.disposed){for(const s of added)URL.revokeObjectURL(s.url);return;}
      this[group]=[...this[group],...added];
      if(group==='exam'&&!this.title)this.title=files[0].name.replace(/\.[^.]+$/,'').slice(0,240);
    }catch(error){
      const message=shortError(error);
      this.error=message.startsWith('Add up to ')?'Add up to '+this.maxPages+' question-paper and marking-scheme pages combined.':message;
    }finally{this.processing=false;this.paint();}
  }
  remove(group:Group,index:number){
    const [scan]=this[group].splice(index,1);if(scan)URL.revokeObjectURL(scan.url);
  }
  move(group:Group,from:number,step:number){
    const at=from+step,pages=this[group];if(at<0||at>=pages.length)return;
    [pages[from],pages[at]]=[pages[at],pages[from]];
  }
  async submit(){
    if(this.processing||!this.exam.length)return;
    const existing=this.current;
    if(existing&&(existing.pageCount!==this.total||existing.questionPages!==this.exam.length)){
      this.error='Choose the same '+existing.questionPages+' question pages and '+(existing.pageCount-existing.questionPages)+' marking-scheme pages in their original order.';return;
    }
    this.processing=true;this.error='';this.newReferenceId||=newId();
    const id=this.newReferenceId,path=base+'/'+id;
    try{
      await this.api.request(base,'POST',{id,title:this.title.trim()||'Uploaded question paper',questionPages:this.exam.length,pageCount:this.total});
      this.recordChange.emit(id);
      for(const [i,page] of [...this.exam,...this.scheme].entries()){
        if(this.disposed)return;
        this.statusMessage='Saving page '+(i+1)+' of '+this.total+'…';this.paint();
        await this.api.request(path+'/pages/'+(i+1),'POST',{jpeg:await scanBase64(page.blob)});
      }
      await this.api.request(path+'/queue','POST',{});
      this.clearLocal();this.statusMessage='';await this.open(id,false);
    }catch(error){this.error=shortError(error);}
    finally{this.processing=false;this.statusMessage='';this.paint();this.refreshIfPending();}
  }
  async retry(){
    if(!this.current||this.processing)return;
    this.processing=true;this.error='';
    try{await this.api.request(base+'/'+this.current.id+'/queue','POST',{version:this.current.version});await this.open(this.current.id,false);}
    catch(error){this.error=shortError(error);}finally{this.processing=false;this.paint();this.refreshIfPending();}
  }
  edit(){
    if(!this.current)return;
    this.draft=structuredClone(this.current.paper||emptyPaper(this.current.title));
    if(!this.draft.sections.length)this.addSection();
    this.editing=true;this.reviewed=false;this.error='';this.revisionId='';void this.showPage(1);
  }
  addSection(){
    if(!this.draft)return;
    const s=newSection(this.draft.sections.length+1);this.draft.sections.push(s);this.addQuestion(s);
  }
  addQuestion(s:Section){
    if(!this.draft)return;
    const all=this.draft.sections.flatMap(x=>x.questions), compulsory=s.attemptCount===s.questions.length;
    s.questions.push(newQuestion(Math.max(0,...all.map(q=>q.number||0))+1));
    if(compulsory)s.attemptCount=s.questions.length;
  }
  removeQuestion(s:Section,index:number){
    s.questions.splice(index,1);if(s.attemptCount!==null)s.attemptCount=Math.min(s.attemptCount,s.questions.length)||null;
  }
  toggleAlternative(q:Question){q.alternative=q.alternative?null:{question:'',answer:'',markingPoints:[]};}
  lines(text:string){return text.split('\n').map(t=>t.trim()).filter(Boolean);}
  cancelEdit(){if(this.canLeave()){this.editing=false;this.draft=undefined;this.dropSource();}}
  async save(){
    if(!this.current||!this.draft||this.processing)return;
    this.processing=true;this.error='';
    try{
      const isRevision=this.current.state==='ready';
      const result=await this.api.request<{id:string}>(base+'/'+this.current.id+'/review','POST',{
        version:this.current.version,paper:this.draft,reviewed:this.reviewed,
        ...(isRevision?{revisionId:this.revisionId||=newId()}:{})
      });
      await this.open(result.id,false);
    }catch(error){this.error=shortError(error);}finally{this.processing=false;this.paint();}
  }
  async showPage(index:number){
    if(!this.current)return;
    this.dropSource();const token=this.imageVersion;this.sourcePage=Number(index);this.sourceBusy=true;
    try{
      const img=await this.api.checkingImage(base+'/'+this.current.id+'/pages/'+this.sourcePage);
      if(!this.disposed&&this.imageVersion===token)this.sourceUrl=URL.createObjectURL(img);
    }catch(error){if(token===this.imageVersion)this.sourceError=shortError(error);}
    finally{if(token===this.imageVersion){this.sourceBusy=false;this.paint();}}
  }
  get pages(){return Array.from({length:this.current?.pageCount||0},(_,i)=>i+1);}
}
