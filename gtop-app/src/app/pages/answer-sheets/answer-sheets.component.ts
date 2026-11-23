import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, ViewChild, ElementRef, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import {
    ScanKind, SavedScan, StudentSubmission, StudentSubmissionsService, SubmissionResult, SubmissionTest,
} from '../../services/student-submissions.service';
import { ScannedPdf, encodeScan, openScan, releaseScan, scanPage } from './answer-sheet-scanner';

type Preview = { kind: ScanKind; page: number; count: number; source: 'local' | 'saved'; url: string };
const caps: Record<ScanKind, number> = { answer: 32, question: 24 };
const inviteKey = 'gtop.student-paper-invite';

declare global {
    interface Window { gtopStudentPaperInvite?: string; }
}

function invitation(): string {
    try { return sessionStorage.getItem(inviteKey) ?? ''; }
    catch { return window.gtopStudentPaperInvite ?? ''; }
}

@Component({
    standalone: true,
    selector: 'app-answer-sheets',
    imports: [CommonModule, FormsModule, RouterLink],
    templateUrl: './answer-sheets.component.html',
    styleUrl: './answer-sheets.component.scss',
})
export class AnswerSheetsComponent implements OnInit, OnDestroy {
    @ViewChild('heading') private heading?: ElementRef<HTMLElement>;
    @ViewChild('historyHeading') private historyHeading?: ElementRef<HTMLElement>;
    private readonly api = inject(StudentSubmissionsService);
    private readonly auth = inject(Auth);
    private readonly route = inject(ActivatedRoute);
    private readonly controller = new AbortController();
    private readonly sessionUid = this.auth.currentUser?.uid;
    private unsubscribe?: () => void;
    private creatingId = '';
    private previewRun = 0;
    private downloadUrl = '';
    inviteCode = invitation();
    pendingTestCode = this.route.snapshot.queryParamMap.get('test') ?? '';
    readonly files: Partial<Record<ScanKind, ScannedPdf>> = {};

    eligible = false;
    loading = true;
    busy = '';
    error = '';
    testError = '';
    title = '';
    test?: SubmissionTest;
    submissions: StudentSubmission[] = [];
    active?: StudentSubmission;
    cursor: string | null = null;
    preview?: Preview;
    previewLoading = false;
    previewError = '';
    result?: SubmissionResult;
    useOwnPaper = false;
    replaceWhole = false;
    closed = false;

    get signal(): AbortSignal { return this.controller.signal; }
    get editing(): boolean { return !this.active || ['draft', 'needs_rescan'].includes(this.active.status); }
    get linked(): boolean { return this.active ? !!this.active.testCode : !!this.test; }
    get kinds(): ScanKind[] { return this.linked ? ['answer'] : ['answer', 'question']; }
    get canSend(): boolean {
        if (!this.editing || this.busy || (!this.active && this.pendingTestCode && !this.test && !this.useOwnPaper)) return false;
        const request = this.active?.rescan;
        if (this.active?.status === 'needs_rescan' && request && !this.files[request.kind]) return false;
        return this.kinds.every(kind => !!this.files[kind] || this.complete(this.saved(kind)));
    }

    ngOnInit(): void {
        this.unsubscribe = onAuthStateChanged(this.auth, user => {
            if (user?.uid === this.sessionUid) return;
            this.closed = true;
            this.clearPrivateData();
        });
        void this.load();
    }

    ngOnDestroy(): void {
        this.unsubscribe?.();
        this.closed = true;
        this.clearPrivateData();
    }

    private clearPrivateData(): void {
        this.controller.abort();
        this.resetFiles();
        this.submissions = [];
        this.result = undefined;
        this.active = undefined;
        if (this.downloadUrl) URL.revokeObjectURL(this.downloadUrl);
    }

    private message(error: unknown): string {
        return error instanceof Error ? error.message : 'Something went wrong. Try again.';
    }

    private async run(label: string, fn: () => Promise<void>): Promise<void> {
        if (this.busy || this.closed) return;
        this.error = '';
        this.busy = label;
        try {
            await fn();
        } catch (error) {
            if (!this.closed) this.error = this.message(error);
        } finally {
            this.busy = '';
        }
    }

