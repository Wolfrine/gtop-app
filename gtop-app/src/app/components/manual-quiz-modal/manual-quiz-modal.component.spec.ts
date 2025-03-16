import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManualQuizModalComponent } from './manual-quiz-modal.component';

describe('ManualQuizModalComponent', () => {
  let component: ManualQuizModalComponent;
  let fixture: ComponentFixture<ManualQuizModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManualQuizModalComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ManualQuizModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
