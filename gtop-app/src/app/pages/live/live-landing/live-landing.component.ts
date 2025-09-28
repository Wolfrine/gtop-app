import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSelectModule } from '@angular/material/select';
// removed snackbar
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { Router } from '@angular/router';
import { LiveQuizService } from '../../../services/live-quiz.service';
import { Timestamp } from '@angular/fire/firestore';
import { AuthService } from '../../../services/auth.service';
import { Subscription } from 'rxjs';
import { AppCardDirective } from '../../../shared/ui/app-card/app-card.directive';
import { QuizService } from '../../../services/quiz.service';
import { SyllabusService, SyllabusItem } from '../../../services/syllabus.service';

@Component({
  selector: 'app-live-landing',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatSelectModule,
    MatButtonToggleModule,
    AppCardDirective
  ],
  templateUrl: './live-landing.component.html',
  styleUrls: ['./live-landing.component.scss']
})
export class LiveLandingComponent implements OnInit, OnDestroy {
  createForm!: FormGroup;
  joinForm!: FormGroup;
  errorMsg = '';
  userSub?: Subscription;
  currentUser: any = null;
  generatedQuestions: any[] = [];
  isGenerating = false;
  selectionMode: 'random' | 'manual' = 'random';

  boards: string[] = [];
  standards: string[] = [];
  subjects: string[] = [];
  chapters: string[] = [];