    load(older = false): Promise<void> {
        return this.run(older ? 'Loading older submissions…' : 'Loading answer sheets…', async () => {
            try {
                await this.loadPage(older);
                if (this.eligible && this.inviteCode) this.clearInvitation();
                if (this.eligible && this.pendingTestCode && !this.test && !this.useOwnPaper) await this.loadTest();
            } finally {
                this.loading = false;
            }
        });
    }

    private async loadPage(older = false): Promise<void> {
        const page = await this.api.list(older ? this.cursor ?? undefined : undefined, this.signal);
        if (this.closed) return;
        this.eligible = page.eligible;
        const records = new Map((older ? this.submissions : []).map(item => [item.id, item]));
        for (const item of page.submissions ?? []) records.set(item.id, item);
        this.submissions = [...records.values()];
        this.cursor = page.nextCursor;
    }

    private async loadTest(): Promise<void> {
        this.testError = '';
        try {
            this.test = await this.api.test(this.pendingTestCode, this.signal);
        } catch (error) {
            if (!this.closed) this.testError = this.message(error);
        }
    }

    join(): Promise<void> {
        return this.run('Joining paper checking…', async () => {
            const { testCode } = await this.api.join(this.inviteCode, this.signal);
            this.clearInvitation();
            this.pendingTestCode ||= testCode ?? '';
            await this.loadPage();
            if (this.eligible && this.pendingTestCode) await this.loadTest();
        });
    }

    private clearInvitation(): void {
        this.inviteCode = '';
        delete window.gtopStudentPaperInvite;
        try { sessionStorage.removeItem(inviteKey); } catch { /* Storage may be disabled. */ }
    }

    retryTest(): Promise<void> {
        return this.run('Opening the shared test…', () => this.loadTest());
    }

    ownPaper(): void {
        this.test = undefined;
        this.testError = '';
        this.useOwnPaper = true;
    }

    newSubmission(): void {
        this.active = undefined;
        this.result = undefined;
        this.title = '';
        this.replaceWhole = false;
        this.creatingId = '';
        if (this.downloadUrl) URL.revokeObjectURL(this.downloadUrl);
        this.downloadUrl = '';
        this.resetFiles();
        this.error = '';
        this.focusHeading();
    }

    private focusHeading(): void {
        requestAnimationFrame(() => this.heading?.nativeElement.focus());
    }

    openHistory(): void { this.historyHeading?.nativeElement.focus(); }

    open(id: string): Promise<void> {
        return this.run('Opening submission…', async () => {
            if (!this.confirmLeaving()) return;
            const item = await this.api.submission('/' + encodeURIComponent(id), undefined, this.signal);
            if (this.closed) return;
            this.newSubmission();
            this.record(item);
            if (item.status === 'released') this.result = await this.api.result(item.id, this.signal);
        });
    }

    refresh(): Promise<void> {
        if (this.active) return this.open(this.active.id);
        return this.load();
    }

    confirmLeaving(): boolean {
        return (!this.files.answer && !this.files.question) || window.confirm('Leave these selected PDFs? Uploaded pages are saved.');
    }

    private record(item: StudentSubmission): void {
        if (this.closed) return;
        this.active = item;
        const found = this.submissions.findIndex(row => row.id === item.id);
        this.submissions = found < 0 ? [item, ...this.submissions] : this.submissions.map(row => row.id === item.id ? item : row);
    }

    label(kind: ScanKind): string { return kind === 'answer' ? 'Answer sheet' : 'Question paper'; }
    limit(kind: ScanKind): number { return this.targetPage(kind) ? 1 : caps[kind]; }
    targetPage(kind: ScanKind): number | undefined {
        const request = this.active?.rescan;
        return !this.replaceWhole && request?.kind === kind ? request.page : undefined;
    }
    saved(kind: ScanKind): SavedScan | null | undefined { return this.active?.[kind]; }
    complete(scan: SavedScan | null | undefined): boolean { return !!scan && scan.pages.length === scan.pageCount; }
    fileName(kind: ScanKind): string { return this.files[kind]?.name ?? this.saved(kind)?.name ?? ''; }
    filePages(kind: ScanKind): number { return this.files[kind]?.order.length ?? this.saved(kind)?.pageCount ?? 0; }

