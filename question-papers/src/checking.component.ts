import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, NgZone, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AssistantApi } from './api.service';
import { scanBase64, scanFiles, type Scan } from './checking-intake';

type State='uploading'|'queued'|'running'|'failed'|'review'|'final';
type Result='correct'|'partial'|'wrong'|'missing'|'unreadable'|'uncertain';
type Anchor={page:number;x:number;y:number};
type Answer={number:number;max:number;optional:boolean;status:Result;awarded:number|null;
  choice:'A'|'B'|null;explanation:string;evidence:string;anchors:Anchor[]};
type Grade={answers:Answer[];awarded:number;max:number;pending:number};
type Page={index:number;width:number;height:number};
type Summary={id:string;label:string;state:State;pageCount:number;awarded:number|null;updatedAt:string};
type Sheet=Summary&{notes:string;version:number;uploaded:Page[];grade?:Grade;error?:string;finalizedAt?:string;engine?:'codex-cli'|'openai-api'};
type Rubric={title:string;hasScheme:boolean;marks?:number};
type Question={number:number;question:string;alternative:string|null};
type Detail={sheet:Sheet;rubric:Rubric&{questions:Question[]}};

@Component({
  selector:'gtop-paper-checking',standalone:true,imports:[CommonModule,FormsModule],
  templateUrl:'./checking.html',styleUrl:'./checking.css'
})
export class PaperCheckingComponent implements OnInit, OnDestroy {
  @Input({required:true}) paperId='';
  @Output() close=new EventEmitter<void>();
  private api=inject(AssistantApi);
  private zone=inject(NgZone);
  private releaseMarker?:()=>void;
  private epoch=0;
  private dead=false;
  private opening='';
  private revision='';
  private displayUrls=new Map<number,string>();
  private draftId='';
  private initialSheet='';
  sheets:Summary[]=[];
  sheet?:Sheet;
  rubric?:Rubric;
  questions:Question[]=[];
  answers:Answer[]=[];
  pageNumber=1;
  selected=0;
  placing=false;
  editing=false;
  dirty=false;
  composing=false;
  photos:Scan[]=[];
  label='';
  notes='';
  loading=true;
  busy=false;
  printing=false;
  error='';
  message='';
  statusText:Record<State,string>={
    uploading:'Upload incomplete',queued:'Queued',running:'Checking',failed:'Needs attention',
    review:'Ready for review',final:'Finalized'
  };
  captions:Record<Result,string>={
    correct:'Correct',partial:'Partial',wrong:'Incorrect',missing:'Missing',
    unreadable:'Unreadable',uncertain:'Needs review'
  };
  readonly statuses=Object.keys(this.captions) as Result[];
  marker:Record<Result,string>={correct:'✓',partial:'◐',wrong:'×',missing:'–',unreadable:'?',uncertain:'?'};

  get base(){return '/papers/'+encodeURIComponent(this.paperId)+'/checking';}
  get pageItems(){return [...(this.sheet?.uploaded||[])].sort((a,b)=>a.index-b.index);}
  get page(){return this.pageItems.find(page=>page.index===this.pageNumber);}
  get answer(){return this.answers.find(answer=>answer.number===this.selected);}
  get question(){return this.questions.find(question=>question.number===this.selected);}
  get foundTotal(){return Math.round(100*this.answers.reduce((sum,a)=>sum+(a.awarded??0),0))/100;}
  get pending(){return this.answers.filter(a=>a.awarded===null).length;}
  get max(){return this.sheet?.grade?.max??this.rubric?.marks;}
  get canEdit(){return this.sheet?.state==='review'||(this.sheet?.state==='final'&&this.editing);}
  get imagesReady(){return !!this.sheet&&this.displayUrls.size===this.sheet.pageCount;}
  get active(){return !!this.sheet&&['queued','running'].includes(this.sheet.state);}
  url(index:number){return this.displayUrls.get(index)||'';}

