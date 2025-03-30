import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatOption } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { SyllabusService, SyllabusItem } from '../../../services/syllabus.service';

@Component({
    selector: 'app-edit-syllabus',
    standalone: true,
    imports: [
        CommonModule,
        MatTableModule,
        MatInputModule,
        MatIconModule,
        MatButtonModule,
        FormsModule,
        MatSelectModule,
        MatOption
    ],
    templateUrl: './edit-syllabus.component.html',
    styleUrls: ['./edit-syllabus.component.scss']
})
export class EditSyllabusComponent implements OnInit {
    displayedColumns: string[] = ['board', 'standard', 'subject', 'chapter', 'actions'];
    syllabus: SyllabusItem[] = [];

    filteredSyllabus: SyllabusItem[] = [];

    editingRowIndex: number | null = null;
    editedRow: Partial<SyllabusItem> = {};

    selectedBoard: string | null = null;
    selectedStandard: string | null = null;
    selectedSubject: string | null = null;

    uniqueBoards: string[] = [];
    uniqueStandards: string[] = [];
    uniqueSubjects: string[] = [];

    constructor(private syllabusService: SyllabusService) { }

    ngOnInit(): void {
        this.syllabusService.syllabus$.subscribe((data) => {
            // Sort the full data
            this.syllabus = [...data].sort((a, b) => {
                const aKey = `${a.board}|${a.standard}|${a.subject}|${a.chapter}`.toLowerCase();
                const bKey = `${b.board}|${b.standard}|${b.subject}|${b.chapter}`.toLowerCase();
                return aKey.localeCompare(bKey);
            });

            // Initialize board filter options
            this.uniqueBoards = [...new Set(this.syllabus.map(i => i.board))];

            this.applyFilters();
        });
    }

    applyFilters(): void {
        // Filter rows
        this.filteredSyllabus = this.syllabus.filter(item =>
            (!this.selectedBoard || item.board === this.selectedBoard) &&
            (!this.selectedStandard || item.standard === this.selectedStandard) &&
            (!this.selectedSubject || item.subject === this.selectedSubject)
        );

        // Update cascading dropdown options dynamically
        const filteredForStandards = this.syllabus.filter(item =>
            !this.selectedBoard || item.board === this.selectedBoard
        );
        this.uniqueStandards = [...new Set(filteredForStandards.map(i => i.standard))];

        const filteredForSubjects = filteredForStandards.filter(item =>
            !this.selectedStandard || item.standard === this.selectedStandard
        );
        this.uniqueSubjects = [...new Set(filteredForSubjects.map(i => i.subject))];
    }

    onBoardChange(): void {
        this.selectedStandard = null;
        this.selectedSubject = null;
        this.applyFilters();
    }

    onStandardChange(): void {
        this.selectedSubject = null;
        this.applyFilters();
    }

    onStartEdit(rowIndex: number): void {
        this.editingRowIndex = rowIndex;
        this.editedRow = { ...this.filteredSyllabus[rowIndex] };
    }

    onEditComplete(rowIndex: number): void {
        const oldRow = this.filteredSyllabus[rowIndex];

        const oldPath = {
            board: oldRow.board,
            standard: oldRow.standard,
            subject: oldRow.subject,
            chapter: oldRow.chapter
        };

        const newPath = {
            board: this.editedRow.board?.trim() || '',
            standard: this.editedRow.standard?.trim() || '',
            subject: this.editedRow.subject?.trim() || '',
            chapter: this.editedRow.chapter?.trim() || ''
        };

        if (JSON.stringify(oldPath) !== JSON.stringify(newPath)) {
            console.log('Syllabus Edited:', { oldPath, newPath });
            // 🔗 TODO: Firestore Integrator service call goes here


        }

        this.editingRowIndex = null;
        this.editedRow = {};
    }
}
