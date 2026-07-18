import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { BehaviorSubject, of } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ActionPlanItem, ActionPlanService } from '../../services/action-plan.service';
import { ActionPlanComponent } from './action-plan.component';

describe('ActionPlanComponent', () => {
  let fixture: ComponentFixture<ActionPlanComponent>;
  let component: ActionPlanComponent;
  let plans$: BehaviorSubject<ActionPlanItem[]>;
  let service: jasmine.SpyObj<ActionPlanService>;

  beforeEach(async () => {
    plans$ = new BehaviorSubject<ActionPlanItem[]>([
      {
        id: 'plan-1',
        title: 'Design GTOP UI v2',
        description: 'Create the improved learner experience.',
        area: 'UI/UX',
        owner: 'Design agent',
        status: 'in-progress',
        priority: 'high',
        latestUpdate: 'Dashboard concepts are in progress.',
      },
      {
        id: 'plan-2',
        title: 'Validate production rollout',
        description: 'Confirm release gates.',
        area: 'QA',
        owner: 'QA team',
        status: 'done',
        priority: 'medium',
      },
    ]);
    service = jasmine.createSpyObj<ActionPlanService>('ActionPlanService', [
      'observePlans',
      'createPlan',
      'updatePlan',
      'archivePlan',
    ]);
    service.observePlans.and.returnValue(plans$.asObservable());
    service.createPlan.and.resolveTo();
    service.updatePlan.and.resolveTo();
    service.archivePlan.and.resolveTo();

    await TestBed.configureTestingModule({
      imports: [ActionPlanComponent, NoopAnimationsModule],
      providers: [
        { provide: ActionPlanService, useValue: service },
        {
          provide: AuthService,
          useValue: { getUser: () => of({ uid: 'admin-1', displayName: 'Admin', role: 'admin' }) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ActionPlanComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows active work by default', () => {
    expect(component.filteredPlans.map(plan => plan.id)).toEqual(['plan-1']);
    expect(component.activeCount).toBe(1);
    expect(component.doneCount).toBe(1);
  });

  it('filters plans by search text', () => {
    component.setStatusFilter('all');
    component.updateSearch('qa team');

    expect(component.filteredPlans.map(plan => plan.id)).toEqual(['plan-2']);
  });

  it('updates status through the action plan service', async () => {
    await component.changeStatus(component.plans[0], 'review');

    expect(service.updatePlan).toHaveBeenCalledWith(
      'plan-1',
      { status: 'review' },
      jasmine.objectContaining({ uid: 'admin-1', name: 'Admin' }),
    );
  });
});
