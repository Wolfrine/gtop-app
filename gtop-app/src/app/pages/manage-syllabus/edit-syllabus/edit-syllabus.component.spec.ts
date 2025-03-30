import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditSyllabusComponent } from './edit-syllabus.component';

describe('EditSyllabusComponent', () => {
  let component: EditSyllabusComponent;
  let fixture: ComponentFixture<EditSyllabusComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditSyllabusComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(EditSyllabusComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
