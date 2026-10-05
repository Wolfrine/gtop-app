import { Component, Input, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';
import { PracticeScope, practiceParams } from '../../services/practice-invite.domain';
import { sameScope } from '../../services/practice-invite.domain';
import { AuthService } from '../../services/auth.service';
import { PracticeInviteService } from '../../services/practice-invite.service';

@Component({ standalone: true, selector: 'app-practice-share', imports: [CommonModule, MatButtonModule],
  template: `<section class="share" aria-labelledby="share-heading"><h3 id="share-heading">Invite learners to practise</h3><p>Choose one subject, one chapter and five questions. A reviewed set is required. Each learner answers on their own.</p>
    <button type="button" mat-stroked-button color="primary" (click)="copy()" [disabled]="!available || busy()">{{ busy() ? 'Checking questions…' : 'Copy practice link' }}</button>
    <p *ngIf="!available">{{ scope ? 'This practice is still being checked before sharing.' : 'Select one subject, one chapter and five questions to share a practice.' }}</p>
    <p role="status" aria-live="polite">{{ status() }}</p><label *ngIf="link()">Practice link<input readonly [value]="link()" (focus)="$any($event.target).select()"></label></section>`,
  styles: [`:host{display:block;grid-column:1/-1}.share{border-top:1px solid #ccd6e4;padding-top:16px;margin-top:16px;color:#263c5c}.share h3{font-size:1rem;margin:0 0 8px}.share p{font-size:.88rem;line-height:1.5}.share button{white-space:normal;height:auto;min-height:44px;padding:10px 14px}.share input{box-sizing:border-box;width:100%;padding:10px;margin-top:6px;border:1px solid #7386a1;border-radius:6px;font:inherit}.share label{font-size:.85rem}`]
})
export class PracticeShareComponent {
  @Input() scope: PracticeScope | null = null;
  readonly busy = signal(false); readonly status = signal(''); readonly link = signal('');
  private readonly invites = inject(PracticeInviteService); private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  get available() { return !!this.scope && !!this.invites.seed(this.scope); }
  async copy(): Promise<void> {
    const scope = this.scope; if (!scope || !this.available || this.busy() || !this.auth.isAdmin()) return;
    this.busy.set(true); this.status.set(''); this.link.set('');
    try {
      await this.invites.questions(scope);
      if (!this.scope || !sameScope(scope, this.scope) || !this.auth.isAdmin()) { this.status.set('Selection changed. Copy the practice link again.'); return; }
      const value = window.location.origin + this.router.serializeUrl(this.router.createUrlTree(['/practice'], { queryParams: practiceParams(scope) }));
      try { await navigator.clipboard.writeText(value); this.status.set('Practice link copied. Share it when you choose.'); }
      catch { this.link.set(value); this.status.set('Select the link below to copy it.'); }
    } catch { this.status.set('The five reviewed questions could not be checked. Try again when you are online, or choose a reviewed practice.'); }
    finally { this.busy.set(false); }
  }
}
