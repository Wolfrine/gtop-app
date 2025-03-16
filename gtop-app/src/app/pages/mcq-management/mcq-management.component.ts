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
        MatOptionModule // ✅ Optional
    ]
})
export class McqManagementComponent implements OnInit {
    mcqs: MCQ[] = [];
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
        private mcqService: McqService
    ) { }

    async ngOnInit() {
        this.route.queryParams.subscribe(async (params) => {
            if (params['board']) this.filters.board = params['board'];
            if (params['standard']) this.filters.standard = params['standard'];
            if (params['subject']) this.filters.subject = params['subject'];
            if (params['chapter']) this.filters.chapter = params['chapter'];

            // Pre-select dropdowns if query params present
            this.selectedBoard = this.filters.board;
            this.selectedStandard = this.filters.standard;
            this.selectedSubject = this.filters.subject;
            this.selectedChapter = this.filters.chapter;

            await this.fetchMCQs();
        });
    }

    async fetchMCQs(loadMore = false) {
        this.loading = true;
        try {
            const response = await this.mcqService.fetchMCQs(this.filters, loadMore ? this.lastVisible : null);
            if (loadMore) {
                this.mcqs = [...this.mcqs, ...response.mcqs];
            } else {
                this.mcqs = response.mcqs;
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

    editMcq(mcq: MCQ) {
        console.log('Edit MCQ:', mcq);
    }

    async deleteMcq(mcq: MCQ) {
        if (confirm('Are you sure you want to delete this MCQ?')) {
            try {
                await this.mcqService.deleteMCQ(mcq.id);
                this.mcqs = this.mcqs.filter(item => item.id !== mcq.id);
            } catch (error) {
                console.error('Error deleting MCQ:', error);
            }
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
        this.fetchMCQs();
    }
}