    pick(event: Event, kind: ScanKind): Promise<void> {
        const input = event.target as HTMLInputElement;
        const file = input.files?.item(0);
        input.value = '';
        if (!file) return Promise.resolve();
        return this.run('Preparing ' + this.label(kind).toLowerCase() + '…', async () => {
            const replacement = await openScan(file, this.limit(kind));
            if (this.closed) {
                await releaseScan(replacement);
                return;
            }
            this.removeFile(kind);
            this.files[kind] = replacement;
            await this.showPreview(kind, 1, 'local');
        });
    }

    removeFile(kind: ScanKind): void {
        const current = this.files[kind];
        if (this.preview?.kind === kind) this.closePreview();
        if (current) void releaseScan(current).catch(() => {});
        delete this.files[kind];
    }

    private resetFiles(): void {
        this.closePreview();
        for (const kind of ['answer', 'question'] as const) this.removeFile(kind);
    }

    changeReplacement(): void {
        const kind = this.active?.rescan?.kind;
        if (kind) this.removeFile(kind);
        this.replaceWhole = !this.replaceWhole;
    }

    async showPreview(kind: ScanKind, page = 1, source: Preview['source'] = this.files[kind] ? 'local' : 'saved'): Promise<void> {
        const run = ++this.previewRun;
        this.previewLoading = true;
        this.previewError = '';
        try {
            const file = this.files[kind];
            const saved = this.saved(kind);
            const count = source === 'local' ? file?.order.length : saved?.pageCount;
            if (!count || page < 1 || page > count) return;
            if (source === 'saved' && !saved?.pages.some(item => item.index === page)) {
                throw Error('This page has not been uploaded yet. Choose the original PDF to continue.');
            }
            const blob = source === 'local' && file ? await scanPage(file, page, true)
                : await this.api.blob(this.pagePath(kind, page), this.signal);
            if (this.closed || run !== this.previewRun) return;
            if (this.preview?.url) URL.revokeObjectURL(this.preview.url);
            this.preview = { kind, page, count, source, url: URL.createObjectURL(blob) };
        } catch (error) {
            if (!this.closed && run === this.previewRun) this.previewError = this.message(error);
        } finally {
            if (run === this.previewRun) this.previewLoading = false;
        }
    }

    closePreview(): void {
        ++this.previewRun;
        this.previewLoading = false;
        this.previewError = '';
        if (this.preview) URL.revokeObjectURL(this.preview.url);
        this.preview = undefined;
    }

    movePage(delta: number): void {
        const view = this.preview;
        if (!view || view.source !== 'local' || this.previewLoading || this.busy) return;
        const order = this.files[view.kind]?.order;
        if (!order) return;
        const from = view.page - 1;
        const to = from + delta;
        if (to < 0 || to >= order.length) return;
        [order[from], order[to]] = [order[to], order[from]];
        this.preview = { ...view, page: to + 1 };
    }

    private path(): string { return '/' + encodeURIComponent(this.active?.id ?? this.creatingId); }
    private pagePath(kind: ScanKind, page: number): string { return this.path() + '/pages/' + kind + '/' + page; }

    async send(): Promise<void> {
        if (!this.canSend) return;
        await this.run('Saving scanned pages…', async () => {
            try {
                await this.prepareDraft();
                if (this.closed || !this.active) return;
                if (this.active.status !== 'draft') return;
                for (const kind of this.kinds) await this.upload(kind);
                this.busy = 'Sending to GT…';
                this.record(await this.api.submission(this.path() + '/submit', { version: this.active.version }, this.signal));
                this.resetFiles();
                this.focusHeading();
            } catch (error) {
                if (!this.closed && (this.active || this.creatingId)) {
                    const record = await this.api.submission(this.path(), undefined, this.signal).catch(() => undefined);
                    if (record) this.record(record);
                    if (record?.status === 'submitted') {
                        this.resetFiles();
                        this.focusHeading();
                        return;
                    }
                }
                throw error;
            }
        });
    }

