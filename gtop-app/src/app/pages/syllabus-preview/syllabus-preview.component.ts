import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { SyllabusService, SyllabusItem } from '../../services/syllabus.service';
import { StatusPillComponent } from '../../shared/ui/status-pill/status-pill.component';
import { SubjectCardComponent } from '../../shared/ui/subject-card/subject-card.component';
import { SectionTitleComponent } from '../../shared/ui/section-title/section-title.component';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

interface SyllabusIndexEntry {
    board: string;
    standard: string;
    file: string;
}

interface Chapter {
    chapterNo?: number;
    title: string;
    status?: 'new' | 'existing' | 'removed';
    mcqCount?: number;
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
        StatusPillComponent,
        SubjectCardComponent,
        SectionTitleComponent,
        MatSnackBarModule
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
    private currentFile: string | null = null;

    showNew = true;
    showExisting = true;
    showAbsent = true;

    private normalizeSyllabusFile(raw: any): SyllabusFile {
        const subjects: Subject[] = (raw.subjects || []).map((sub: any) => ({
            subject: sub.subject,
            chapters: (sub.chapters || []).map((ch: any) =>
                typeof ch === 'string' ? { title: ch } : { chapterNo: ch.chapterNo, title: ch.title }
            )
        }));
        return {
            board: raw.board,
            year: raw.year,
            standard: raw.standard,
            subjects
        };
    }

    constructor(
        private http: HttpClient,
        private syllabusService: SyllabusService,
        private snackBar: MatSnackBar
    ) { }

    ngOnInit() {
        this.http.get<SyllabusIndexEntry[]>('assets/syllabus/index.json').subscribe(entries => {
            this.indexEntries = entries;
            this.boards = Array.from(new Set(entries.map(e => e.board))).sort();
        });

        this.syllabusService.syllabus$.subscribe(data => {
            this.syllabusData = data;
            if (this.subjects.length) {
                this.computeChapterStatuses();
            }
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
                this.currentFile = entry.file;
                if (this.syllabusCache[entry.file]) {
                    this.subjects = JSON.parse(JSON.stringify(this.syllabusCache[entry.file].subjects));
                    this.computeChapterStatuses();
                } else {
                    this.http.get<any>(entry.file).subscribe(data => {
                        const normalized = this.normalizeSyllabusFile(data);
                        this.syllabusCache[entry.file] = normalized;
                        this.subjects = JSON.parse(JSON.stringify(normalized.subjects));
                        this.computeChapterStatuses();
                    });
                }
            }
        } else {
            this.currentFile = null;
            this.subjects = [];
        }
    }

    onSubjectChange() {
        this.selectedSubject = this.subjects.find(s => s.subject === this.selectedSubjectName) || null;
    }

    private computeChapterStatuses() {
        if (!this.currentFile) {
            return;
        }

        // Reset chapters to original definition before applying statuses
        this.subjects = JSON.parse(JSON.stringify(this.syllabusCache[this.currentFile].subjects));

        const filtered = this.syllabusData.filter(item =>
            item.board === this.selectedBoard &&
            item.standard === this.selectedStandard);

        this.subjects.forEach(sub => {
            sub.chapters.forEach(ch => {
                const match = filtered.find(f => f.subject === sub.subject && f.chapter === ch.title);
                ch.status = match ? 'existing' : 'new';
                ch.mcqCount = match ? match.mcqCount : 0;
            });

            const existingTitles = new Set(sub.chapters.map(c => c.title));
            filtered
                .filter(f => f.subject === sub.subject && !existingTitles.has(f.chapter))
                .forEach(f => {
                    sub.chapters.push({ title: f.chapter, status: 'removed', mcqCount: f.mcqCount });
                });
        });

        if (this.selectedSubjectName) {
            this.selectedSubject = this.subjects.find(s => s.subject === this.selectedSubjectName) || null;
        }
    }

    private getQuestionCount(subject: string, chapter: string): number {
        const match = this.syllabusData.find(item =>
            item.board === this.selectedBoard &&
            item.standard === this.selectedStandard &&
            item.subject === subject &&
            item.chapter === chapter);
        return match ? match.mcqCount : 0;
    }

    getSubjectQuestionCount(sub: Subject): number {
        return sub.chapters.reduce((sum, ch) => sum + (ch.mcqCount ?? this.getQuestionCount(sub.subject, ch.title)), 0);
    }

    getChangesSummary(subject: Subject | null) {
        if (!subject) { return { new: 0, existing: 0, absent: 0 }; }
        let newCount = 0;
        let existing = 0;
        let absent = 0;
        subject.chapters.forEach(ch => {
            if (ch.status === 'new') {
                newCount++;
            } else if (ch.status === 'removed') {
                absent++;
            } else {
                existing++;
            }
        });
        return { new: newCount, existing, absent };
    }

    get filteredChapters(): Chapter[] {
        if (!this.selectedSubject) { return []; }
        return this.selectedSubject.chapters.filter(ch => {
            if (ch.status === 'new') { return this.showNew; }
            if (ch.status === 'removed') { return this.showAbsent; }
            return this.showExisting;
        });
    }

    toggleFilter(type: 'new' | 'existing' | 'absent') {
        if (type === 'new') { this.showNew = !this.showNew; }
        else if (type === 'existing') { this.showExisting = !this.showExisting; }
        else { this.showAbsent = !this.showAbsent; }
    }

    addChapter(ch: Chapter) {
        if (!this.selectedBoard || !this.selectedStandard || !this.selectedSubjectName) {
            return;
        }
        this.syllabusService
            .insertComboIfNotExists(this.selectedBoard, this.selectedStandard, this.selectedSubjectName, ch.title)
            .then(() => {
                this.snackBar.open('Chapter added!', 'Close', { duration: 2000 });
                this.syllabusData.push({
                    board: this.selectedBoard!,
                    standard: this.selectedStandard!,
                    subject: this.selectedSubjectName!,
                    chapter: ch.title,
                    mcqCount: 0
                });
                this.computeChapterStatuses();
            })
            .catch(err => {
                console.error('Failed to add chapter', err);
                this.snackBar.open('Failed to add chapter', 'Close', { duration: 3000 });
            });
    }
}
