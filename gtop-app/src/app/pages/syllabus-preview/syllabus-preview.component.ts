import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { MatListModule } from '@angular/material/list';
import { MatCardModule } from '@angular/material/card';

interface Chapter {
    chapterNo?: number;
    title: string;
}

interface Subject {
    subject: string;
    chapters: Chapter[];
}

interface SyllabusFile {
    board: string;
    year?: string;
    standard: string;
    subjects: Subject[];
}

@Component({
    selector: 'app-syllabus-preview',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatToolbarModule,
        MatFormFieldModule,
        MatSelectModule,
        MatOptionModule,
        MatListModule,
        MatCardModule
    ],
    templateUrl: './syllabus-preview.component.html',
    styleUrls: ['./syllabus-preview.component.scss']
})
export class SyllabusPreviewComponent implements OnInit {
    boards: string[] = [];
    standards: string[] = [];
    subjects: Subject[] = [];
    selectedBoard: string | null = null;
    selectedStandard: string | null = null;
    selectedSubjectName: string | null = null;
    selectedSubject: Subject | null = null;

    private syllabusMap: Record<string, SyllabusFile> = {};

    ngOnInit() {
        const modules = import.meta.glob('../../../assets/syllabus/*.json', {
            eager: true,
            import: 'default'
        }) as Record<string, SyllabusFile>;

        for (const path in modules) {
            const data = modules[path];
            const key = `${data.board.toLowerCase()}-${data.standard}`;
            this.syllabusMap[key] = data;
            if (!this.boards.includes(data.board)) {
                this.boards.push(data.board);
            }
        }
        this.boards.sort();
    }

    onBoardChange() {
        this.standards = [];
        this.selectedStandard = null;
        this.selectedSubjectName = null;
        this.selectedSubject = null;
        this.subjects = [];

        if (!this.selectedBoard) {
            return;
        }

        for (const key in this.syllabusMap) {
            const item = this.syllabusMap[key];
            if (item.board === this.selectedBoard && !this.standards.includes(item.standard)) {
                this.standards.push(item.standard);
            }
        }
        this.standards.sort();
    }

    onStandardChange() {
        this.selectedSubjectName = null;
        this.selectedSubject = null;
        if (this.selectedBoard && this.selectedStandard) {
            const key = `${this.selectedBoard.toLowerCase()}-${this.selectedStandard}`;
            const data = this.syllabusMap[key];
            this.subjects = data ? data.subjects : [];
        } else {
            this.subjects = [];
        }
    }

    onSubjectChange() {
        this.selectedSubject = this.subjects.find(s => s.subject === this.selectedSubjectName) || null;
    }
}