    private async prepareDraft(): Promise<void> {
        const counts = {
            answerPageCount: this.desiredCount('answer'),
            ...(this.linked ? {} : { questionPageCount: this.desiredCount('question') }),
        };
        const names = {
            answerName: this.fileName('answer').slice(0, 120),
            ...(this.linked ? {} : { questionName: this.fileName('question').slice(0, 120) }),
        };
        if (!this.active) {
            this.creatingId ||= crypto.randomUUID();
            this.record(await this.api.submission('', { id: this.creatingId, title: this.title.trim() || undefined,
                testCode: this.test?.code, ...counts, ...names }, this.signal));
            return;
        }
        if (this.active.status === 'needs_rescan' && this.active.rescan) {
            const request = this.active.rescan;
            this.record(await this.api.submission(this.path() + '/revise', {
                version: this.active.version, ...counts, ...names, replaceKind: request.kind, replacePage: this.targetPage(request.kind) ?? null,
            }, this.signal));
        }
    }

    private desiredCount(kind: ScanKind): number {
        return this.targetPage(kind) ? this.saved(kind)?.pageCount ?? 0 : this.filePages(kind);
    }

    private async upload(kind: ScanKind): Promise<void> {
        const file = this.files[kind];
        let saved = this.saved(kind);
        if (!file || !saved || !this.active) return;
        const replacementPage = file.order.length === 1 ? this.targetPage(kind) : undefined;
        const target = replacementPage ?? 1;
        if (!replacementPage && file.order.length !== saved.pageCount) {
            await this.resetSavedScan(kind, file);
            saved = this.saved(kind)!;
        }
        for (let i = 1; i <= file.order.length; i++) {
            if (this.closed || !this.active) return;
            const index = target + i - 1;
            this.busy = 'Saving ' + this.label(kind).toLowerCase() + ' · page ' + index + ' of ' + saved.pageCount;
            const jpeg = await encodeScan(await scanPage(file, i));
            const existing = this.saved(kind)?.pages.find(page => page.index === index);
            if (existing) {
                if (existing.sha === await this.fingerprint(jpeg)) continue;
                await this.resetSavedScan(kind, file, replacementPage);
                return this.upload(kind);
            }
            this.record(await this.api.submission(this.pagePath(kind, index), { jpeg, version: this.active.version }, this.signal));
        }
    }

    private async resetSavedScan(kind: ScanKind, file: ScannedPdf, replacePage?: number): Promise<void> {
        if (!this.active) return;
        this.record(await this.api.submission(this.path() + '/revise', { version: this.active.version,
            answerPageCount: kind === 'answer' && !replacePage ? file.order.length : this.active.answer.pageCount,
            ...(this.active.question ? { questionPageCount: kind === 'question' && !replacePage ? file.order.length : this.active.question.pageCount } : {}),
            ...(kind === 'answer' ? { answerName: file.name.slice(0, 120) } : { questionName: file.name.slice(0, 120) }),
            replaceKind: kind, replacePage: replacePage ?? null,
        }, this.signal));
    }

    private async fingerprint(jpeg: string): Promise<string> {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([jpeg])));
        return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    }

    statusText(item: StudentSubmission): string {
        if (item.status === 'checking') {
            switch (item.sheetState) {
                case 'running': return 'Checking';
                case 'review': case 'final': return 'With your teacher';
                case 'failed': return 'Waiting for your teacher';
                default: return 'Queued for checking';
            }
        }
        return { draft: 'Draft', submitted: 'Submitted', needs_rescan: 'Rescan needed', released: 'Results ready' }[item.status];
    }

    download(): Promise<void> {
        return this.run('Preparing your marked copy…', async () => {
            if (!this.active || !this.result || this.active.status !== 'released') return;
            const pdf = await this.api.blob(this.path() + '/result/pdf', this.signal);
            if (this.closed) return;
            if (this.downloadUrl) URL.revokeObjectURL(this.downloadUrl);
            this.downloadUrl = URL.createObjectURL(pdf);
            const link = document.createElement('a');
            link.href = this.downloadUrl;
            link.download = this.result.filename || 'GT-marked-answer-sheet.pdf';
            link.click();
        });
    }
}
