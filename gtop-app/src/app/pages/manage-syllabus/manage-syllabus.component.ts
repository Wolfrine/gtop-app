import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { Router } from '@angular/router';
import { SyllabusService, SyllabusItem } from '../../services/syllabus.service'; // Import service

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
    syllabusData: { name: string; standards: any[] }[] = []; // Initialize empty

    constructor(private router: Router, private syllabusService: SyllabusService) {
        // Subscribe to syllabus observable
        this.syllabusService.syllabus$.subscribe((syllabusItems) => {
            this.organizeSyllabusData(syllabusItems);
        });
    }

    /**
     * Organize syllabus data in nested format: Board > Standard > Subject > Chapters
     */
    private organizeSyllabusData(syllabusItems: SyllabusItem[]) {
        const organized: { name: string; standards: any[] }[] = [];

        syllabusItems.forEach((item) => {
            let board = organized.find(b => b.name === item.board);
            if (!board) {
                board = { name: item.board, standards: [] };
                organized.push(board);
            }

            let standard = board.standards.find(s => s.name === item.standard);
            if (!standard) {
                standard = { name: item.standard, subjects: [] };
                board.standards.push(standard);
            }

            let subject = standard.subjects.find((sub: { name: string; }) => sub.name === item.subject);
            if (!subject) {
                subject = { name: item.subject, chapters: [] };
                standard.subjects.push(subject);
            }

            // Add chapter (assuming we need to include mcqCount later)
            subject.chapters.push({ name: item.chapter, mcqCount: item.mcqCount }); // Default mcqCount to 0
        });

        this.syllabusData = organized;
    }

    viewMCQs(board: string, standard: string, subject: string, chapter: string) {
        this.router.navigate(['/admin/mcq-management'], {
            queryParams: {
                board,
                standard,
                subject,
                chapter,
            },
        });
    }

    refreshSyllabusCounts() {
        this.syllabusService.updateSyllabusCountsFromIndexedDB(this.syllabusData)
            .then(() => {
                console.log("Syllabus counts refreshed successfully!");
            })
            .catch(error => {
                console.error("Error refreshing syllabus counts:", error);
            });
    }

}
