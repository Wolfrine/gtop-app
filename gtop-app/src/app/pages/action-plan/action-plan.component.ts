import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import {
  ActionPlanActor,
  ActionPlanDraft,
  ActionPlanItem,
  ActionPlanPriority,
  ActionPlanService,
  ActionPlanStatus,
} from '../../services/action-plan.service';

type StatusFilter = 'active' | 'all' | ActionPlanStatus;

@Component({
  selector: 'app-action-plan',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],
  templateUrl: './action-plan.component.html',
  styleUrls: ['./action-plan.component.scss'],
})
export class ActionPlanComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private actor: ActionPlanActor = { name: 'GTOP admin' };
  private starterPlanAttempted = false;

  readonly statuses: Array<{ value: ActionPlanStatus; label: string; icon: string }> = [
    { value: 'planned', label: 'Planned', icon: 'event_note' },
    { value: 'in-progress', label: 'In progress', icon: 'play_circle' },
    { value: 'blocked', label: 'Blocked', icon: 'warning' },
    { value: 'review', label: 'Ready for review', icon: 'rate_review' },
    { value: 'done', label: 'Done', icon: 'check_circle' },
  ];

  readonly priorities: Array<{ value: ActionPlanPriority; label: string }> = [
    { value: 'critical', label: 'Critical' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
  ];

  plans: ActionPlanItem[] = [];
  filteredPlans: ActionPlanItem[] = [];
  statusFilter: StatusFilter = 'active';
  searchTerm = '';
  isLoading = true;
  isSaving = false;
  isEditorOpen = false;
  editingId: string | null = null;
  loadError = '';

  readonly planForm = this.formBuilder.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(120)]],
    description: ['', [Validators.required, Validators.maxLength(1200)]],
    area: ['', [Validators.required, Validators.maxLength(80)]],
    owner: ['', [Validators.required, Validators.maxLength(120)]],
    status: ['planned' as ActionPlanStatus, Validators.required],
    priority: ['medium' as ActionPlanPriority, Validators.required],
    dueDate: [''],
    acceptanceCriteria: ['', Validators.maxLength(1200)],
    latestUpdate: ['', Validators.maxLength(1200)],
    sourceReference: ['', Validators.maxLength(300)],
  });

  constructor(
    private formBuilder: FormBuilder,
    private actionPlanService: ActionPlanService,
    private authService: AuthService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.authService.getUser()
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        if (user) {
          this.actor = {
            uid: user.uid || null,
            name: user.displayName || user.email || 'GTOP admin',
            email: user.email || null,
          };
        }
      });

    this.actionPlanService.observePlans()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: plans => {
          this.plans = plans;
          this.isLoading = false;
          this.loadError = '';
          this.applyFilters();
          void this.ensureStarterPlan();
        },
        error: error => {
          console.error('Unable to load GTOP action plans', error);
          this.isLoading = false;
          this.loadError = 'The action plan could not be loaded. Ask a Firebase administrator to allow admin access to the actionPlans collection.';
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get activeCount(): number {
    return this.plans.filter(plan => plan.status !== 'done').length;
  }

  get blockedCount(): number {
    return this.plans.filter(plan => plan.status === 'blocked').length;
  }

  get reviewCount(): number {
    return this.plans.filter(plan => plan.status === 'review').length;
  }

  get doneCount(): number {
    return this.plans.filter(plan => plan.status === 'done').length;
  }

  openCreate(): void {
    this.editingId = null;
    this.planForm.reset({
      title: '',
      description: '',
      area: '',
      owner: '',
      status: 'planned',
      priority: 'medium',
      dueDate: '',
      acceptanceCriteria: '',
      latestUpdate: '',
      sourceReference: '',
    });
    this.isEditorOpen = true;
  }

  openEdit(plan: ActionPlanItem): void {
    this.editingId = plan.id || null;
    this.planForm.reset({
      title: plan.title,
      description: plan.description,
      area: plan.area,
      owner: plan.owner,
      status: plan.status,
      priority: plan.priority,
      dueDate: plan.dueDate || '',
      acceptanceCriteria: plan.acceptanceCriteria || '',
      latestUpdate: plan.latestUpdate || '',
      sourceReference: plan.sourceReference || '',
    });
    this.isEditorOpen = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  closeEditor(): void {
    this.isEditorOpen = false;
    this.editingId = null;
  }

  async savePlan(): Promise<void> {
    if (this.planForm.invalid) {
      this.planForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    const value = this.planForm.getRawValue();
    const draft: ActionPlanDraft = {
      ...value,
      dueDate: value.dueDate || null,
    };

    try {
      if (this.editingId) {
        await this.actionPlanService.updatePlan(this.editingId, draft, this.actor);
        this.snackBar.open('Action plan updated', 'Close', { duration: 3000 });
      } else {
        await this.actionPlanService.createPlan(draft, this.actor);
        this.snackBar.open('Action plan created', 'Close', { duration: 3000 });
      }
      this.closeEditor();
    } catch (error) {
      console.error('Unable to save GTOP action plan', error);
      this.snackBar.open('Could not save. Check Firestore admin permissions.', 'Close', { duration: 6000 });
    } finally {
      this.isSaving = false;
    }
  }

  async changeStatus(plan: ActionPlanItem, status: ActionPlanStatus): Promise<void> {
    if (!plan.id || plan.status === status) {
      return;
    }

    try {
      await this.actionPlanService.updatePlan(plan.id, { status }, this.actor);
      this.snackBar.open(`Moved to ${this.statusLabel(status)}`, 'Close', { duration: 2500 });
    } catch (error) {
      console.error('Unable to update action plan status', error);
      this.snackBar.open('Status update failed', 'Close', { duration: 4000 });
    }
  }

  async archive(plan: ActionPlanItem): Promise<void> {
    if (!plan.id || plan.status !== 'done') {
      return;
    }

    try {
      await this.actionPlanService.archivePlan(plan.id, this.actor);
      this.snackBar.open('Completed activity archived', 'Close', { duration: 3000 });
    } catch (error) {
      console.error('Unable to archive action plan', error);
      this.snackBar.open('Archive failed', 'Close', { duration: 4000 });
    }
  }

  setStatusFilter(value: StatusFilter): void {
    this.statusFilter = value;
    this.applyFilters();
  }

  updateSearch(value: string): void {
    this.searchTerm = value;
    this.applyFilters();
  }

  applyFilters(): void {
    const search = this.searchTerm.trim().toLowerCase();
    this.filteredPlans = this.plans.filter(plan => {
      const matchesStatus = this.statusFilter === 'all'
        || (this.statusFilter === 'active' && plan.status !== 'done')
        || plan.status === this.statusFilter;
      const searchText = [
        plan.title,
        plan.description,
        plan.area,
        plan.owner,
        plan.latestUpdate,
        plan.sourceReference,
      ].join(' ').toLowerCase();
      return matchesStatus && (!search || searchText.includes(search));
    });
  }

  statusLabel(status: ActionPlanStatus): string {
    return this.statuses.find(option => option.value === status)?.label || status;
  }

  updatedDate(value: any): Date | null {
    if (value?.toDate) {
      return value.toDate();
    }
    return value instanceof Date ? value : null;
  }

  trackByPlanId(_: number, plan: ActionPlanItem): string {
    return plan.id || plan.title;
  }

  private async ensureStarterPlan(): Promise<void> {
    if (this.starterPlanAttempted || this.isLoading || this.plans.length > 0 || this.loadError) {
      return;
    }

    this.starterPlanAttempted = true;
    try {
      await this.actionPlanService.createPlan({
        title: 'Create and validate GTOP UI v2',
        description: 'Design a substantially improved GTOP experience, validate it with business users and QA in an isolated Firebase UAT environment, then migrate production through a controlled rollout.',
        area: 'Product design and frontend',
        owner: 'Product, design, engineering and QA agents',
        status: 'planned',
        priority: 'high',
        dueDate: null,
        acceptanceCriteria: 'Approved learner journeys, reusable design system, passing quality gates, business and QA sign-off, monitored production rollout, and a tested rollback path.',
        latestUpdate: 'Repository, UI, testing and Firebase prerequisites were audited. Next step: stabilize the baseline and approve the v2 design direction.',
        sourceReference: 'agent_uiux_plan.md',
      }, this.actor);
    } catch (error) {
      console.error('Unable to seed the initial GTOP action plan', error);
      this.snackBar.open('The board is ready, but the starter activity could not be created. Check Firestore permissions.', 'Close', { duration: 7000 });
    }
  }
}
