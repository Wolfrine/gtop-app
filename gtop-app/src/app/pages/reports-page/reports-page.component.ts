import { Component, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { NgChartsModule } from 'ng2-charts';
import { CommonModule } from '@angular/common';
import { ChartConfiguration } from 'chart.js';
import { Auth } from '@angular/fire/auth';
import { QuizService } from '../../services/quiz.service';
import { ActivatedRoute } from '@angular/router';

@Component({
    selector: 'app-reports-page',
    standalone: true,
    templateUrl: './reports-page.component.html',
    styleUrls: ['./reports-page.component.scss'],
    imports: [
        CommonModule,
        MatCardModule,
        MatListModule,
        MatButtonModule,
        NgChartsModule,
    ],
})
export class ReportsPageComponent implements OnInit {
    constructor(
        private quizService: QuizService,
        private auth: Auth,
        private route: ActivatedRoute
    ) { }

    quizResults: any[] = [];

    summary = [
        { label: 'Total Quizzes', value: 0 },
        { label: 'Accuracy', value: '0%' },
        { label: 'Last Score', value: '0/0' }
    ];

    accuracyChartData: ChartConfiguration<'line'>['data'] = {
        labels: [],
        datasets: [
            {
                data: [],
                label: 'Accuracy %',
                borderColor: 'blue',
                fill: false,
            },
        ]
    };

    quizTypeChartData: ChartConfiguration<'pie'>['data'] = {
        labels: ['Quick', 'Custom', 'Live'],
        datasets: [{
            data: [0, 0, 0],
            backgroundColor: ['#42A5F5', '#66BB6A', '#FFA726'],
        }]
    };

    chartOptions: ChartConfiguration['options'] = {
        responsive: true,
        maintainAspectRatio: false
    };

    mockSessions: any[] = [];

    ngOnInit() {
        this.route.queryParams.subscribe(params => {
            const userIdFromRoute = params['userId'];
            if (userIdFromRoute) {
                this.fetchAndProcessUserReports(userIdFromRoute);
            } else {
                const user = this.auth.currentUser;
                if (user) {
                    this.fetchAndProcessUserReports(user.uid);
                }
            }
        });
    }

    fetchAndProcessUserReports(userId: string) {
        this.quizService.fetchUserQuizResults(userId).then(results => {
            this.quizResults = results;
            this.processReportData(results);
        });
    }

    processReportData(results: any[]) {
        if (results.length === 0) return;

        // ✅ Sort first by timestamp ascending for chart
        const sortedByDate = results.slice().sort((a, b) => {
            const aTime = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : new Date(a.timestamp).getTime();
            const bTime = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : new Date(b.timestamp).getTime();
            return aTime - bTime;
        });

        // ✅ Use sorted list for chart + stats
        const totalQuizzes = sortedByDate.length;
        const totalCorrect = sortedByDate.reduce((sum, r) => sum + r.correctAnswers, 0);
        const totalQuestions = sortedByDate.reduce((sum, r) => sum + r.totalQuestions, 0);
        const avgAccuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

        const lastResult = sortedByDate[sortedByDate.length - 1];
        const lastScore = `${lastResult.correctAnswers}/${lastResult.totalQuestions}`;

        this.summary = [
            { label: 'Total Quizzes', value: totalQuizzes },
            { label: 'Accuracy', value: `${avgAccuracy}%` },
            { label: 'Last Score', value: lastScore }
        ];

        // ✅ Accuracy Over Time
        const groupedByDate = new Map<string, { correct: number, total: number }>();
        sortedByDate.forEach(r => {
            const date = r.timestamp?.toDate ? r.timestamp.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : new Date(r.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const group = groupedByDate.get(date) || { correct: 0, total: 0 };
            group.correct += r.correctAnswers;
            group.total += r.totalQuestions;
            groupedByDate.set(date, group);
        });

        const accuracyLabels = Array.from(groupedByDate.keys());
        const accuracyData = accuracyLabels.map(date => {
            const g = groupedByDate.get(date)!;
            return Math.round((g.correct / g.total) * 100);
        });

        this.accuracyChartData = {
            labels: accuracyLabels,
            datasets: [
                {
                    data: accuracyData,
                    label: 'Accuracy %',
                    borderColor: 'blue',
                    fill: false
                }
            ]
        };

        // ✅ Quiz Type Distribution
        const quizTypeCounts: Record<string, number> = { quick: 0, custom: 0, live: 0 };
        sortedByDate.forEach(r => {
            const type = r.quizType;
            if (quizTypeCounts[type] !== undefined) {
                quizTypeCounts[type]++;
            }
        });

        this.quizTypeChartData = {
            labels: ['Quick', 'Custom', 'Live'],
            datasets: [{
                data: [
                    quizTypeCounts['quick'],
                    quizTypeCounts['custom'],
                    quizTypeCounts['live']
                ],
                backgroundColor: ['#42A5F5', '#66BB6A', '#FFA726'],
            }]
        };

        // ✅ Session History = DESCENDING
        this.mockSessions = sortedByDate.slice().reverse().map(r => {
            const dateObj = r.timestamp?.toDate ? r.timestamp.toDate() : new Date(r.timestamp);
            const date = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const time = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

            return {
                board: r.board,
                standard: r.standard,
                subject: r.subject,
                chapter: r.chapter,
                quizType: r.quizType,
                date,
                time,
                total: r.totalQuestions,
                correct: r.correctAnswers,
                duration: r.duration || '—'
            };
        });
    }

}
