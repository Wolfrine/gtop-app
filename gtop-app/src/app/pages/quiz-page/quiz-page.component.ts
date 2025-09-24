import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router, ActivatedRoute } from '@angular/router';
import { QuizService, RetryContext } from '../../services/quiz.service';

@Component({
    selector: 'app-quiz-page',
    standalone: true,
    imports: [
        CommonModule,
        MatCardModule,
        MatButtonModule,
        MatProgressBarModule
    ],
    templateUrl: './quiz-page.component.html',
    styleUrls: ['./quiz-page.component.scss']
})
export class QuizPageComponent implements OnInit {

    optionsLabel = ['A', 'B', 'C', 'D'];

    // Dummy Firestore-style data
    questions = [
        {
            board: 'ICSE',
            standard: '6',
            subject: 'Mathematics',
            chapter: '8 Decimals',
            title: 'Untitled',
            question: 'What is the difference between 4.5 and 1.2?',
            options: ['3.3', '3.5', '3.0', '4.7'],
            correctIndex: 0,
            solutions: ['Correct answer is 3.3', '', '', ''],
            selectedIndex: null as number | null
        },
        {
            board: 'CBSE',
            standard: '7',
            subject: 'Science',
            chapter: 'Electricity',
            title: 'Untitled',
            question: 'What is the SI unit of electric current?',
            options: ['Ohm', 'Ampere', 'Volt', 'Watt'],
            correctIndex: 1,
            solutions: ['', '', '', ''],
            selectedIndex: null as number | null
        },
        {
            board: 'ICSE',
            standard: '8',
            subject: 'Mathematics',
            chapter: 'Algebra',
            title: 'Untitled',
            question: 'Simplify: 3(2x - 4) = ?',
            options: ['6x - 4', '6x - 12', '5x - 4', '6x + 4'],
            correctIndex: 1,
            solutions: ['', '', '', ''],
            selectedIndex: null as number | null
        }
    ];

    currentQuestionIndex = 0;
    private retryContext: RetryContext | null = null;

    constructor(
        private quizService: QuizService,
        private router: Router,
        private route: ActivatedRoute
    ) { }

    ngOnInit(): void {
        const pendingRetry = this.quizService.consumePendingRetry();
        if (pendingRetry) {
            this.questions = pendingRetry.questions.map(question => ({ ...question }));
            this.retryContext = pendingRetry.context;
            this.currentQuestionIndex = 0;
            return;
        }

        this.route.queryParams.subscribe(params => {
            if (this.retryContext) {
                return;
            }
            const board = params['board'] || null;
            const standard = params['standard'] || null;
            const subjects: string[] = params['subjects'] || [];
            const chapters: string[] = params['chapters'] || [];
            const count = params['count'] ? +params['count'] : 10;

            if (board && standard && (subjects.length > 0 || chapters.length > 0)) {
                // Custom quiz
                this.quizService.fetchCustomQuizQuestions(board, standard, subjects, chapters, count)
                    .then(fetchedQuestions => {
                        this.questions = fetchedQuestions;
                    })
                    .catch(error => {
                        console.error('Error fetching custom quiz:', error);
                    });
            } else {
                // Quick quiz
                this.quizService.fetchQuestionsFromRandomChapter()
                    .then(fetchedQuestions => {
                        this.questions = fetchedQuestions;
                    })
                    .catch(error => {
                        console.error('Error fetching quiz questions:', error);
                    });
            }
        });
    }




    selectOption(optionIndex: number) {
        this.questions[this.currentQuestionIndex].selectedIndex = optionIndex;
    }

    nextQuestion() {
        if (this.currentQuestionIndex < this.questions.length - 1) {
            this.currentQuestionIndex++;
        } else {
            // Save to service
            this.quizService.setQuestions(this.questions);
            this.router.navigate(['/quiz-summary']);
        }
    }


    getProgressPercent() {
        return ((this.currentQuestionIndex + 1) / this.questions.length) * 100;
    }
}
