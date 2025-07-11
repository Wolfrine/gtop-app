import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { MatListModule } from '@angular/material/list';
import { MatCardModule } from '@angular/material/card';

interface SyllabusIndexEntry {
    board: string;
    standard: string;
    file: string;
}

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
        HttpClientModule,
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

    private indexEntries: SyllabusIndexEntry[] = [];
    private syllabusCache: Record<string, SyllabusFile> = {};

    constructor(private http: HttpClient) { }

    ngOnInit() {
        this.http.get<SyllabusIndexEntry[]>('assets/syllabus/index.json').subscribe(entries => {
            this.indexEntries = entries;
            this.boards = Array.from(new Set(entries.map(e => e.board))).sort();
        });
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

        const related = this.indexEntries.filter(e => e.board === this.selectedBoard);
        this.standards = Array.from(new Set(related.map(r => r.standard))).sort();
    }

    onStandardChange() {
        this.selectedSubjectName = null;
        this.selectedSubject = null;
        if (this.selectedBoard && this.selectedStandard) {
            const entry = this.indexEntries.find(e => e.board === this.selectedBoard && e.standard === this.selectedStandard);
            if (entry) {
                if (this.syllabusCache[entry.file]) {
                    this.subjects = this.syllabusCache[entry.file].subjects;
                } else {
                    this.http.get<SyllabusFile>(entry.file).subscribe(data => {
                        this.syllabusCache[entry.file] = data;
                        this.subjects = data.subjects;
                    });
                }
            }
        } else {
            this.subjects = [];
        }
    }

    onSubjectChange() {
        this.selectedSubject = this.subjects.find(s => s.subject === this.selectedSubjectName) || null;
    }
}
