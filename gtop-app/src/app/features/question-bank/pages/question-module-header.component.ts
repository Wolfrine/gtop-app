import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-question-module-header', standalone: true, imports: [RouterLink],
  template: `
    <header class="qm-header">
      <div><p class="eyebrow">Admin / Questions & papers</p><h1>{{ title }}</h1><p class="qm-description">{{ description }}</p></div>
      @if (create) { <a class="btn btn-primary" routerLink="/admin/question-paper-generator">Create paper <span aria-hidden="true">＋</span></a> }
    </header>
    <nav class="qm-nav" aria-label="Question module">
      @for (tab of tabs; track tab.id) {
        <a [routerLink]="tab.url" [class.active]="active === tab.id" [attr.aria-current]="active === tab.id ? 'page' : null">{{ tab.title }}</a>
      }
    </nav>
  `,
})
export class QuestionModuleHeaderComponent {
  @Input() title = 'Questions & papers';
  @Input() description = '';
  @Input() active: 'papers' | 'bank' | 'review' | 'requests' = 'papers';
  @Input() create = true;
  readonly tabs = [
    {id:'papers', title:'Papers', url:'/admin/question-papers'},
    {id:'bank', title:'Bank', url:'/admin/question-library'},
    {id:'review', title:'Review', url:'/admin/question-review'},
    {id:'requests', title:'Requests', url:'/admin/question-bank'},
  ];
}
