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
import { MatChipsModule } from '@angular/material/chips';
import { SyllabusService, SyllabusItem } from '../../services/syllabus.service';

interface SyllabusIndexEntry {
    board: string;
    standard: string;
    file: string;
}

interface Chapter {
    chapterNo?: number;
    title: string;
    status?: 'new' | 'existing' | 'removed';
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
        MatCardModule,
        MatChipsModule
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
    private syllabusData: SyllabusItem[] = [];

    constructor(private http: HttpClient, private syllabusService: SyllabusService) { }

    ngOnInit() {
        this.http.get<SyllabusIndexEntry[]>('assets/syllabus/index.json').subscribe(entries => {
            this.indexEntries = entries;
            this.boards = Array.from(new Set(entries.map(e => e.board))).sort();
        });

        this.syllabusService.syllabus$.subscribe(data => {
            this.syllabusData = data;
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
                    this.computeChapterStatuses();
                } else {
                    this.http.get<SyllabusFile>(entry.file).subscribe(data => {
                        this.syllabusCache[entry.file] = data;
                        this.subjects = data.subjects;
                        this.computeChapterStatuses();
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

    private computeChapterStatuses() {
        const filtered = this.syllabusData.filter(item =>
            item.board === this.selectedBoard &&
            item.standard === this.selectedStandard);

        this.subjects.forEach(sub => {
            sub.chapters.forEach(ch => {
                const match = filtered.find(f => f.subject === sub.subject && f.chapter === ch.title);
                ch.status = match ? 'existing' : 'new';
            });
        });
    }

    getChangesSummary(subject: Subject | null) {
        if (!subject) { return { new: 0, existing: 0 }; }
        let newCount = 0;
        let existing = 0;
        subject.chapters.forEach(ch => {
            if (ch.status === 'new') newCount++;
            else existing++;
        });
        return { new: newCount, existing };
    }
}
