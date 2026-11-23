import {CommonModule} from '@angular/common';
import {Component, EventEmitter, HostListener, Input, OnDestroy, OnInit, Output, inject} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {DomSanitizer, SafeHtml} from '@angular/platform-browser';
import {AssistantApi} from './api.service';
import type {Transport} from './contracts';
import {presentArtifact} from './artifact-presentation.mjs';

export interface PaperFacet {key:string;label:string}
export interface CataloguePaper {
  paperId:string;title:string;ownerUid:string;familyId:string;parentPaperId:string|null;
  sourceConversationId:string;revision:number;createdAt:string;marks:number;
  board:PaperFacet&{raw:string};standard:PaperFacet&{raw:string};subject:PaperFacet&{raw:string};
  academicYear:string;format:string|null;chapterKeys:string[];
  chapterBreakdown:{key:string;title:string;questionCount:number;questionNumbers:number[]}[];
  questionCount:number;classificationStatus:string;classificationIssues:string[];
  isFamilyLatest:boolean;
}
interface CatalogueResult {
  items:CataloguePaper[];nextCursor:string|null;indexCoverage:'complete'|'building';
  isPartial:boolean;pageSize:number;
}
interface FacetResult {level:'board'|'standard'|'subject'|'chapter';options:PaperFacet[];partial:boolean}
type FilterName='boardKey'|'standardKey'|'subjectKey'|'chapterKey';
type FilterState={boardKey:string;standardKey:string;subjectKey:string;chapterKey:string};

