import { Component, OnInit, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../services/auth.service';
import { PracticeInviteService } from '../../services/practice-invite.service';
import { PracticeScope, matchesProfile, parsePracticeScope, practiceParams, practiceReturns } from '../../services/practice-invite.domain';

@Component({
  standalone: true, imports: [CommonModule, RouterLink, MatButtonModule],
  templateUrl: './practice-invite.component.html', styleUrl: './practice-invite.component.scss'
})
export class PracticeInviteComponent implements OnInit {
  readonly auth = inject(AuthService); readonly invites = inject(PracticeInviteService);
  private readonly route = inject(ActivatedRoute); private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly scope = signal<PracticeScope | null>(null); readonly profile = signal<any>(null);
  readonly ready = signal(false); readonly error = signal('');
  get mismatch() { const scope = this.scope(); return !!scope && !!this.profile()?.board && !!this.profile()?.standard && !matchesProfile(scope, this.profile()); }
  get available() { const scope = this.scope(); return !!scope && !!this.invites.seed(scope); }
  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.scope.set(parsePracticeScope(params)); this.error.set(params.get('unavailable') ? 'These five questions could not be checked. Try again when you are online, or ask for a new practice link.' : '');
      const scope = this.scope(); if (scope) this.invites.track(this.invites.seed(scope) && !this.error() ? 'invite_open' : 'invite_exposure');
    });
    this.auth.readyUser$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(profile => { this.profile.set(profile); this.ready.set(true); });
  }
  start(): void {
    const scope = this.scope(); if (!scope || this.mismatch || !this.available) return;
    // AuthGuard retains the entire requested URL through sign-in and profile setup.
    const params = this.route.snapshot.queryParamMap;
    void this.router.navigate(['/quiz'], { queryParams: { ...practiceParams(scope), practice: 'invite', ...practiceReturns(params) }, state: { newInvitation: true } });
  }
}
