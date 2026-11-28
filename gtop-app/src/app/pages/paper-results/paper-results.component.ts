import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { RouterLink } from '@angular/router';
import { openResultShare } from '../../../../../assistant-service/domain/result-share.mjs';
import { loadScanPdfWriter } from '../answer-sheets/answer-sheet-pdf-writer';
import { StaffReleasedPage, StudentSubmissionsService } from '../../services/student-submissions.service';

@Component({
    standalone: true,
    selector: 'app-paper-results',
    imports: [DatePipe,RouterLink],
    template: `
        <main>
            <a routerLink="/admin">Back to Admin</a>
            <h1>Checked results</h1>
            @if (error) { <p role="alert">{{ error }}</p> }
            @if (rows.length) {
                <ul>
                    @for (row of rows; track row.id) {
                        <li>
                            <div>
                                <h2>{{ row.paperTitle || row.title }}</h2>
                                @if (row.studentLabel) { <div>{{ row.studentLabel }}</div> }
                                @if (row.releasedAt) { <time [attr.datetime]="row.releasedAt">{{ row.releasedAt | date:'mediumDate' }}</time> }
                            </div>
                            <button type="button" (click)="share(row.id)">Share result</button>
                        </li>
                    }
                </ul>
            } @else if (!loading && !error) { <p>No released results.</p> }
            @if (loading) { <p role="status">Loading checked results…</p> }
            @if (cursor && !loading) { <button type="button" (click)="load(true)">Load older results</button> }
        </main>
    `,
    styles:[`
        main{max-width:56rem;margin:2.5rem auto;padding:0 1rem 4rem;color:var(--mat-app-text-color,#182522)}
        a{color:#075c43} h1{margin:1rem 0;font-size:clamp(1.75rem,4vw,2.5rem)} ul{list-style:none;padding:0}
        li{display:flex;justify-content:space-between;align-items:center;gap:1rem;padding:.9rem 0;border-bottom:1px solid #d9e1dc}
        li div{min-width:0;overflow-wrap:anywhere} h2{font-size:1rem;margin:0 0 .25rem} time{font-size:.875rem}
        button{background:#14543d;color:white;border:0;border-radius:8px;min-height:44px;padding:.55rem .85rem;font:inherit;flex-shrink:0;cursor:pointer}
        :focus-visible{outline:3px solid #167358;outline-offset:3px}
        @media(max-width:420px){main{margin-top:1.5rem}li{align-items:flex-start;flex-direction:column;gap:.45rem}}
    `],
})
export class PaperResultsComponent implements OnInit, OnDestroy {
    private readonly auth = inject(Auth);
    private readonly api = inject(StudentSubmissionsService);
    private readonly controller = new AbortController();
    private readonly uid = this.auth.currentUser?.uid;
    private closeShare?: () => void;
    private unwatch?: () => void;
    rows: StaffReleasedPage['submissions'] = [];
    cursor: string | null = null;
    error = '';
    loading = false;

    ngOnInit(): void {
        this.unwatch = onAuthStateChanged(this.auth,user => {
            if (user?.uid !== this.uid) this.clear();
        });
        void this.load();
    }

    ngOnDestroy(): void {
        this.unwatch?.();
        this.clear();
    }

    private clear(): void {
        this.controller.abort();
        this.closeShare?.();
        this.rows = [];
        this.cursor = null;
    }

    async load(older = false): Promise<void> {
        const {signal} = this.controller;
        if (this.loading || signal.aborted) return;
        this.loading = true;
        this.error = '';
        try {
            const page = await this.api.staffReleased(older ? this.cursor : null, signal);
            if (signal.aborted) return;
            const present = new Set(this.rows.map(row=>row.id));
            this.rows = older ? [...this.rows,...page.submissions.filter(row=>!present.has(row.id))] : page.submissions;
            this.cursor = page.nextCursor;
        } catch (error) {
            if (signal.aborted) return;
            if ((error as {status?:number}).status === 403) this.clear();
            this.error = error instanceof Error ? error.message : 'Could not load checked results.';
        } finally {
            this.loading = false;
        }
    }

    share(id: string): void {
        if (this.controller.signal.aborted || !this.rows.some(row=>row.id === id)) return;
        this.closeShare?.();
        this.closeShare = openResultShare({
            metadata: signal => this.api.shareAssessment(id,signal,true),
            report: (revision,signal) => this.api.shareReport(id,revision,signal,true),
            loadPdf: loadScanPdfWriter,
        });
    }
}
