import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AppCardDirective } from '../../../shared/ui/app-card/app-card.directive';
import { LiveQuizService } from '../../../services/live-quiz.service';
import { QuizService } from '../../../services/quiz.service';
import { AuthService } from '../../../services/auth.service';
import { SyllabusItem, SyllabusService } from '../../../services/syllabus.service';

@Component({
  selector: 'app-quiz-run-landing',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    AppCardDirective
  ],
  templateUrl: './quiz-run-landing.component.html',
  styleUrls: ['./quiz-run-landing.component.scss']
})
export class QuizRunLandingComponent implements OnInit, OnDestroy {
  createForm!: FormGroup;
  joinForm!: FormGroup;
  generatedQuestions: any[] = [];
  isGenerating = false;
  errorMsg = '';
  joinError = '';
  maxParticipants = 5;

  boards: string[] = [];
  standards: string[] = [];
  subjects: string[] = [];
  chapters: string[] = [];

  private syllabus: SyllabusItem[] = [];
  private userSub?: Subscription;
  private syllabusSub?: Subscription;
  currentUser: any;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private liveQuiz: LiveQuizService,
    private quizService: QuizService,
    private auth: AuthService,
    private syllabusService: SyllabusService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.createForm = this.fb.group({
      board: [''],
      standard: [''],
      subjects: [[] as string[]],
      chapters: [[] as string[]],
      count: [10, [Validators.required, Validators.min(1), Validators.max(50)]],
      perQuestionSeconds: [20, [Validators.required, Validators.min(5), Validators.max(600)]]
    });

    this.joinForm = this.fb.group({
      joinCode: ['', [Validators.required, Validators.minLength(4)]]
    });

    this.userSub = this.auth.user$.subscribe(user => {
      this.currentUser = user;
      if (user && (!this.createForm.value.board || !this.createForm.value.standard)) {
        this.patchUserDefaults();
      }
    });

    this.syllabusSub = this.syllabusService.syllabus$.subscribe(list => {
      this.syllabus = list || [];
      this.refreshBoards();
    });

