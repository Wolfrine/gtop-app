import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { Router, ActivatedRoute } from '@angular/router';
import { McqService, MCQ } from '../../services/mcq.service';
import { SyllabusService, SyllabusItem } from '../../services/syllabus.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
    selector: 'app-mcq-management',
    standalone: true,
    templateUrl: './mcq-management.component.html',
    styleUrls: ['./mcq-management.component.scss'],
    imports: [
        CommonModule,
        FormsModule,
        MatExpansionModule,
        MatCheckboxModule,
        MatButtonModule,
        MatIconModule,
        MatToolbarModule,
        MatFormFieldModule, // ✅ Added
        MatSelectModule, // ✅ Added
        MatOptionModule, // ✅ Optional
        MatSnackBarModule
    ]
})
export class McqManagementComponent implements OnInit {
    mcqs: (MCQ & { editMode?: boolean; updatedJson?: string; displayJson?: string })[] = [];
    optionLabels = ['A)', 'B)', 'C)', 'D)'];
    loading = true;
    lastVisible: any = null;

    // Filter-related
    boardList: string[] = ['CBSE', 'ICSE'];
    standardList: string[] = ['6th', '7th', '8th'];
    subjectList: string[] = ['Science', 'Mathematics'];
    chapterList: string[] = [];

    selectedBoard = '';
    selectedStandard = '';
    selectedSubject = '';
    selectedChapter = '';

    filters = {
        board: '',
        standard: '',
        subject: '',
        chapter: ''
    };

    constructor(
        private router: Router,
        private route: ActivatedRoute,
        private mcqService: McqService,
        private syllabusService: SyllabusService,
        private snackBar: MatSnackBar
    ) { }

    syllabusData: SyllabusItem[] = [];

    ngOnInit() {
        // Fetch syllabus data
        this.syllabusService.syllabus$.subscribe((syllabusItems) => {
            this.syllabusData = syllabusItems;

            // Ensure dropdowns populated AFTER params applied
            this.populateDropdowns(syllabusItems);
        });


        // Query params
        this.route.queryParams.subscribe(async (params) => {
            if (params['board']) this.selectedBoard = params['board'];
            if (params['standard']) this.selectedStandard = params['standard'];
            if (params['subject']) this.selectedSubject = params['subject'];
            if (params['chapter']) this.selectedChapter = params['chapter'];

            // Reapply filters
            this.filters = {
                board: this.selectedBoard,
                standard: this.selectedStandard,
                subject: this.selectedSubject,
                chapter: this.selectedChapter
            };

            // Populate dropdowns AFTER syllabus data arrives
            if (this.syllabusData.length > 0) {
                this.populateDropdowns(this.syllabusData);
            }

            await this.fetchMCQs();
        });

    }

    populateDropdowns(syllabusItems: SyllabusItem[]) {
        // Populate Board List
        this.boardList = [...new Set(syllabusItems.map(item => item.board))];

        // Populate Standard List based on Board selection
        if (this.selectedBoard) {
            this.standardList = [...new Set(
                syllabusItems.filter(item => item.board === this.selectedBoard)
                    .map(item => item.standard)
            )];
        } else {
            this.standardList = [];
        }

        // Populate Subject List based on Standard selection
        if (this.selectedStandard) {
            this.subjectList = [...new Set(
                syllabusItems.filter(item => item.board === this.selectedBoard &&
                    item.standard === this.selectedStandard)
                    .map(item => item.subject)
            )];
        } else {
            this.subjectList = [];
        }

        // Populate Chapter List based on Subject selection
        if (this.selectedSubject) {
            this.chapterList = [...new Set(
                syllabusItems.filter(item => item.board === this.selectedBoard &&
                    item.standard === this.selectedStandard &&
                    item.subject === this.selectedSubject)
                    .map(item => item.chapter)
            )];
        } else {
            this.chapterList = [];
        }
    }



    async fetchMCQs(loadMore = false) {
        this.loading = true;
        try {
            const response = await this.mcqService.fetchMCQs(this.filters, loadMore ? this.lastVisible : null);

            const extendedMcqs = response.mcqs.map(mcq => ({
                ...mcq,
                // UI-only props
                editMode: false,
                updatedJson: ''
            }));

            if (loadMore) {
                this.mcqs = [...this.mcqs, ...extendedMcqs];
            } else {
                this.mcqs = extendedMcqs;
            }

            this.lastVisible = response.lastVisible;
        } catch (error) {
            console.error('Error fetching MCQs:', error);
        } finally {
            this.loading = false;
        }
    }


