import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { signal } from '@angular/core';

import { UserListComponent } from './user-list.component';
import { ActiveUsersService } from '../../../services/active-users.service';
import { AuthService } from '../../../services/auth.service';

class ActiveUsersServiceStub {
  listenToUsersCollection = jasmine.createSpy('listenToUsersCollection');
  listenToActiveUsers = jasmine.createSpy('listenToActiveUsers');
  allUsers = signal<any[]>([]);
  activeInactiveUsers = signal<any[]>([]);
  updateUserRole = jasmine.createSpy('updateUserRole').and.returnValue(Promise.resolve());
}

class AuthServiceStub {
  getUser() {
    return of(null);
  }
}

describe('UserListComponent', () => {
  let component: UserListComponent;
  let fixture: ComponentFixture<UserListComponent>;

  beforeEach(async () => {
    const activeUsersServiceStub = new ActiveUsersServiceStub();

    await TestBed.configureTestingModule({
      imports: [UserListComponent],
      providers: [
        { provide: ActiveUsersService, useValue: activeUsersServiceStub },
        { provide: AuthService, useClass: AuthServiceStub },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