  ngOnInit(){
    this.initialSheet=new URL(location.href).searchParams.get('sheet')||'';
    void this.refresh();
    if(this.initialSheet)void this.open(this.initialSheet);
    const uid=this.api.user?.uid;
    if(uid){
      try{this.releaseMarker=this.api.watchMarker('assistantUiNotifications/'+uid,snapshot=>{
        const revision=snapshot.data?.['revision'];
        if(snapshot.fromCache||typeof revision!=='string'||revision===this.revision)return;
        this.revision=revision;
        this.zone.run(()=>{if(!this.dead&&!this.busy&&(this.active||(!this.sheet&&!this.composing)))void this.refresh();});
      },()=>{});}catch{/* Refresh remains available if the event connection is unavailable. */}
    }
  }
  ngOnDestroy(){
    this.dead=true;
    this.epoch++;
    this.releaseMarker?.();
    this.disposePhotos();
    this.releaseImages();
  }
  private describe(error:unknown){return error instanceof Error?error.message:'Something went wrong. Try again.';}
  private changeUrl(sheetId?:string){
    const url=new URL(location.href);
    if(sheetId)url.searchParams.set('sheet',sheetId);else url.searchParams.delete('sheet');
    history.replaceState(history.state,'',url);
  }
  async refresh(){
    this.error='';
    try{
      const {sheets,rubric}=await this.api.request<{sheets:Summary[];rubric:Rubric}>(this.base);
      if(this.dead)return;
      this.sheets=sheets;
      this.rubric=rubric;
      if(this.sheet&&!this.dirty&&!this.composing&&!this.opening)await this.open(this.sheet.id,false);
    }catch(error){if(!this.dead)this.error=this.describe(error);}
    finally{if(!this.dead)this.loading=false;}
  }
  async open(id:string,changeUrl=true){
    if(this.dirty&&id===this.sheet?.id)return;
    const generation=++this.epoch;
    this.opening=id;
    this.error='';
    if(changeUrl)this.changeUrl(id);
    try{
      const {sheet,rubric}=await this.api.request<Detail>(this.base+'/'+encodeURIComponent(id));
      if(this.epoch!==generation||this.dead)return;
      const same=this.sheet?.id===id;
      const unchanged=same&&this.sheet?.version===sheet.version&&this.sheet?.state===sheet.state;
      if(!same){this.releaseImages();this.pageNumber=1;this.selected=0;this.editing=false;this.placing=false;}
      this.composing=false;
      this.sheet=sheet;
      this.questions=rubric.questions;
      if(!unchanged){this.answers=structuredClone(sheet.grade?.answers||[]);this.selected ||= this.answers[0]?.number||0;}
      for(const page of this.pageItems){
        if(this.displayUrls.has(page.index))continue;
        const blob=await this.api.checkingImage(this.base+'/'+id+'/pages/'+page.index);
        if(this.epoch!==generation||this.dead)return;
        this.displayUrls.set(page.index,URL.createObjectURL(blob));
      }
    }catch(error){
      if(this.epoch===generation&&!this.dead)this.error=this.describe(error);
    }finally{if(this.epoch===generation)this.opening='';}
  }
  private releaseImages(){
    for(const url of this.displayUrls.values())URL.revokeObjectURL(url);
    this.displayUrls.clear();
  }
  private disposePhotos(){
    for(const photo of this.photos)URL.revokeObjectURL(photo.url);
    this.photos=[];
  }
  list(){
    if(this.dirty&&!window.confirm('Leave this sheet and discard unsaved changes?'))return;
    this.epoch++;
    this.opening='';
    this.sheet=undefined;
    this.dirty=false;
    this.composing=false;
    this.placing=false;
    this.message='';
    this.releaseImages();
    this.disposePhotos();
    this.changeUrl();
    void this.refresh();
  }
  leave(){
    if(!this.dirty||window.confirm('Close checking and discard unsaved changes?'))this.close.emit();
  }
  start(resume=false){
    this.disposePhotos();
    this.draftId=resume?this.sheet!.id:'';
    this.label=resume?this.sheet!.label:'';
    this.notes=resume?this.sheet!.notes:'';
    this.composing=true;
    this.error='';
    this.message='';
  }
  cancelIntake(){this.composing=false;this.disposePhotos();this.draftId='';this.error='';}
  get resuming(){return !!this.sheet&&this.draftId===this.sheet.id;}
  get frozen(){return !!this.draftId;}
  async addFiles(event:Event){
    const input=event.currentTarget as HTMLInputElement,files=Array.from(input.files||[]);
    input.value='';
    if(!files.length)return;
    this.busy=true;
    this.error='';
    try{
      const pages=await scanFiles(files,12-this.photos.length);
      if(this.dead){for(const page of pages)URL.revokeObjectURL(page.url);return;}
      this.photos.push(...pages);
    }catch(error){this.error=this.describe(error);}
    finally{this.busy=false;}
  }
  move(index:number,amount:number){
    const target=index+amount;
    if(target<0||target>=this.photos.length)return;
    [this.photos[index],this.photos[target]]=[this.photos[target],this.photos[index]];
  }
  remove(index:number){const [photo]=this.photos.splice(index,1);URL.revokeObjectURL(photo.url);}
  async submit(){
    if(this.busy||!this.label.trim()||!this.photos.length)return;
    if(this.resuming&&this.sheet!.pageCount!==this.photos.length){
      this.error='Choose the same '+this.sheet!.pageCount+' pages in their original order.';
      return;
    }
    this.busy=true;this.error='';
    this.draftId ||= crypto.randomUUID();
    const id=this.draftId;
    try{
      await this.api.request(this.base,'POST',{id,label:this.label,notes:this.notes,pageCount:this.photos.length});
      for(let index=0;index<this.photos.length;index++){
        this.message='Saving page '+(index+1)+' of '+this.photos.length+'…';
        const jpeg=await scanBase64(this.photos[index].blob);
        await this.api.request(this.base+'/'+id+'/pages/'+(index+1),'POST',{jpeg});
      }
      await this.api.request(this.base+'/'+id+'/queue','POST',{});
      this.disposePhotos();this.message='';this.draftId='';
      await this.open(id);
    }catch(error){if(!this.dead){this.error=this.describe(error);this.message='';}}
    finally{this.busy=false;}
  }
  async queue(action='queue'){
    if(!this.sheet||this.busy)return;
    this.busy=true;this.error='';
    const {id,version}=this.sheet;
    try{
      await this.api.request(this.base+'/'+id+'/'+action,'POST',{version});
      await this.open(id,false);
    }catch(error){this.error=this.describe(error);}
    finally{this.busy=false;}
  }
  choose(answer:Answer,page?:number){
    this.placing=false;
    this.selected=answer.number;
    this.pageNumber=page??answer.anchors[0]?.page??this.pageNumber;
  }
  mathPosition(x:number){return Math.max(1,Math.min(57,x*100));}
  setPage(index:number){this.pageNumber=index;}
  annotations(index:number){
    return this.answers.flatMap(answer=>answer.anchors.filter(anchor=>anchor.page===index).map(anchor=>({answer,anchor})));
  }
  setStatus(answer:Answer,status:Result){
    answer.status=status;
    if(status==='correct')answer.awarded=answer.max;
    else if(status==='wrong'||status==='missing')answer.awarded=0;
    else if(status!=='partial'||!(Number(answer.awarded)>0&&Number(answer.awarded)<answer.max))answer.awarded=null;
    if(status==='missing')answer.choice=null;
    this.dirty=true;
  }
  place(event:MouseEvent){
    if(!this.placing||!this.answer||!this.canEdit)return;
    const box=(event.currentTarget as HTMLElement).getBoundingClientRect();
    this.answer.anchors=[
      ...this.answer.anchors.filter(anchor=>anchor.page!==this.pageNumber),
      {page:this.pageNumber,x:Math.max(0,Math.min(1,(event.clientX-box.left)/box.width)),
        y:Math.max(0,Math.min(1,(event.clientY-box.top)/box.height))}
    ];
    this.placing=false;
    this.dirty=true;
  }
  detach(answer:Answer,index:number){answer.anchors=answer.anchors.filter(anchor=>anchor.page!==index);this.dirty=true;}
  async save(final:boolean){
    if(!this.sheet||this.busy||(!this.canEdit&&!final))return;
    const {id,version}=this.sheet;
    this.busy=true;this.error='';this.message='';
    try{
      const result=await this.api.request<{grade:Grade;state:State;version:number;finalizedAt:string}>(this.base+'/'+id+'/review','POST',
        {version,final,answers:this.answers});
      if(this.dead||this.sheet.id!==id)return;
      this.sheet={...this.sheet,...result};
      this.answers=structuredClone(result.grade.answers);
      this.editing=false;this.dirty=false;
      this.message=final?'Marks finalized.':'Corrections saved.';
    }catch(error){this.error=this.describe(error);}
    finally{this.busy=false;}
  }
  async print(){
    if(!this.imagesReady||this.dirty||this.busy)return;
    this.printing=true;
    await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
    try{
      const photos=Array.from(document.querySelectorAll<HTMLImageElement>('.checking-print img'));
      await Promise.all(photos.map(photo=>photo.decode()));
      window.print();
    }catch{this.error='The scanned pages are not ready to print. Refresh the sheet and try again.';}
    finally{this.printing=false;}
  }
}
