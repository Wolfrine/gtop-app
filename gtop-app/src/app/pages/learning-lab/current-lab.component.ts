import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  baseline,
  questions,
  missions,
  circuit,
  score,
  CircuitMode,
} from './lesson';
import {
  Answers,
  LabAttempt,
  LabChange,
  newAttempt,
  changeAttempt,
} from './attempt';
import { LearningLabService } from './learning-lab.service';
import { LabChoicesComponent } from './choices.component';
import { LabCircuitComponent } from './circuit.component';

@Component({
  selector: 'app-current-lab',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    LabChoicesComponent,
    LabCircuitComponent,
  ],
  templateUrl: './current-lab.component.html',
})
export class CurrentLabComponent implements OnInit {
  readonly baseline = baseline;
  readonly questions = questions;
  readonly missions = missions;
  readonly modes: CircuitMode[] = ['single', 'series', 'parallel'];
  readonly confidenceOptions = [
    'Still unsure',
    'With some help',
    'Mostly confident',
    'Very confident',
  ];
  readonly ratingOptions = [
    'Not useful',
    'A little useful',
    'Somewhat useful',
    'Useful',
    'Very useful',
  ];
  readonly concepts = [
    [
      'V',
      'Voltage',
      'Energy supplied per unit charge. Think of it as the electrical push.',
      'volts (V)',
    ],
    [
      'I',
      'Current',
      'The amount of charge passing a point each second.',
      'amperes (A)',
    ],
    [
      'R',
      'Resistance',
      'How much a component opposes current at a given voltage.',
      'ohms (Ω)',
    ],
  ];
  stage = 'predict';
  initial: Answers = {};
  answers: Answers = {};
  attempt?: LabAttempt;
  history: LabAttempt[] = [];
  practice = false;
  loading = false;
  restoring = true;
  error = '';
  saved = '';
  mission = 0;
  voltage = 6;
  r1 = 6;
  r2 = 6;
  mode: CircuitMode = 'single';
  closed = true;
  confidence = 0;
  rating = 0;
  feedback = '';
  friction = '';
  constructor(private labs: LearningLabService) {}
  async ngOnInit() {
    try {
      this.history = await this.labs.load();
    } catch {
      this.error =
        'Could not load saved attempts. Check your connection and retry, or try without saving.';
    } finally {
      this.restoring = false;
    }
  }
  get task() {
    return missions[this.mission];
  }
  get values() {
    return circuit(this.voltage, this.r1, this.r2, this.mode, this.closed);
  }
  get predicted() {
    return this.attempt?.predictions[this.task.id] !== undefined;
  }
  get complete() {
    return this.attempt?.experiments.includes(this.task.id) || false;
  }
  get allDone() {
    return missions.every((m) => this.attempt?.experiments.includes(m.id));
  }
  get submitted() {
    return !!this.attempt && this.attempt.phase !== 'experiment';
  }
  get sent() {
    return this.attempt?.phase === 'complete';
  }
  get result() {
    return score(this.attempt?.answers || {});
  }
  get atTarget() {
    return (
      this.closed &&
      (this.mission === 0
        ? this.mode === 'single' && this.voltage === 12 && this.r1 === 6
        : this.mission === 1
          ? this.mode === 'single' && this.voltage === 6 && this.r1 === 12
          : this.mode === 'parallel' &&
            this.voltage === 6 &&
            this.r1 === 6 &&
            this.r2 === 6)
    );
  }
  get canStart() {
    return (
      baseline.every((q) => this.initial[q.id] !== undefined) &&
      !this.loading &&
      !this.restoring
    );
  }
  get canCheck() {
    return (
      this.allDone &&
      questions.every((q) => this.answers[q.id] !== undefined) &&
      this.confidence > 0 &&
      !this.loading
    );
  }
  fmt(n: number) {
    return Number(n.toFixed(2)).toString();
  }
  open(a: LabAttempt) {
    this.attempt = a;
    this.initial = { ...a.baseline };
    this.answers = { ...a.answers };
    this.confidence = a.confidence;
    this.rating = a.rating;
    this.friction = a.friction;
    this.feedback = a.feedback;
    this.stage =
      a.phase !== 'experiment' ||
      missions.every((m) => a.experiments.includes(m.id))
        ? 'check'
        : 'experiment';
    const next = missions.findIndex((m) => !a.experiments.includes(m.id));
    this.loadMission(next < 0 ? 0 : next);
  }
  async begin(save: boolean) {
    if (!this.canStart) return;
    this.loading = true;
    this.error = '';
    this.saved = '';
    try {
      const a = save
        ? await this.labs.start(this.initial)
        : newAttempt('practice', this.initial, Date.now());
      this.practice = !save;
      this.open(a);
      this.saved = save ? 'Attempt saved to your GTOP account.' : '';
    } catch {
      this.error =
        'Could not start a saved attempt. Your predictions are still here. Check your connection and retry, or try without saving.';
    } finally {
      this.loading = false;
    }
  }
  loadMission(i: number) {
    this.mission = i;
    this.voltage = 6;
    this.r1 = 6;
    this.r2 = 6;
    this.mode = i === 2 ? 'series' : 'single';
    this.closed = true;
  }
  async save(change: LabChange) {
    if (!this.attempt || this.loading) return;
    this.loading = true;
    this.error = '';
    this.saved = '';
    try {
      this.attempt = this.practice
        ? changeAttempt(this.attempt, change, Date.now())
        : await this.labs.change(this.attempt.id, change);
      this.answers = this.submitted
        ? { ...this.attempt.answers }
        : this.answers;
      this.confidence = this.submitted
        ? this.attempt.confidence
        : this.confidence;
      if (this.sent) {
        this.rating = this.attempt.rating;
        this.friction = this.attempt.friction;
        this.feedback = this.attempt.feedback;
      }
      this.saved = this.practice ? '' : 'Progress saved to your GTOP account.';
    } catch (e) {
      this.error =
        'Could not save this step. Your inputs are still here; check your connection and retry.';
    } finally {
      this.loading = false;
    }
  }
  predict(answer: number) {
    void this.save({ kind: 'prediction', mission: this.task.id, answer });
  }
  record() {
    if (this.atTarget && this.predicted)
      void this.save({ kind: 'experiment', mission: this.task.id });
  }
  check() {
    if (this.canCheck)
      void this.save({
        kind: 'assessment',
        answers: this.answers,
        confidence: this.confidence,
      });
  }
  sendFeedback() {
    if (this.rating)
      void this.save({
        kind: 'feedback',
        rating: this.rating,
        feedback: this.feedback,
        friction: this.friction,
      });
  }
}
