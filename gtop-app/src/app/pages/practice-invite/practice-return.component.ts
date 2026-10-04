import { Component, OnInit, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PracticeInviteService } from '../../services/practice-invite.service';
import { PracticeCue, practiceParams } from '../../services/practice-invite.domain';

@Component({ standalone: true, selector: 'app-practice-return-offer', imports: [CommonModule, MatButtonModule],
  template: `<section class="practice-cue" *ngIf="invites.completion() as scope" aria-labelledby="return-offer-title"><span class="kicker">ONE MORE SMALL STEP</span><h2 id="return-offer-title">Keep this practice on my dashboard?</h2><p>{{ scope.subject }} · {{ scope.chapter }}</p><p>A return card will be ready in 24 hours, shown when you open GTOP. It stays on this device for your account.</p><div class="actions"><button mat-flat-button color="primary" (click)="keep()">Keep this practice on my dashboard</button><button mat-stroked-button (click)="invites.dismiss()">Not now</button></div><p>You can turn it off from the card.</p><p role="alert" *ngIf="error()">{{ error() }}</p></section><p class="saved" role="status" *ngIf="saved()">Kept for tomorrow. Shown when you open GTOP on this device.</p>`,
  styleUrl: './practice-return.component.scss'
})
export class PracticeReturnOfferComponent {
  readonly invites = inject(PracticeInviteService); readonly error = signal(''); readonly saved = signal(false);
  keep(): void { if (this.invites.keep()) { this.saved.set(true); this.error.set(''); } else this.error.set('This device could not keep the card. You can continue without it.'); }
}

@Component({ standalone: true, selector: 'app-practice-return-card', imports: [CommonModule, MatButtonModule, RouterLink],
  template: `<section class="practice-cue" *ngIf="cue() as item" aria-labelledby="return-card-title"><span class="kicker">YOUR SAVED PRACTICE</span><h2 id="return-card-title">{{ item.scope.chapter }}{{ due() ? ' is ready to revisit.' : ', saved for tomorrow.' }}</h2><p>{{ item.scope.board }} · Class {{ item.scope.standard }} · {{ item.scope.subject }} · 5 questions</p><p *ngIf="!due()">Ready {{ item.dueAt | date:'medium' }}.</p><p>Shown when you open GTOP. Saved on this device for your account.</p><div class="actions"><button *ngIf="due()" mat-flat-button color="primary" (click)="open()">Revisit five questions</button><button mat-stroked-button (click)="off()">Off</button></div></section>`,
  styleUrl: './practice-return.component.scss'
})
export class PracticeReturnCardComponent implements OnInit {
  readonly cue = signal<PracticeCue | null>(null); readonly due = signal(false);
  private readonly invites = inject(PracticeInviteService); private readonly auth = inject(AuthService); private readonly router = inject(Router); private readonly destroyRef = inject(DestroyRef);
  ngOnInit(): void { this.auth.readyUser$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => { const cue = this.invites.cue(); this.cue.set(cue); this.due.set(!!cue && cue.dueAt <= Date.now()); }); }
  off(): void { this.invites.off(); this.cue.set(null); }
  open(): void { const cue = this.cue(); if (cue && this.due()) { this.invites.returned(cue); this.cue.set(null); void this.router.navigate(['/practice'], { queryParams: practiceParams(cue.scope) }); } }
}
