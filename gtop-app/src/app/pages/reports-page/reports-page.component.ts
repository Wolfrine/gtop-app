import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { NgChartsModule } from 'ng2-charts';
import { CommonModule } from '@angular/common';
import { ChartConfiguration } from 'chart.js';

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
export class ReportsPageComponent {
    accuracyChartData: ChartConfiguration<'line'>['data'] = {
        labels: ['Mar 1', 'Mar 3', 'Mar 5', 'Mar 7'],
        datasets: [
            {
                data: [60, 75, 80, 78],
                label: 'Accuracy %',
                borderColor: 'blue',
                fill: false,
            },
        ]
    };

    summary = [
        { label: 'Total Quizzes', value: 12 },
        { label: 'Accuracy', value: '78%' },
        { label: 'Last Score', value: '8/10' }
    ];


    quizTypeChartData: ChartConfiguration<'pie'>['data'] = {
        labels: ['Quick', 'Custom', 'Live'],
        datasets: [{
            data: [6, 4, 2],
            backgroundColor: ['#42A5F5', '#66BB6A', '#FFA726'],
        }]
    };

    chartOptions: ChartConfiguration['options'] = {
        responsive: true,
        maintainAspectRatio: false
    };

    mockSessions = [
        {
            board: 'CBSE',
            standard: '10',
            subject: 'Math',
            chapter: 'Trigonometry',
            quizType: 'Quick',
            date: 'Apr 4',
            time: '7:04 PM',
            total: 10,
            correct: 7,
            duration: '4m 12s'
        },
        {
            board: 'CBSE',
            standard: '10',
            subject: 'Science',
            chapter: 'Light',
            quizType: 'Custom',
            date: 'Apr 3',
            time: '6:33 PM',
            total: 12,
            correct: 9,
            duration: '5m 45s'
        }
    ];

}
