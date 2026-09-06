import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { baseline, questions, missions, score, pollinate, PollenSource, fertilisationStep, journey } from './plant-lesson';
import { Answers, LabAttempt, LabChange, newAttempt, changeAttempt } from './plant-attempt';
import { PlantLabService } from './plant-lab.service';
import { LabChoicesComponent } from './choices.component';
import { PlantDiagramComponent } from './plant-diagram.component';
@Component({
  selector: 'app-plant-lab', standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LabChoicesComponent, PlantDiagramComponent],
  templateUrl: './plant-lab.component.html',
})
export class PlantLabComponent implements OnInit, OnDestroy {
  readonly baseline = baseline; readonly questions = questions; readonly missions = missions;
  readonly confidenceOptions = ['Still unsure', 'With some help', 'Mostly confident', 'Very confident'];
  readonly ratingOptions = ['Not useful', 'A little useful', 'Somewhat useful', 'Useful', 'Very useful'];
  readonly parts = [
    { id: 'anther', name: 'Anther', text: 'Produces pollen grains. Each anther sits on a filament; together they form a stamen.' },
    { id: 'stigma', name: 'Stigma', text: 'The receptive tip of the pistil. Pollen must arrive here for pollination.' },
    { id: 'style', name: 'Style', text: 'Connects stigma and ovary. A pollen tube grows through it toward an ovule.' },
    { id: 'ovary', name: 'Ovary & ovules', text: 'The ovary encloses ovules. Inside each ovule is an embryo sac containing the egg cell.' },
  ];
  readonly sources: {id: PollenSource; name: string}[] = [
    {id:'same-flower',name:'This flower'}, {id:'same-plant',name:'Another flower · same plant'},
    {id:'other-plant',name:'Another plant · same species'}, {id:'other-species',name:'A different species'},
  ];
  stage = 'predict'; initial: Answers = {}; answers: Answers = {}; attempt?: LabAttempt;
  history: LabAttempt[] = []; practice = false; loading = false; restoring = true; error = ''; saved = '';
  mission = 0; confidence = 0; rating = 0; feedback = ''; friction = '';
  opened = false; selectedPart = 'stigma'; inspected: string[] = [];
  source: PollenSource = 'same-flower'; landing: 'petal'|'stigma' = 'petal';
  pollenResult?: ReturnType<typeof pollinate>; triedPetal = false; delivered = false;
  time = 0; dispersal = ''; cloneTime = 0; cloneRun = false; leafSeen = false; hint = false;
  private unwatch?: () => void; private session = 0;
  constructor(private labs: PlantLabService, private router: Router, private zone: NgZone) {}
  ngOnDestroy() { this.session++; this.unwatch?.(); }
  private clearAccount() {
    this.session++; this.attempt = undefined; this.history = []; this.initial = {}; this.answers = {};
    this.feedback = ''; this.friction = ''; this.stage = 'predict';
    void this.router.navigate(['/learning-lab']);
  }
  async ngOnInit() {
    this.unwatch ||= this.labs.watchAccount(() => this.zone.run(() => this.clearAccount()));
    const session = this.session;
    this.restoring = true;
    try { const history = await this.labs.load(); if (session === this.session) this.history = history; }
    catch { this.error = 'Saved attempts could not load. Retry, or choose Try without saving.'; }
    finally { this.restoring = false; }
  }
  get task() { return missions[this.mission]; }
  get predicted() { return this.attempt?.predictions[this.task.id] !== undefined; }
  get complete() { return this.attempt?.experiments.includes(this.task.id) || false; }
  get allDone() { return missions.every(m => this.attempt?.experiments.includes(m.id)); }
  get submitted() { return !!this.attempt && this.attempt.phase !== 'experiment'; }
  get sent() { return this.attempt?.phase === 'complete'; }
  get result() { return score(this.attempt?.answers || {}); }
  get part() { return this.parts.find(p => p.id === this.selectedPart)!; }
  get journeyStep() { return fertilisationStep(this.time); }
  get journeyText() { return journey[this.journeyStep]; }
  get canStart() { return baseline.every(q => this.initial[q.id] !== undefined) && !this.loading; }
  get canCheck() { return this.allDone && questions.every(q => this.answers[q.id] !== undefined) && this.confidence > 0 && !this.loading; }
  get atTarget() {
    return this.mission === 0 ? this.opened && ['anther','ovary'].every(p=>this.inspected.includes(p))
      : this.mission === 1 ? this.triedPetal && this.delivered
      : this.mission === 2 ? this.time === 100
      : this.mission === 3 ? this.time === 100 && this.dispersal === 'wind'
      : this.cloneRun && this.cloneTime === 100 && this.leafSeen;
  }
  open(a: LabAttempt) {
    this.attempt = a; this.initial = {...a.baseline}; this.answers = {...a.answers};
    this.confidence = a.confidence; this.rating = a.rating; this.friction = a.friction; this.feedback = a.feedback;
    this.stage = a.phase !== 'experiment' || missions.every(m=>a.experiments.includes(m.id)) ? 'check' : 'experiment';
    const next = missions.findIndex(m=>!a.experiments.includes(m.id)); this.loadMission(next < 0 ? 0 : next);
  }
  async begin(save: boolean) {
    if (!this.canStart || (save && this.restoring)) return;
    const session = this.session;
    this.loading = true; this.error = ''; this.saved = '';
    try {
      const a = save ? await this.labs.start(this.initial) : newAttempt('practice',this.initial,Date.now());
      if (session !== this.session) return;
      this.practice = !save; this.open(a); this.saved = save ? 'Attempt saved to your GTOP account.' : '';
    } catch { this.error = 'Your predictions are still here. Saving failed; retry, or try without saving.'; }
    finally { this.loading = false; }
  }
  loadMission(i: number) {
    this.mission = i; this.opened = false; this.inspected = []; this.selectedPart = 'stigma';
    this.time = 0; this.source = 'same-flower'; this.landing = 'petal'; this.pollenResult = undefined;
    this.triedPetal = false; this.delivered = false; this.dispersal = ''; this.cloneTime = 0;
    this.cloneRun = false; this.leafSeen = false; this.hint = false;
  }
  inspect(id: string) { this.selectedPart = id; if (this.opened && !this.inspected.includes(id)) this.inspected.push(id); }
  deliver() { this.pollenResult = pollinate(this.source, this.landing); this.triedPetal ||= this.landing === 'petal'; this.delivered ||= this.pollenResult.accepted; }
  async save(change: LabChange) {
    if (!this.attempt || this.loading) return;
    const session = this.session;
    this.loading = true; this.error = ''; this.saved = '';
    try {
      const updated = this.practice ? changeAttempt(this.attempt,change,Date.now()) : await this.labs.change(this.attempt.id,change);
      if (session !== this.session) return;
      this.attempt = updated;
      if (this.submitted) { this.answers = {...this.attempt.answers}; this.confidence = this.attempt.confidence; }
      if (this.sent) { this.rating = this.attempt.rating; this.feedback = this.attempt.feedback; this.friction = this.attempt.friction; }
      this.saved = this.practice ? '' : 'Progress saved to your GTOP account.';
    } catch { this.error = 'This step was not saved. Your inputs are still here; check your connection and retry.'; }
    finally { this.loading = false; }
  }
  predict(answer: number) { void this.save({kind:'prediction',mission:this.task.id,answer}); }
  record() { if (this.atTarget && this.predicted && !this.submitted) void this.save({kind:'experiment',mission:this.task.id}); }
  check() { if (this.canCheck) void this.save({kind:'assessment',answers:this.answers,confidence:this.confidence}); }
  sendFeedback() { if(this.rating) void this.save({kind:'feedback',rating:this.rating,friction:this.friction,feedback:this.feedback}); }
}