    this.createForm.get('board')?.valueChanges.subscribe(board => this.onBoardChange(board));
    this.createForm.get('standard')?.valueChanges.subscribe(std => this.onStandardChange(std));
    this.createForm.get('subjects')?.valueChanges.subscribe(subs => this.onSubjectsChange(subs));
  }

  ngOnDestroy(): void {
    this.userSub?.unsubscribe();
    this.syllabusSub?.unsubscribe();
  }

  async generateQuestions(): Promise<void> {
    this.errorMsg = '';
    this.isGenerating = true;
    try {
      const board: string = this.createForm.value.board;
      const standard: string = this.createForm.value.standard;
      const subjects: string[] = this.createForm.value.subjects || [];
      const chapters: string[] = this.createForm.value.chapters || [];
      const count: number = Number(this.createForm.value.count) || 10;

      let questions: any[];
      if (board && standard && (subjects.length > 0 || chapters.length > 0)) {
        questions = await this.quizService.fetchCustomQuizQuestions(board, standard, subjects, chapters, count);
      } else {
        questions = await this.quizService.fetchQuestionsFromRandomChapter();
      }
      this.generatedQuestions = (questions || []).slice(0, count);
    } catch (err: any) {
      console.error(err);
      this.errorMsg = err?.message || 'Unable to generate questions.';
    } finally {
      this.isGenerating = false;
    }
  }

  async createRun(): Promise<void> {
    this.errorMsg = '';
    if (this.createForm.invalid) {
      this.errorMsg = 'Please complete the setup form.';
      return;
    }
    if (!this.generatedQuestions.length) {
      this.errorMsg = 'Generate questions before starting a quiz run.';
      return;
    }
    const user = this.currentUser;
    if (!user?.uid || !user?.displayName) {
      this.errorMsg = 'You must be signed in to create a quiz run.';
      return;
    }

    const board: string = this.createForm.value.board || user.board || 'Unknown';
    const standard: string = this.createForm.value.standard || user.standard || 'Unknown';
    const subjects: string[] = this.createForm.value.subjects || [];
    const chapters: string[] = this.createForm.value.chapters || [];
    const perQuestionSeconds = Number(this.createForm.value.perQuestionSeconds) || 20;
    const questionIds = this.generatedQuestions.map(q => q.id);

    try {
      const { sessionId } = await this.liveQuiz.createRunSession({
        hostId: user.uid,
        hostName: user.displayName,
        scope: {
          board,
          standard,
          subjectIds: subjects,
          chapterIds: chapters
        },
        questionIds,
        perQuestionSeconds,
        maxParticipants: this.maxParticipants
      });
      await this.liveQuiz.joinSessionDirect(sessionId, {
        uid: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL || null
      });
      this.router.navigate(['/quiz-run/lobby', sessionId]);
    } catch (err: any) {
      console.error(err);
      this.errorMsg = err?.message || 'Failed to create quiz run.';
    }
  }

  async joinRun(): Promise<void> {
    this.joinError = '';
    if (this.joinForm.invalid) return;
    const code = String(this.joinForm.value.joinCode || '').trim().toUpperCase();
    const user = this.currentUser;
    if (!user?.uid || !user?.displayName) {
      this.joinError = 'You must be signed in to join a quiz run.';
      return;
    }

    try {
      const joined = await this.liveQuiz.joinRunByCode(code, {
        uid: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL || null
      });

      if (!joined) {
        this.joinError = 'Quiz run not found or unavailable.';
        return;
      }

      if (joined.status === 'ended') {
        this.snackBar.open('This quiz run has already ended.', 'Close', { duration: 4000 });
        return;
      }

      if (joined.status === 'active') {
        this.router.navigate(['/quiz'], { queryParams: { sessionId: joined.sessionId, mode: 'run' } });
      } else {
        this.router.navigate(['/quiz-run/lobby', joined.sessionId]);
      }
    } catch (err: any) {
      console.error(err);
      this.joinError = err?.message || 'Failed to join quiz run.';
    }
  }

  get generatedCount(): number {
    return this.generatedQuestions.length;
  }

  private patchUserDefaults() {
    const board = this.currentUser?.board || '';
    const standard = this.currentUser?.standard || '';
    this.createForm.patchValue({ board, standard }, { emitEvent: false });
    this.refreshBoards();
  }

  private refreshBoards() {
    const boards = this.syllabus.map(item => item.board);
    this.boards = Array.from(new Set(boards)).sort();
    const board = this.createForm.value.board || this.currentUser?.board || this.boards[0] || '';
    this.createForm.patchValue({ board }, { emitEvent: false });
    this.onBoardChange(board, false);
  }

  private onBoardChange(board: string, reset = true) {
    const standards = this.syllabus
      .filter(item => !board || item.board === board)
      .map(item => item.standard);
    this.standards = Array.from(new Set(standards)).sort();
    const nextStandard = reset ? (this.currentUser?.standard || this.standards[0] || '') : (this.createForm.value.standard || '');
    this.createForm.patchValue({ standard: nextStandard }, { emitEvent: false });
    this.onStandardChange(nextStandard);
  }

  private onStandardChange(standard: string) {
    const board = this.createForm.value.board;
    const subjects = this.syllabus
      .filter(item => (!board || item.board === board) && (!standard || item.standard === standard))
      .map(item => item.subject);
    this.subjects = Array.from(new Set(subjects)).sort();
    this.createForm.patchValue({ subjects: [], chapters: [] }, { emitEvent: false });
    this.chapters = [];
  }

  private onSubjectsChange(subjects: string[]) {
    const board = this.createForm.value.board;
    const standard = this.createForm.value.standard;
    const chapters = this.syllabus
      .filter(item => (!board || item.board === board)
        && (!standard || item.standard === standard)
        && (subjects.length === 0 || subjects.includes(item.subject)))
      .map(item => item.chapter);
    this.chapters = Array.from(new Set(chapters)).sort();
    const selected = (this.createForm.value.chapters || []).filter((chapter: string) => this.chapters.includes(chapter));
    this.createForm.patchValue({ chapters: selected }, { emitEvent: false });
  }
}