@Component({
  selector:'gtop-paper-library',
  standalone:true,
  imports:[CommonModule,FormsModule],
  templateUrl:'./paper-library.html',
  styleUrl:'./paper-library.css'
})
export class PaperLibraryComponent implements OnInit,OnDestroy {
  @Input() mode:'library'|'picker'='library';
  @Input() transport?:Transport;
  @Input() openError='';
  @Output() openPaper=new EventEmitter<{paper:CataloguePaper;kind:'student'|'answers';print:boolean}>();
  @Output() choosePaper=new EventEmitter<CataloguePaper>();
  @Output() createPaper=new EventEmitter<void>();
  @Output() openRequests=new EventEmitter<void>();
  @Output() checkPaper=new EventEmitter<CataloguePaper>();
  @Output() classicArchive=new EventEmitter<void>();
  private api=inject(AssistantApi);
  private sanitizer=inject(DomSanitizer);
  private disposed=false;
  private requestId=0;
  private facetGeneration=0;
  private previewGeneration=0;
  private searchTimer?:ReturnType<typeof setTimeout>;
  private facetCache=new Map<string,FacetResult>();
  facets:Record<'board'|'standard'|'subject'|'chapter',PaperFacet[]>={board:[],standard:[],subject:[],chapter:[]};
  facetLoading=false;facetError='';facetPartial=false;
  filters:FilterState={boardKey:'',standardKey:'',subjectKey:'',chapterKey:''};
  academicYear='';format='';ownerScope:'accessible'|'mine'='accessible';
  query='';latestRevisionOnly=true;showCurriculum=false;
  items:CataloguePaper[]=[];nextCursor:string|null=null;
  loading=false;error='';indexCoverage:'complete'|'building'='building';isPartial=false;loaded=false;
  selected:CataloguePaper|null=null;previewHtml:SafeHtml|null=null;
  previewLoading=false;previewError='';previewKind:'student'|'answers'='student';
  readonly stages:{key:FilterName;level:'board'|'standard'|'subject'|'chapter';title:string}[]=[
    {key:'boardKey',level:'board',title:'Board'},
    {key:'standardKey',level:'standard',title:'Class'},
    {key:'subjectKey',level:'subject',title:'Subject'},
    {key:'chapterKey',level:'chapter',title:'Chapter'}
  ];
  ngOnInit(){void this.refreshAll();}
  ngOnDestroy(){this.disposed=true;this.requestId++;this.facetGeneration++;this.previewGeneration++;if(this.searchTimer)clearTimeout(this.searchTimer);}
  private client():Transport{return this.transport||this.api;}
  private selection():Record<string,string>{
    return {...Object.fromEntries(Object.entries(this.filters).filter(([,value])=>!!value)),
      ...(this.academicYear?{academicYear:this.academicYear}:{}),
      ...(this.format?{format:this.format}:{}),ownerScope:this.ownerScope};
  }
  private facetSelection(key:FilterName):Record<string,string>{
    const steps=['boardKey','standardKey','subjectKey','chapterKey'] as const;
    const depth=steps.indexOf(key),result:Record<string,string>={ownerScope:this.ownerScope};
    for(let i=0;i<depth;i++)if(this.filters[steps[i]])result[steps[i]]=this.filters[steps[i]];
    return result;
  }
  async refreshAll(){
    await Promise.all([this.loadFacets(true),this.searchPapers(true)]);
  }
  private async loadFacets(force=false){
    const generation=++this.facetGeneration;
    this.facetLoading=true;this.facetError='';this.facetPartial=false;
    const tasks=this.stages.filter(({key},i)=>i===0||this.stages[i-1].key&&this.filters[this.stages[i-1].key]);
    try{
      const pages=await Promise.all(tasks.map(async stage=>{
        const filters=this.facetSelection(stage.key);
        const cacheKey=stage.level+':'+JSON.stringify(filters);
        if(!force&&this.facetCache.has(cacheKey))return {level:stage.level,result:this.facetCache.get(cacheKey)!};
        const result=await this.client().request<FacetResult>('/admin/library/facets','POST',{filters});
        this.facetCache.set(cacheKey,result);
        return {level:stage.level,result};
      }));
      if(this.disposed||generation!==this.facetGeneration)return;
      this.facets={board:[],standard:[],subject:[],chapter:[]};
      for(const page of pages){this.facets[page.level]=page.result.options;this.facetPartial ||=page.result.partial;}
    }catch(error){
      if(!this.disposed&&generation===this.facetGeneration)this.facetError=this.failure(error);
    }finally{
      if(!this.disposed&&generation===this.facetGeneration)this.facetLoading=false;
    }
  }
  private failure(error:unknown){return error instanceof Error?error.message:'Could not load papers. Try again.';}
  private queueSearch(){
    this.requestId++;if(this.searchTimer)clearTimeout(this.searchTimer);
    this.searchTimer=setTimeout(()=>void this.searchPapers(true),350);
  }
  onQueryChanged(){this.queueSearch();}
  selectFacet(stage:FilterName,value:string){
    const index=this.stages.findIndex(s=>s.key===stage);
    this.filters[stage]=this.filters[stage]===value?'':value;
    for(const s of this.stages.slice(index+1))this.filters[s.key]='';
    this.selected=null;this.previewHtml=null;
    void this.loadFacets();
    this.queueSearch();
  }
  chooseBreadcrumb(stage:FilterName){
    const index=this.stages.findIndex(s=>s.key===stage);
    for(const s of this.stages.slice(index+1))this.filters[s.key]='';
    this.selected=null;this.previewHtml=null;
    void this.loadFacets();this.queueSearch();this.showCurriculum=true;
  }
  resetBrowse(){
    this.filters={boardKey:'',standardKey:'',subjectKey:'',chapterKey:''};
    this.query='';this.ownerScope='accessible';this.latestRevisionOnly=true;
    this.academicYear='';this.format='';this.selected=null;this.previewHtml=null;
    void this.loadFacets();void this.searchPapers(true);this.showCurriculum=true;
  }
  setCollection(choice:'browse'|'recent'|'mine'|'revisions'){
    if(choice==='browse'){this.showCurriculum=true;return;}
    if(choice==='recent'){this.resetBrowse();this.showCurriculum=false;return;}
    this.ownerScope=choice==='mine'?'mine':'accessible';
    this.latestRevisionOnly=choice!=='revisions';
    this.selected=null;this.previewHtml=null;
    void this.loadFacets();void this.searchPapers(true);
  }
  onAdvancedChange(){void this.loadFacets();void this.searchPapers(true);}
  async searchPapers(reset:boolean){
    if(this.searchTimer){clearTimeout(this.searchTimer);this.searchTimer=undefined;}
    const cursor=reset?null:this.nextCursor;
    if(!reset&&!cursor)return;
    const generation=++this.requestId;
    this.loading=true;this.error='';
    try{
      const result=await this.client().request<CatalogueResult>('/admin/library/search','POST',{
        kind:'papers',filters:this.selection(),query:this.query.trim(),
        latestRevisionOnly:this.latestRevisionOnly,sort:'recent',pageSize:24,
        ...(cursor?{cursor}:{})
      });
      if(this.disposed||generation!==this.requestId)return;
      const prior=reset?[]:this.items;
      this.items=[...new Map([...prior,...result.items].map(row=>[row.paperId,row])).values()];
      this.nextCursor=result.nextCursor;this.indexCoverage=result.indexCoverage;
      this.isPartial=result.isPartial;this.loaded=true;
      if(this.selected&&!this.items.some(row=>row.paperId===this.selected?.paperId)){
        this.selected=null;this.previewHtml=null;
      }
    }catch(error){
      if(!this.disposed&&generation===this.requestId){this.error=this.failure(error);this.loaded=true;}
    }finally{if(!this.disposed&&generation===this.requestId)this.loading=false;}
  }
  get activeTitle(){
    const keys:[FilterName,'board'|'standard'|'subject'|'chapter'][]=[
      ['chapterKey','chapter'],['subjectKey','subject'],['standardKey','standard'],['boardKey','board']];
    for(const [key,level] of keys)if(this.filters[key]){
      const label=this.facets[level].find(row=>row.key===this.filters[key])?.label;
      if(label)return label;
      if(level==='standard')return 'Class '+this.filters[key];
      return this.filters[key].replace(/-/g,' ');
    }
    return this.ownerScope==='mine'?'My papers':'All papers';
  }
  get pathSelected(){return Object.values(this.filters).some(Boolean);}
  get resultLabel(){
    if(this.loading&&!this.loaded)return 'Finding papers…';
    if(!this.items.length)return 'No papers loaded';
    return this.items.length+' '+(this.items.length===1?'paper':'papers')+' loaded'+(this.nextCursor?' · more available':'');
  }
  labelFor(key:FilterName):string {
    const level=this.stages.find(s=>s.key===key)?.level||'board';
    return this.facets[level].find(o=>o.key===this.filters[key])?.label||
      (level==='standard'?'Class '+this.filters[key]:this.filters[key].replace(/-/g,' '));
  }
  trackByPaper(_index:number,paper:CataloguePaper){return paper.paperId;}
  paperDate(item:CataloguePaper){const d=new Date(item.createdAt);return Number.isNaN(d.getTime())?'Date unavailable':d.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});}
  selectPaper(item:CataloguePaper){
    this.selected=item;this.previewKind='student';this.previewHtml=null;this.previewError='';
    if(this.mode==='library')void this.loadPreview();
  }
  dismissPreview(){this.selected=null;this.previewHtml=null;this.previewError='';this.previewGeneration++;}
  @HostListener('document:keydown.escape') onEscape(){if(this.selected)this.dismissPreview();}
  async loadPreview(kind:'student'|'answers'='student'){
    const paper=this.selected;if(!paper||this.mode!=='library')return;
    const generation=++this.previewGeneration;
    this.previewHtml=null;this.previewError='';this.previewLoading=true;this.previewKind=kind;
    try{
      const source=this.transport?.adminArtifact?
        await this.transport.adminArtifact(paper.paperId,kind):
        await this.api.adminArtifact(paper.paperId,kind);
      if(this.disposed||generation!==this.previewGeneration||this.selected?.paperId!==paper.paperId)return;
      this.previewHtml=this.sanitizer.bypassSecurityTrustHtml(presentArtifact(source,paper.revision));
    }catch(error){if(!this.disposed&&generation===this.previewGeneration)this.previewError=this.failure(error);}
    finally{if(!this.disposed&&generation===this.previewGeneration)this.previewLoading=false;}
  }
  openSelected(kind:'student'|'answers'='student',print=false){
    if(this.selected)this.openPaper.emit({paper:this.selected,kind,print});
  }
  pickSelected(){if(this.selected)this.choosePaper.emit(this.selected);}
  checkSelected(){if(this.selected)this.checkPaper.emit(this.selected);}
}
