import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FirestoreReadService } from '../../../services/firestore-read.service';

@Component({
  selector: 'app-question-module-header', standalone: true, imports: [RouterLink],
  template: `
    <header class="qm-header">
      <div><p class="eyebrow">Admin / Questions & papers</p><h1>{{ title }}</h1><p class="qm-description">{{ description }}</p></div>
      @if (create) { <a class="btn btn-primary" routerLink="/admin/question-papers" queryParamsHandling="preserve">New paper chat <span aria-hidden="true">+</span></a> }
    </header>
    <nav class="qm-nav qm-paper-nav" aria-label="Question module">
      @for (tab of tabs; track tab.id) {
        <a [routerLink]="tab.url" [class.active]="isActive(tab.id)" [attr.aria-current]="isActive(tab.id) ? 'page' : null" queryParamsHandling="preserve">{{ tab.title }}</a>
      }
    </nav>
    @if(active === 'bank' || active === 'review' || active === 'requests') {
      <nav class="qm-bank-tools" aria-label="Bank tools"><a routerLink="/admin/question-library" queryParamsHandling="preserve">Question library</a><a routerLink="/admin/question-bank" queryParamsHandling="preserve">Coverage requests</a><a routerLink="/admin/question-review" queryParamsHandling="preserve">Legacy review</a><a routerLink="/admin/question-paper-generator" queryParamsHandling="preserve">Manual builder</a><a routerLink="/admin/question-papers/legacy" queryParamsHandling="preserve">Earlier paper requests</a></nav>
    }
    @if(reads.checking()) { <p class="qm-muted" role="status">Checking for updates. Saved results may be incomplete.</p> }
  `,
  styles: [`.qm-paper-nav{grid-template-columns:repeat(3,minmax(0,1fr))}.qm-bank-tools{display:flex;gap:10px 22px;flex-wrap:wrap;margin:-10px 0 22px;font-size:.78rem}.qm-bank-tools>a{min-height:32px;display:flex;align-items:center;color:#3155a5}@media(max-width:640px){.qm-bank-tools{gap:8px 18px;font-size:.72rem}.qm-header h1{font-size:1.5rem}}`],
})
export class QuestionModuleHeaderComponent {
  constructor(readonly reads: FirestoreReadService) {}
  @Input() title = 'Questions & papers';
  @Input() description = '';
  @Input() active: 'papers' | 'all' | 'bank' | 'review' | 'requests' = 'papers';
  @Input() create = true;
  readonly tabs = [
    {id:'papers', title:'Paper chat', url:'/admin/question-papers'},
    {id:'all', title:'All papers', url:'/admin/question-papers/all'},
    {id:'bank', title:'Bank tools', url:'/admin/question-library'},
  ];
  isActive(id: string): boolean { return id === this.active || id === 'bank' && (this.active === 'review' || this.active === 'requests'); }
}
