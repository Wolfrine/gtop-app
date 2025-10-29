import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { QuizPageComponent } from '../pages/quiz-page/quiz-page.component';
import { QuizSummaryComponent } from '../pages/quiz-summary/quiz-summary.component';
import { QuizService } from '../services/quiz.service';
import { SampleQuizService } from '../services/sample-quiz.service';

const routes: Routes = [
  {
    path: '',
    component: QuizPageComponent,
    data: {
      sampleQuiz: true,
      summaryRoute: '/sample-quiz/summary',
      seo: {
        title: 'GTOP Sample Quiz',
        description:
          'Attempt a curated five-question GTOP sample quiz without signing in and preview the practice experience.',
        robots: 'index, follow',
      },
    },
  },
  {
    path: 'summary',
    component: QuizSummaryComponent,
    data: {
      sampleQuiz: true,
      retryRoute: '/sample-quiz',
      returnRoute: '/',
      returnLabel: 'Back to Landing',
      seo: {
        title: 'GTOP Sample Quiz Summary',
        description:
          'Review explanations and accuracy from the GTOP sample quiz and jump back to start another attempt.',
        robots: 'index, follow',
      },
    },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  providers: [
    SampleQuizService,
    { provide: QuizService, useExisting: SampleQuizService },
  ],
})
export class SampleQuizModule {}
