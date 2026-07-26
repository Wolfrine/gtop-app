import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from './auth.store';
import { QuizLaunchContext, ShellContext } from './models';

@Injectable({ providedIn: 'root' })
export class AppNavigationService {
  constructor(
    private readonly router: Router,
    private readonly auth: AuthStore,
  ) {}

  context(url = this.router.url): ShellContext {
    if (url.startsWith('/admin/learning')) return 'admin';
    return this.auth.isAdmin() ? 'admin' : 'learner';
  }

  path(segment: string, context = this.context()): string {
    const clean = segment.replace(/^\/+/, '');
    return context === 'admin' ? `/admin/learning/${clean}` : `/${clean}`;
  }

  launch(
    kind: QuizLaunchContext['kind'],
    additions: Omit<QuizLaunchContext, 'kind' | 'shellContext' | 'returnPath'> = {},
  ): QuizLaunchContext {
    const shellContext = this.context();
    return {
      kind,
      shellContext,
      returnPath: this.path('practice', shellContext),
      ...additions,
    };
  }

  routeForSession(segment: string, launch?: QuizLaunchContext): string {
    return this.path(segment, launch?.shellContext ?? this.context());
  }
}