    toggleExpand(event: Event, mcq: MCQ) {
        const target = event.target as HTMLElement;
        if (target.closest('.mcq-actions')) return;
        mcq.selected = !mcq.selected;
    }

    editMcq(mcq: any, event: Event) {
        event.stopPropagation(); // ✅ Prevents expansion collapse
        mcq.editMode = !mcq.editMode;
        mcq.updatedJson = '';
    }

    getJson(mcq: any): string {
        return JSON.stringify({
            question: mcq.question,
            options: mcq.options,
            correctIndex: mcq.correctIndex,
            solutions: mcq.solutions,
            board: mcq.board,
            standard: mcq.standard,
            subject: mcq.subject,
            chapter: mcq.chapter
        }, null, 2);
    }

    copyJson(mcq: any) {
        const jsonText = this.getJson(mcq);

        // ✅ Create a temporary textarea to copy text
        const textarea = document.createElement('textarea');
        textarea.value = jsonText;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);

        this.snackBar.open('Copied JSON to clipboard!', 'Close', { duration: 2500 });
    }


    async deleteMcq(mcq: any, event: Event) {
        event.stopPropagation(); // ✅ Prevents panel toggle
        if (confirm('Are you sure you want to delete this MCQ?')) {
            this.mcqService.deleteMCQ(mcq.id).then(() => {
                this.snackBar.open('MCQ deleted.', 'Close', { duration: 3000 });
            });
        }
    }

    navigateToAddMCQ() {
        this.router.navigate(['/admin/add-mcq']);
    }

    loadMore() {
        if (this.lastVisible) this.fetchMCQs(true);
    }

    refreshSyllabus() {
        this.mcqService.updateSyllabusFromQuestions().then(() => {
            console.log("Syllabus refreshed successfully!");
        }).catch(error => {
            console.error("Error refreshing syllabus:", error);
        });
    }

    filterMCQs() {
        this.filters = {
            board: this.selectedBoard,
            standard: this.selectedStandard,
            subject: this.selectedSubject,
            chapter: this.selectedChapter
        };

        // Repopulate dependent dropdowns
        this.populateDropdowns(this.syllabusData);

        // Reset lower levels if parent is cleared
        if (!this.selectedBoard) {
            this.selectedStandard = '';
            this.selectedSubject = '';
            this.selectedChapter = '';
        }
        if (!this.selectedStandard) {
            this.selectedSubject = '';
            this.selectedChapter = '';
        }
        if (!this.selectedSubject) {
            this.selectedChapter = '';
        }

        this.fetchMCQs();
    }

    async saveUpdatedMcq(mcq: any) {
        try {
            if (!mcq.updatedJson) {
                this.snackBar.open('Please paste updated JSON.', 'Close', { duration: 3000 });
                return;
            }

            const parsed = JSON.parse(mcq.updatedJson);

            // ✅ Basic validation
            if (!parsed.question || !Array.isArray(parsed.options) || parsed.correctIndex === undefined || !Array.isArray(parsed.solutions)) {
                this.snackBar.open('Invalid JSON structure. Required fields missing or malformed.', 'Close', { duration: 4000 });
                return;
            }

            // 🔄 Update Firestore
            await this.mcqService.updateMCQ(mcq.id, parsed);

            // 🧠 Update the local object so it reflects without reload
            mcq.question = parsed.question;
            mcq.options = parsed.options;
            mcq.correctIndex = parsed.correctIndex;
            mcq.solutions = parsed.solutions;

            // You can also optionally update board, standard, etc. if editable
            // mcq.board = parsed.board;

            // ✅ Clear edit mode
            mcq.editMode = false;
            mcq.updatedJson = '';

            this.snackBar.open('MCQ updated successfully!', 'Close', { duration: 3000 });

        } catch (err) {
            console.error('Update failed:', err);
            this.snackBar.open('Update failed. Check the JSON format.', 'Close', { duration: 4000 });
        }
    }



}
