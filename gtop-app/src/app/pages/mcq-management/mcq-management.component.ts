import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router } from '@angular/router';
import { McqService } from '../../services/mcq.service';
import { MCQ } from '../../services/mcq.service';



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
        MatToolbarModule
    ]
})
export class McqManagementComponent implements OnInit {
    mcqs: MCQ[] = [];
    optionLabels = ['A)', 'B)', 'C)', 'D)'];
    loading = true;
    lastVisible: any = null;
    filters = { subject: '' };

    constructor(private router: Router, private mcqService: McqService) { }

    async ngOnInit() {
        await this.fetchMCQs();
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
}
