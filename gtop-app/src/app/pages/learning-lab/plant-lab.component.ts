import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { questions, missions, score, pollinate, PollenSource, journey } from './plant-lesson';
import { Answers, LabAttempt, LabChange, PlantFieldwork, freshFieldwork, newAttempt, changeAttempt } from './plant-attempt';
import { PlantLabService } from './plant-lab.service';
import { LabChoicesComponent } from './choices.component';
import { PlantSceneComponent } from './plant-scene.component';
@Component({selector:'app-plant-lab',standalone:true,imports:[CommonModule,FormsModule,RouterLink,LabChoicesComponent,PlantSceneComponent],templateUrl:'./plant-lab.component.html'})
export class PlantLabComponent implements OnInit, OnDestroy {
  readonly missions=missions; readonly questions=questions;
  readonly discoveries=[
    'Anthers make pollen. The ovary holds ovules, with an egg cell inside each embryo sac.',
    'Pollination is pollen arriving on a stigma. A compatible grain can begin the next stage.',
    'The pollen tube delivers male gametes. One fuses with the egg to form a zygote.',
    'The ovary becomes fruit; ovules become seeds. The embryo is a new plant in miniature.',
    'A potato eye or a Bryophyllum leaf bud can grow into a plant without a seed.',
  ];
  readonly parts=[
    {id:'anther',name:'Anther',text:'The pollen maker. These small sacs produce pollen grains.'},
    {id:'stigma',name:'Stigma',text:'The landing place. A receptive stigma receives pollen.'},
    {id:'style',name:'Style',text:'The connecting passage. The pollen tube grows through it.'},
    {id:'ovary',name:'Ovary',text:'The seed nursery. It holds ovules, each containing an egg cell within an embryo sac.'},
  ];
  readonly sources:{id:PollenSource;name:string;short:string}[]=[
    {id:'same-flower',name:'This flower',short:'Same flower'},
    {id:'same-plant',name:'Another flower on this plant',short:'Same plant'},
    {id:'other-plant',name:'Another plant of the same species',short:'Another plant'},
    {id:'other-species',name:'A different species',short:'Other species'},
  ];
  readonly confidenceOptions=['Still unsure','With some help','Mostly confident','Very confident'];
  f:PlantFieldwork=freshFieldwork(); attempt?:LabAttempt; history:LabAttempt[]=[];
  stage='explore'; selectedPart=''; practice=false; restoring=true; pending=0; error='';
  notebook=false; mapOpen=false; guessOpen=false; hint=false; questionIndex=0;
  answers:Answers={}; confidence=0; rating=0; feedback=''; friction='';
  pollenFlash=0; seedFlight=0; inspectPulse=''; replayActive=false;
  private queue:Promise<void>=Promise.resolve(); private session=0; private unwatch?:()=>void;
  constructor(private labs:PlantLabService,private router:Router,private zone:NgZone){}
  async ngOnInit(){
    this.unwatch=this.labs.watchAccount(()=>this.zone.run(()=>{this.session++;this.history=[];this.attempt=undefined;this.f=freshFieldwork();this.answers={};this.feedback='';this.friction='';void this.router.navigate(['/learning-lab']);}));
    const epoch=this.session;
    try{const h=await this.labs.load();if(epoch===this.session)this.history=h;}
    catch{if(epoch===this.session)this.error='Saved visits could not load. You can still explore without saving.';}
    finally{if(epoch===this.session)this.restoring=false;}
  }
  ngOnDestroy(){this.session++;this.unwatch?.();}
  get mission(){return this.f.mission;} get task(){return missions[this.mission];}
  get complete(){return this.attempt?.experiments.includes(this.task.id)||false;}
  get allDone(){return missions.every(m=>this.attempt?.experiments.includes(m.id));}
  get submitted(){return !!this.attempt&&this.attempt.phase!=='experiment';}
  get sent(){return this.attempt?.phase==='complete';}
  get result(){return score(this.attempt?.answers||{});}
  get part(){return this.parts.find(p=>p.id===this.selectedPart);}
  get lastTrial(){return this.f.pollenTrials.at(-1);}
  get pollenResult(){const t=this.lastTrial;return t?pollinate(t.source,t.landing):undefined;}
  get journeyText(){return journey[this.f.journeyStage];}
  get question(){return questions[this.questionIndex];}
  get checkedCount(){return Object.keys(this.answers).length;}
  get sceneMode(){return this.mission===0?'anatomy':this.mission===1?'pollination':this.mission===2?'journey':this.mission===3?(this.f.dispersalOpen?'wind':'fruit'):(this.f.leafOpen?'leaf':'propagation');}
  get discoveryCount(){return this.attempt?.experiments.length||0;}
  get isSaving(){return this.pending>0;}
  get atTarget(){return this.ready(this.mission);}
  ready(i:number,f=this.f){
    return i===0?f.inspected.includes('anther')&&f.inspected.includes('ovary')
      :i===1?f.pollenTrials.some(t=>pollinate(t.source,t.landing).accepted)
      :i===2?f.journeyStage===3
      :i===3?f.fruitStage===2&&f.windTrials.some(v=>v>0)
      :f.comparedBuds&&f.leafPlanted;
  }
  get instruction():string{
    if(this.mission===1&&this.pollenResult&&!this.pollenResult.accepted)return this.lastTrial?.landing==='petal'?'Pollen landed on a petal. Try the stigma.':'This pollen is incompatible. Try the same species.';
    if(this.complete&&!this.replayActive)return ['You found the pollen maker and the seed nursery.','Pollen reached a compatible stigma. What happens inside?','A zygote has formed. Follow what it becomes.','Seeds have a way to leave the parent plant.','You grew a new plant without a seed.'][this.mission];
    if(this.mission===0)return !this.f.opened?'Tap the flower to reveal what is inside.':!this.f.inspected.includes('anther')?'Find the pollen maker. Tap an anther.':!this.f.inspected.includes('ovary')?'Where could seeds begin? Tap the ovary.':'You have found both parts.';
    if(this.mission===1)return 'Choose where the pollen comes from, then tap a landing place.';
    if(this.mission===2)return ['A grain has arrived. Watch its tube begin to grow.','Follow the tube into an ovule.','Find the egg cell. Tap it to see fertilisation.','One male gamete has fused with the egg.'][this.f.journeyStage];
    if(this.mission===3)return !this.f.dispersalOpen?['The flower has been fertilised. What changes next?','The ovary is growing. Look inside the developing fruit.','The ovules have become seeds. How might seeds travel?'][this.f.fruitStage]:this.f.windTrials.length?'Change the wind and release another fruit to compare.':'Meet a different specimen: dandelion. Choose the wind, then release a fruit.';
    if(this.f.leafOpen)return this.f.leafPlanted?'A plantlet can establish on moist soil. No seed was needed.':'Tap a bud on the leaf to place its plantlet on moist soil.';
    return this.f.growthStage===0?'Give one pot a piece with an eye, and the other a piece without.':this.f.growthStage===1?'Both pots have the same conditions. Watch for a shoot.':this.f.budA===this.f.budB?'Both pieces have the same bud condition. Try one with an eye and one without.':'The eye made the difference. Can a leaf make a new plant too?';
  }
  get canGuess(){return !this.complete && this.attempt?.predictions[this.task.id]===undefined && (this.mission===0?!this.f.opened:this.mission===1?!this.f.pollenTrials.length:this.mission===2?this.f.journeyStage===0:this.mission===3?this.f.fruitStage===0:this.f.growthStage===0);}
  get mainLabel():string{
    if(this.complete&&!this.replayActive)return this.mission===4?(this.allDone?'See my discoveries':'Open journey map'):['Carry some pollen','Follow the pollen','Watch a fruit form','Try another way to grow'][this.mission];
    if(this.mission===0)return !this.f.opened?'Open the flower':!this.f.inspected.includes('anther')?'Find the anther':'Find the ovary';
    if(this.mission===1)return this.pollenResult?.accepted?'Discovery saved':'Send pollen to the stigma';
    if(this.mission===2)return ['Grow the pollen tube','Look inside the ovule','Fuse with the egg','Discovery saved'][this.f.journeyStage];
    if(this.mission===3)return this.f.dispersalOpen?'Release a fruit':['Watch fruit develop','Reveal the seeds','Explore seed travel'][this.f.fruitStage];
    return this.f.leafOpen?'Plant the leaf bud':this.f.growthStage===0?'Grow both pieces':this.f.growthStage===1?'Watch the shoots':this.f.budA===this.f.budB?'Compare different pieces':'Explore a living leaf';
  }
  get sceneTitle(){return this.mission===0?(this.f.opened?'Inside a flower':'Every new beginning starts somewhere.'):
    this.mission===1?'A tiny delivery. A big possibility.':this.mission===2?this.journeyText.title:
    this.mission===3?(this.f.dispersalOpen?'Catch the breeze.':['A flower after fertilisation','The ovary becomes a fruit','Seeds, with a new plant inside'][this.f.fruitStage]):this.f.leafOpen?'A leaf with new beginnings.':'One small difference.';}
  get observation(){
    if(this.mission===0)return this.part?.text||'';
    if(this.mission===1)return this.pollenResult?`${this.pollenResult.label}. ${this.pollenResult.accepted?'Arrival is pollination. Fertilisation comes later.':this.pollenResult.detail}`:'';
    if(this.mission===2)return this.journeyText.text;
    if(this.mission===3)return this.f.dispersalOpen?(this.f.windTrials.length?'Last release: '+['in still air, the fruit falls close to the parent.','a breeze carries the fruit away. Its hairs catch the air.','stronger wind carries it farther in this simplified comparison.'][this.f.windTrials.at(-1)!]:'The small fruit carries one seed. Its parachute of hairs catches moving air.'):(this.f.fruitStage===2?'Ovary → fruit. Ovules → seeds. The zygote becomes the embryo.':'The flower changes over days and weeks, not seconds.');
    if(this.f.leafOpen)return this.f.leafPlanted?'Buds on a Bryophyllum leaf can form plantlets that establish on moist soil.':'Look along the edge of the leaf for buds.';
    return this.f.growthStage===2?(this.f.budA===this.f.budB?(this.f.budA?'Both pieces have buds, so both can produce shoots.':'Neither piece has a bud, so neither produces a shoot in this model.'):'Only the piece with an eye grew a shoot. A potato tuber is a modified stem.'):'Equal moisture, oxygen and warmth. Only the presence of an eye changes.';
  }
  async write(change:LabChange){
    const epoch=this.session; this.pending++; this.error='';
    this.queue=this.queue.then(async()=>{
      if(epoch!==this.session)return;
      if(!this.attempt){
        const a=this.practice?newAttempt('practice',{},Date.now()):await this.labs.start({});
        if(epoch!==this.session)return;this.attempt=a;
      }
      const a=this.practice?changeAttempt(this.attempt,change,Date.now()):await this.labs.change(this.attempt.id,change);
      if(epoch===this.session)this.attempt=a;
    }).catch(()=>{if(epoch===this.session)this.error='Your experiment is still here, but saving failed. Retry saving or continue without saving.';})
      .finally(()=>{if(epoch===this.session)this.pending--;});
    return this.queue;
  }
  checkpoint(){
    const snapshot=JSON.parse(JSON.stringify(this.f)) as PlantFieldwork;
    void this.write({kind:'fieldwork',fieldwork:snapshot});
    for(let i=0;i<5;i++)if(this.ready(i,snapshot)&&!this.attempt?.experiments.includes(missions[i].id)&&!this.submitted)void this.write({kind:'experiment',mission:missions[i].id});
  }
  retry(){this.checkpoint();}
  async usePractice(){await this.queue;this.practice=true;this.error='';if(this.attempt)this.attempt={...this.attempt,id:'practice'};this.checkpoint();}
  open(a:LabAttempt){this.f=JSON.parse(JSON.stringify(a.fieldwork||freshFieldwork()));this.attempt=a;this.answers={...a.answers};this.confidence=a.confidence;this.rating=a.rating;this.feedback=a.feedback;this.friction=a.friction;this.notebook=false;this.selectedPart='';this.stage=a.phase==='experiment'?'explore':'summary';this.orient();}
  private orient(){if(window.innerWidth<=768)requestAnimationFrame(()=>document.querySelector(this.stage==='explore'?'.pl-trail':this.stage==='check'?'.pl-assessment':'.pl-summary')?.scrollIntoView({block:'start'}));}
  go(i:number){this.replayActive=false;this.f.mission=i;this.selectedPart='';this.mapOpen=false;this.hint=false;this.guessOpen=false;this.stage='explore';this.checkpoint();this.orient();}
  act(action:string){
    if(action==='open'){this.f.opened=true;this.selectedPart='';this.replayActive=false;}
    else if(this.parts.some(p=>p.id===action)){this.selectedPart=action;this.f.opened=true;if(!this.f.inspected.includes(action))this.f.inspected.push(action);}
    else if(action==='petal'||action==='stigma-target'){this.deliver(action==='petal'?'petal':'stigma');return;}
    else if(action==='egg'){this.f.journeyStage=3;this.replayActive=false;this.orient();}
    else if(action==='leaf-bud'){this.f.leafSeen=true;this.f.leafPlanted=true;this.replayActive=false;this.orient();}
    this.checkpoint();
  }
  primary(){
    this.orient();
    if(this.complete&&!this.replayActive){if(this.mission<4)this.go(this.mission+1);else if(this.allDone){this.stage='summary';this.notebook=false;}else this.mapOpen=true;return;}
    if(this.mission===0){if(!this.f.opened)this.act('open');else{this.inspectPulse=!this.f.inspected.includes('anther')?'anther':'ovary';this.hint=true;}return;}
    if(this.mission===1){this.deliver('stigma');return;}
    if(this.mission===2){this.f.journeyStage=Math.min(3,this.f.journeyStage+1);if(this.f.journeyStage===3)this.replayActive=false;}
    if(this.mission===3){if(this.f.dispersalOpen){this.releaseSeed();return;}if(this.f.fruitStage<2)this.f.fruitStage++;else this.f.dispersalOpen=true;}
    if(this.mission===4){if(this.f.leafOpen){this.act('leaf-bud');return;}if(this.f.growthStage<2){this.f.growthStage++;if(this.f.growthStage===2&&this.f.budA!==this.f.budB)this.f.comparedBuds=true;}else if(this.f.budA===this.f.budB){this.f.budA=true;this.f.budB=false;this.f.growthStage=0;}else{this.f.leafOpen=true;this.f.leafSeen=true;}}
    this.checkpoint();
  }
  selectSource(id:PollenSource){this.f.source=id;this.checkpoint();}
  deliver(landing:'petal'|'stigma'){this.f.landing=landing;this.f.pollenTrials=[...this.f.pollenTrials,{source:this.f.source,landing}].slice(-12);this.pollenFlash++;this.checkpoint();}
  trialLabel(t:{source:PollenSource;landing:'petal'|'stigma'}){return pollinate(t.source,t.landing).label;}
  chooseWind(v:number){this.f.wind=v;this.checkpoint();}
  releaseSeed(){this.replayActive=false;this.seedFlight++;this.f.windTrials=[...this.f.windTrials.filter(v=>v!==this.f.wind),this.f.wind];this.checkpoint();}
  toggleBud(pot:'A'|'B'){this.replayActive=true;if(pot==='A')this.f.budA=!this.f.budA;else this.f.budB=!this.f.budB;this.f.growthStage=0;this.checkpoint();}
  replay(){this.replayActive=true;if(this.mission===0){this.f.opened=!this.f.opened;}if(this.mission===2)this.f.journeyStage=0;if(this.mission===3){this.f.fruitStage=0;this.f.dispersalOpen=false;}if(this.mission===4){this.f.growthStage=0;this.f.leafOpen=false;}this.checkpoint();this.orient();}
  stepJourney(n:number){this.replayActive=true;this.f.journeyStage=Math.max(0,Math.min(3,n));this.checkpoint();this.orient();}
  predict(answer:number){void this.write({kind:'prediction',mission:this.task.id,answer});this.guessOpen=false;}
  startCheck(){this.stage='check';this.questionIndex=0;this.orient();}
  showDiscoveries(){this.stage='summary';this.orient();}
  nextQuestion(){this.questionIndex++;this.orient();}
  async check(){if(!this.allDone||this.checkedCount!==questions.length||!this.confidence)return;await this.write({kind:'assessment',answers:{...this.answers},confidence:this.confidence});if(this.submitted){this.stage='summary';this.orient();}}
  async sendFeedback(){if(!this.rating)return;await this.write({kind:'feedback',rating:this.rating,feedback:this.feedback,friction:this.friction});}
}