  private syllabus: SyllabusItem[] = [];
  private upcomingUnsub?: () => void;
  upcomingSessions: { id: string; joinCode: string; hostName: string; scheduledStartAt: any; bufferSeconds: number }[] = [];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private live: LiveQuizService,
    private auth: AuthService,
    private quizService: QuizService,
    private syllabusService: SyllabusService
  ) {}

  ngOnInit(): void {
    this.createForm = this.fb.group({
      board: [''],
      standard: [''],
      subjects: [[] as string[]],
      chapters: [[] as string[]],
      count: [10, [Validators.required, Validators.min(1), Validators.max(100)]],
      bufferMinutes: [5, [Validators.required, Validators.min(0), Validators.max(180)]],
      perQuestionSeconds: [20, [Validators.required, Validators.min(5), Validators.max(600)]]
    });

    this.joinForm = this.fb.group({
      joinCode: ['', [Validators.required, Validators.minLength(4)]]
    });

    this.userSub = this.auth.user$.subscribe(u => this.currentUser = u);

    // Populate cascaded filters from syllabus
    this.syllabusService.syllabus$.subscribe(list => {
      this.syllabus = list || [];
      this.boards = Array.from(new Set(this.syllabus.map(s => s.board))).sort();
      const currentBoard = this.createForm.value.board || this.currentUser?.board || this.boards[0] || '';
      this.createForm.patchValue({ board: currentBoard }, { emitEvent: false });
      this.onBoardChange(currentBoard, false);
    });

    // React to form changes for cascading
    this.createForm.get('board')?.valueChanges.subscribe(v => this.onBoardChange(v));
    this.createForm.get('standard')?.valueChanges.subscribe(v => this.onStandardChange(v));
    this.createForm.get('subjects')?.valueChanges.subscribe(v => this.onSubjectsChange(v));

    // Default start time: now + 10 minutes
    const start = new Date(Date.now() + 10 * 60 * 1000);
    this.createForm.addControl('startAt', this.fb.control(this.toDateTimeLocal(start), [Validators.required]));

    // Observe upcoming sessions for join list
    this.observeUpcoming();
  }

  ngOnDestroy(): void {
    this.userSub?.unsubscribe();
    this.upcomingUnsub?.();
  }

  async createSession(): Promise<void> {
    this.errorMsg = '';
    if (this.createForm.invalid) return;

    const { board, standard } = this.createForm.value;
    const selectedSubjects: string[] = this.createForm.value.subjects || [];
    const selectedChapters: string[] = this.createForm.value.chapters || [];
    const bufferMinutes = Number(this.createForm.value.bufferMinutes) || 0;
    const bufferSeconds = bufferMinutes * 60;
    const perQuestionSeconds = Number(this.createForm.value.perQuestionSeconds) || 20;
    // Require explicit randomize before hosting
    if (!this.generatedQuestions.length) {
      this.errorMsg = 'Please click Randomize to generate questions before creating the session.';
      return;
    }
    const questionIds = (this.generatedQuestions || []).map((q: any) => q.id);

    const user = this.currentUser;
    if (!user?.uid || !user?.displayName) {
      this.errorMsg = 'You must be signed in to create a session.';
      return;
    }

    try {
      const startAtStr: string = this.createForm.value.startAt;
      const startAt = startAtStr ? new Date(startAtStr) : new Date();
      const now = Timestamp.fromDate(startAt);
      const { sessionId } = await this.live.createSession({
        hostId: user.uid,
        hostName: user.displayName,
        scope: {
          board: board || user.board || 'Unknown',
          standard: standard || user.standard || 'Unknown',
          subjectIds: selectedSubjects,
          chapterIds: selectedChapters
        },
        questionIds,
        scheduledStartAt: now,
        bufferSeconds,
        perQuestionSeconds,
        autoAdvance: true
      });

      this.router.navigate(['/live/host', sessionId]);
    } catch (err: any) {
      console.error(err);
      this.errorMsg = err?.message || 'Failed to create session.';
    }
  }

  async joinByCode(): Promise<void> {
    this.errorMsg = '';
    if (this.joinForm.invalid) return;

    const code = String(this.joinForm.value.joinCode || '').trim().toUpperCase();
    const user = this.currentUser;
    if (!user?.uid || !user?.displayName) {
      this.errorMsg = 'You must be signed in to join a session.';
      return;
    }

    try {
      const joined = await this.live.joinSessionByCode(code, {
        uid: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL || null
      });

      if (!joined) {
        this.errorMsg = 'No active lobby found for this code.';
        return;
      }

      this.router.navigate(['/live/play', joined.sessionId]);
    } catch (err: any) {
      console.error(err);
      this.errorMsg = err?.message || 'Failed to join session.';
    }
  }

  async generateQuestionIds(): Promise<void> {
    this.errorMsg = '';
    this.isGenerating = true;
    try {
      // If board + standard selected and at least one subject/chapter chosen, prefer filter-based generation
      const board: string = this.createForm.value.board;
      const standard: string = this.createForm.value.standard;
      const subjects: string[] = this.createForm.value.subjects || [];
      const chapters: string[] = this.createForm.value.chapters || [];
      const count: number = Number(this.createForm.value.count) || 10;

      let qs: any[];
      if (board && standard && (subjects.length > 0 || chapters.length > 0)) {
        qs = await this.quizService.fetchCustomQuizQuestions(board, standard, subjects, chapters, count);
      } else {
        qs = await this.quizService.fetchQuestionsFromRandomChapter();
      }
      this.generatedQuestions = (qs || []).slice(0, count);
    } catch (err: any) {
      console.error(err);
      this.errorMsg = err?.message || 'Failed to generate questions.';
    } finally {
      this.isGenerating = false;
    }
  }

  // copyIds removed

  // Join a listed upcoming session directly
  async joinUpcoming(sessionId: string): Promise<void> {
    this.errorMsg = '';
    const user = this.currentUser;
    if (!user?.uid || !user?.displayName) {
      this.errorMsg = 'You must be signed in to join a session.';
      return;
    }
    try {
      await this.live.joinSessionDirect(sessionId, {
        uid: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL || null
      });
      this.router.navigate(['/live/play', sessionId]);
    } catch (err: any) {
      console.error(err);
      this.errorMsg = err?.message || 'Failed to join session.';
    }
  }

  private onBoardChange(board: string, resetStandard: boolean = true) {
    const standards = this.syllabus
      .filter(s => !board || s.board === board)
      .map(s => s.standard);
    this.standards = Array.from(new Set(standards)).sort();
    const nextStandard = resetStandard ? (this.currentUser?.standard || this.standards[0] || '') : (this.createForm.value.standard || '');
    this.createForm.patchValue({ standard: nextStandard }, { emitEvent: false });
    this.onStandardChange(nextStandard);
  }

  private onStandardChange(standard: string) {
    const board = this.createForm.value.board;
    const subjects = this.syllabus
      .filter(s => (!board || s.board === board) && (!standard || s.standard === standard))
      .map(s => s.subject);
    this.subjects = Array.from(new Set(subjects)).sort();
    // reset dependent fields
    this.createForm.patchValue({ subjects: [], chapters: [] }, { emitEvent: false });
    this.chapters = [];
  }

  private onSubjectsChange(subjects: string[]) {
    const board = this.createForm.value.board;
    const standard = this.createForm.value.standard;
    const chapters = this.syllabus
      .filter(s => (!board || s.board === board) && (!standard || s.standard === standard) && (subjects.length === 0 || subjects.includes(s.subject)))
      .map(s => s.chapter);
    this.chapters = Array.from(new Set(chapters)).sort();
    // Keep selected chapters that still exist
    const selected = (this.createForm.value.chapters || []).filter((c: string) => this.chapters.includes(c));
    this.createForm.patchValue({ chapters: selected }, { emitEvent: false });
  }

  private toDateTimeLocal(d: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  }

  // Derived schedule getters to avoid stale reads
  get startAtDate(): Date | null {
    const startAtStr: string = this.createForm.value.startAt;
    if (!startAtStr) return null;
    return new Date(startAtStr);
  }

  get lobbyOpensAt(): Date | null {
    const start = this.startAtDate;
    if (!start) return null;
    const bufferMinutes = Number(this.createForm.get('bufferMinutes')?.value) || 0;
    return new Date(start.getTime() - bufferMinutes * 60000);
  }

  get isAdmin(): boolean {
    return (this.currentUser?.role || '').toLowerCase() === 'admin';
  }

  private observeUpcoming() {
    this.upcomingUnsub?.();
    this.upcomingUnsub = this.live.observeUpcomingSessions((items) => {
      this.upcomingSessions = items.map((s: any) => ({
        id: s.id,
        joinCode: s.joinCode,
        hostName: s.hostName,
        scheduledStartAt: s.scheduledStartAt,
        bufferSeconds: Number(s.bufferSeconds || 0)
      }));
    });
  }
}
