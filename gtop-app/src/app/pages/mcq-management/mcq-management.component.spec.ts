import { ComponentFixture, TestBed } from '@angular/core/testing';

import { McqManagementComponent } from './mcq-management.component';

describe('McqManagementComponent', () => {
  let component: McqManagementComponent;
  let fixture: ComponentFixture<McqManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [McqManagementComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(McqManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
