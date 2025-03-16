import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { Router } from '@angular/router';

@Component({
    selector: 'app-manage-syllabus',
    templateUrl: './manage-syllabus.component.html',
    styleUrls: ['./manage-syllabus.component.scss'],
    standalone: true,
    imports: [
        CommonModule,
        MatToolbarModule,
        MatExpansionModule,
        MatIconModule,
        MatButtonModule,
        MatCheckboxModule,
        MatChipsModule,
    ],
})
export class ManageSyllabusComponent {
    syllabusData = [
        {
            name: 'CBSE',
            standards: [
                {
                    name: '6th',
                    subjects: [
                        {
                            name: 'Science',
                            chapters: [
                                { name: 'Motion', mcqCount: 24 },
                                { name: 'Electricity', mcqCount: 18 },
                                { name: 'Light and Shadows', mcqCount: 12 },
                                { name: 'Food and Health', mcqCount: 5 },
                                { name: 'Living Organisms', mcqCount: 30 },
                            ],
                        },
                        {
                            name: 'Mathematics',
                            chapters: [
                                { name: 'Number System', mcqCount: 20 },
                                { name: 'Fractions and Decimals', mcqCount: 15 },
                                { name: 'Algebra Basics', mcqCount: 22 },
                                { name: 'Geometry', mcqCount: 10 },
                            ],
                        },
                    ],
                },
                {
                    name: '7th',
                    subjects: [
                        {
                            name: 'Science',
                            chapters: [
                                { name: 'Heat', mcqCount: 19 },
                                { name: 'Acids, Bases, Salts', mcqCount: 14 },
                                { name: 'Weather and Climate', mcqCount: 11 },
                            ],
                        },
                        {
                            name: 'Mathematics',
                            chapters: [
                                { name: 'Integers', mcqCount: 16 },
                                { name: 'Linear Equations', mcqCount: 8 },
                                { name: 'Data Handling', mcqCount: 20 },
                            ],
                        },
                    ],
                },
            ],
        },
        {
            name: 'ICSE',
            standards: [
                {
                    name: '6th',
                    subjects: [
                        {
                            name: 'Science',
                            chapters: [
                                { name: 'Plants & Animals', mcqCount: 9 },
                                { name: 'Environment', mcqCount: 15 },
                                { name: 'Our Universe', mcqCount: 4 },
                            ],
                        },
                        {
                            name: 'Mathematics',
                            chapters: [
                                { name: 'Whole Numbers', mcqCount: 18 },
                                { name: 'Ratio & Proportion', mcqCount: 14 },
                            ],
                        },
                    ],
                },
            ],
        },
    ];


    constructor(private router: Router) { }


    viewMCQs(board: string, standard: string, subject: string, chapter: string) {
        // Navigate to Manage MCQs Page with query params
        this.router.navigate(['/admin/mcq-management'], {
            queryParams: {
                board,
                standard,
                subject,
                chapter,
            },
        });
    }
}
