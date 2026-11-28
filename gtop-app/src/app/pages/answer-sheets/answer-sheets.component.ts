import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, ViewChild, ElementRef, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { openResultShare } from '../../../../../assistant-service/domain/result-share.mjs';
import { loadScanPdfWriter } from './answer-sheet-pdf-writer';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import {
    CheckingDestination, ScanKind, SavedScan, StudentSubmission, StudentSubmissionsService, SubmissionResult, SubmissionTest, submissionStatusLabels,
} from '../../services/student-submissions.service';
import { artifactFilename } from '../../../../../assistant-service/domain/artifact-filenames.mjs';
import { maxPhotoBytes, maxScanSourceBytes, preparePhoto } from './answer-sheet-photo';
import { LocalScan, PhotoScan, encodeScan, openScan, preparedPage, releaseScan, scanPage } from './answer-sheet-scanner';
import { buildScanPdf } from './answer-sheet-scan-pdf';

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
    imports: [CommonModule, FormsModule, MatIconModule, RouterLink],
    templateUrl: './answer-sheets.component.html',
    styleUrl: './answer-sheets.component.scss',
})
export class AnswerSheetsComponent implements OnInit, OnDestroy {
    @ViewChild('heading') private heading?: ElementRef<HTMLElement>;
    @ViewChild('historyHeading') private historyHeading?: ElementRef<HTMLElement>;
    @ViewChild('previewCaption') private previewCaption?: ElementRef<HTMLElement>;
    @ViewChild('addSheet') private addSheet?: ElementRef<HTMLButtonElement>;
    private readonly api = inject(StudentSubmissionsService);
    private readonly auth = inject(Auth);
    private readonly route = inject(ActivatedRoute);
    private readonly controller = new AbortController();
    private readonly sessionUid = this.auth.currentUser?.uid;
    private unsubscribe?: () => void;
    private creatingId = '';
    private previewRun = 0;
    private downloadUrl = '';
    private closeShare?: () => void;
    private resendAvailable?: boolean;
    private resendDestination?: CheckingDestination | null;
    inviteCode = invitation();
    pendingTestCode = this.route.snapshot.queryParamMap.get('test') ?? '';
    composerOpen = !!this.pendingTestCode;
    readonly files: Partial<Record<ScanKind, LocalScan>> = {};

    savesEnabled = false;
    checkingAvailable = false;
    checkingDestination: CheckingDestination | null = null;
    sharedTestsAvailable = false;
    checkingNeedsProfile = false;
    confirmation = '';
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
    previewKind?: ScanKind;
    scanBusyKind?: ScanKind;
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
    get canSave(): boolean {
        if (!this.savesEnabled || !this.editing || this.busy ||
            (!this.active && this.pendingTestCode && !this.test && !this.useOwnPaper)) return false;
        if (this.active?.status === 'needs_rescan' && this.active.rescan && !this.files[this.active.rescan.kind]) return false;
        return !!this.files.answer || this.complete(this.saved('answer'));
    }

    get checkingForDraft(): boolean {
        return this.resendAvailable ?? this.checkingAvailable;
    }

    get currentDestination(): CheckingDestination | null {
        return this.resendDestination === undefined ? this.checkingDestination : this.resendDestination;
    }

    get canSend(): boolean {
        return this.canSave && this.checkingForDraft && (this.linked
            ? this.sharedTestsAvailable
            : !!this.files.question || this.complete(this.saved('question')));
    }

    ngOnInit(): void {
        this.unsubscribe = onAuthStateChanged(this.auth, user => {
            if (user?.uid === this.sessionUid) return;
            this.closed = true;
            this.clearPrivateData();
        });
        void this.load(false, this.route.snapshot.queryParamMap.get('sheet'));
    }

    ngOnDestroy(): void {
        this.unsubscribe?.();
        this.closed = true;
        this.clearPrivateData();
    }

    private clearPrivateData(): void {
        this.closeShare?.();
        this.closeShare = undefined;
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
            this.scanBusyKind = undefined;
        }
    }

    load(older = false, sheetId: string | null = null): Promise<void> {
        return this.run(older ? 'Loading older submissions…' : 'Loading answer sheets…', async () => {
            try {
                await this.loadPage(older);
                if (!older && this.loading && this.savesEnabled && this.route.snapshot.queryParamMap.get('start') === '1') {
                    this.composerOpen = true;
                }
                if (this.sharedTestsAvailable && this.pendingTestCode && !this.test && !this.useOwnPaper) await this.loadTest();
                if (sheetId && /^[a-z0-9_-]{1,128}$/i.test(sheetId)) {
                    await this.openRecord(sheetId);
                } else if (!older && this.active?.submittedAt && this.editing) {
                    const item = await this.api.submission(this.path(), undefined, this.signal);
                    if (!this.closed) this.setResendDestination(item);
                }
            } finally {
                this.loading = false;
            }
        });
    }

    private async loadPage(older = false): Promise<void> {
        const page = await this.api.list(older ? this.cursor ?? undefined : undefined, this.signal);
        if (this.closed) return;
        this.savesEnabled = page.savesEnabled ?? page.eligible;
        this.checkingAvailable = page.checkingAvailable ?? page.eligible;
        this.checkingDestination = page.checkingDestination ?? null;
        this.sharedTestsAvailable = page.sharedTestsAvailable ?? page.eligible;
        this.checkingNeedsProfile = page.checkingNeedsProfile === true;
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
            if (this.sharedTestsAvailable && this.pendingTestCode) {
                await this.loadTest();
                if (!this.closed && !this.active) this.composerOpen = true;
            }
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
        this.resetSubmissionView();
        this.composerOpen = true;
        this.focusHeading();
    }

    closeSubmission(): void {
        if (this.busy || !this.confirmLeaving()) return;
        this.resetSubmissionView();
        this.composerOpen = false;
        requestAnimationFrame(() => {
            const launch = this.addSheet?.nativeElement;
            if (launch && !launch.disabled) launch.focus();
            else this.openHistory();
        });
    }

    private resetSubmissionView(): void {
        this.active = undefined;
        this.resendAvailable = undefined;
        this.resendDestination = undefined;
        this.closeShare?.();
        this.closeShare = undefined;
        this.result = undefined;
        this.title = '';
        this.replaceWhole = false;
        this.creatingId = '';
        if (this.downloadUrl) URL.revokeObjectURL(this.downloadUrl);
        this.downloadUrl = '';
        this.resetFiles();
        this.error = '';
        this.confirmation = '';
    }

    private focusHeading(): void {
        requestAnimationFrame(() => this.heading?.nativeElement.focus());
    }

    openHistory(): void { this.historyHeading?.nativeElement.focus(); }

    open(id: string): Promise<void> {
        return this.run('Opening submission…', async () => {
            if (!this.confirmLeaving()) return;
            await this.openRecord(id);
        });
    }

    private async openRecord(id: string): Promise<void> {
        const item = await this.api.submission('/' + encodeURIComponent(id), undefined, this.signal);
        if (this.closed) return;
        this.newSubmission();
        this.setResendDestination(item);
        this.record(item);
        if (item.status === 'released') {
            const result = await this.api.result(item.id, this.signal);
            if (!this.closed) this.result = result;
        }
    }

    private setResendDestination(item: StudentSubmission): void {
        this.resendAvailable = item.mayResend;
        this.resendDestination = item.checkingDestination;
    }

    refresh(): Promise<void> {
        if (this.active) return this.open(this.active.id);
        return this.load();
    }

    confirmLeaving(): boolean {
        return (!this.files.answer && !this.files.question) || window.confirm('Leave these selected pages? Uploaded pages are saved.');
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
    canPick(kind: ScanKind): boolean { return !this.busy && (!this.active?.rescan || this.active.rescan.kind === kind); }
    photos(kind: ScanKind): PhotoScan | undefined {
        const source = this.files[kind];
        return source?.mode === 'photos' ? source : undefined;
    }
    photosFull(kind: ScanKind): boolean {
        return this.limit(kind) > 1 && (this.photos(kind)?.order.length ?? 0) >= this.limit(kind);
    }

    photoName(view: Preview): string | undefined {
        const scan = this.photos(view.kind);
        return view.source === 'local' && scan ? preparedPage(scan, view.page)?.sourceBasename : undefined;
    }

    pick(event: Event, kind: ScanKind): Promise<void> {
        const input = event.target as HTMLInputElement;
        const file = input.files?.item(0);
        input.value = '';
        if (!file || !this.canPick(kind)) return Promise.resolve();
        return this.run('Preparing ' + this.label(kind).toLowerCase() + '…', async () => {
            this.scanBusyKind = kind;
            const replacement = await openScan(file, this.limit(kind));
            if (this.closed) {
                await releaseScan(replacement);
                return;
            }
            this.removeFile(kind);
            this.files[kind] = replacement;
            await this.showPreview(kind, 1, 'local', true);
        });
    }

    pickPhotos(event: Event, kind: ScanKind): Promise<void> {
        const input = event.target as HTMLInputElement;
        const files = Array.from(input.files ?? []);
        input.value = '';
        if (!files.length || !this.canPick(kind)) return Promise.resolve();
        return this.run('Preparing photos…', async () => {
            this.scanBusyKind = kind;
            const limit = this.limit(kind);
            const current = limit > 1 ? this.photos(kind) : undefined;
            const pages = new Map(current?.pages);
            const order = current?.order.slice() ?? [];
            const priorCount = order.length;
            if (priorCount + files.length > limit) {
                throw Error(limit === 1 ? 'Choose one photo for the replacement page.' : 'Choose up to ' + limit + ' photos for this scan.');
            }
            const sourceBytes = Array.from(pages.values(), page => page.file.size).reduce((a, b) => a + b, 0);
            if (files.reduce((total, file) => total + file.size, sourceBytes) > maxScanSourceBytes) {
                throw Error('Choose up to 64 MB of photos for this scan.');
            }

            const oversized = files.findIndex(file => !file.size || file.size > maxPhotoBytes);
            if (oversized >= 0) throw Error('Choose a photo up to 20 MB for page ' + (priorCount + oversized + 1) + '.');

            let pageId = Math.max(0, ...order);
            for (const file of files) {
                this.busy = 'Preparing photo ' + (order.length + 1) + ' of ' + (priorCount + files.length) + '…';
                const photo = await preparePhoto(file, order.length + 1, 0, this.signal);
                const id = ++pageId;
                pages.set(id, photo);
                order.push(id);
            }
            if (this.closed) return;
            this.removeFile(kind);
            this.files[kind] = { mode: 'photos', name: this.label(kind) + ' photos', pages, order };
            await this.showPreview(kind, priorCount + 1, 'local', true);
        });
    }

    rotatePhoto(): Promise<void> {
        const view = this.preview;
        if (view?.source !== 'local' || this.previewLoading) return Promise.resolve();
        const scan = this.photos(view.kind);
        const id = scan?.order[view.page - 1];
        const page = id !== undefined ? scan?.pages.get(id) : undefined;
        if (!scan || id === undefined || !page) return Promise.resolve();
        return this.run('Rotating page…', async () => {
            this.scanBusyKind = view.kind;
            const rotated = await preparePhoto(page.file, view.page, (page.turns + 1) % 4, this.signal);
            if (this.closed) return;
            scan.pages.set(id, rotated);
            await this.showPreview(view.kind, view.page, 'local');
        });
    }

    async removePhoto(): Promise<void> {
        const view = this.preview;
        if (view?.source !== 'local' || this.previewLoading || this.busy) return;
        const scan = this.photos(view.kind);
        if (!scan) return;
        const [id] = scan.order.splice(view.page - 1, 1);
        scan.pages.delete(id);
        if (scan.order.length) {
            await this.showPreview(view.kind, Math.min(view.page, scan.order.length), 'local');
        } else {
            this.removeFile(view.kind);
            requestAnimationFrame(() => this.heading?.nativeElement.focus());
        }
    }

    downloadScanPdf(kind: ScanKind): Promise<void> {
        const scan = this.photos(kind);
        if (!scan) return Promise.resolve();
        return this.run('Preparing your scan PDF…', async () => {
            this.scanBusyKind = kind;
            const pages = scan.order.map(id => scan.pages.get(id)!);
            const blob = await buildScanPdf(pages);
            if (this.closed) return;
            const id = this.active?.id ?? (this.creatingId ||= crypto.randomUUID());
            const name = artifactFilename({
                label: this.active?.title || this.test?.title || this.title.trim() || this.label(kind),
                kind: kind === 'answer' ? 'answer-scan' : 'question-scan',
                id,
                revision: this.active?.revision ?? 1,
                page: this.targetPage(kind),
                extension: 'pdf',
            });
            this.downloadFile(blob, name);
        });
    }

    removeFile(kind: ScanKind): void {
        const current = this.files[kind];
        if (this.previewKind === kind) this.closePreview();
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

    async showPreview(kind: ScanKind, page = 1, source: Preview['source'] = this.files[kind] ? 'local' : 'saved', focus = false): Promise<void> {
        const run = ++this.previewRun;
        if (this.preview && this.preview.kind !== kind) {
            URL.revokeObjectURL(this.preview.url);
            this.preview = undefined;
        }
        this.previewKind = kind;
        this.previewLoading = true;
        this.previewError = '';
        try {
            const file = this.files[kind];
            const saved = this.saved(kind);
            const count = source === 'local' ? file?.order.length : saved?.pageCount;
            if (!count || page < 1 || page > count) return;
            if (source === 'saved' && !saved?.pages.some(item => item.index === page)) {
                throw Error('This page has not been uploaded yet. Choose the original PDF or photos to continue.');
            }
            const blob = source === 'local' && file ? await scanPage(file, page, true)
                : await this.api.blob(this.pagePath(kind, page), this.signal);
            if (this.closed || run !== this.previewRun) return;
            if (this.preview?.url) URL.revokeObjectURL(this.preview.url);
            this.preview = { kind, page, count, source, url: URL.createObjectURL(blob) };
            if (focus) requestAnimationFrame(() => this.previewCaption?.nativeElement.focus());
        } catch (error) {
            if (!this.closed && run === this.previewRun) this.previewError = this.message(error);
        } finally {
            if (run === this.previewRun) this.previewLoading = false;
        }
    }

    closePreview(restoreFocus = false): void {
        ++this.previewRun;
        this.previewLoading = false;
        this.previewError = '';
        if (this.preview) URL.revokeObjectURL(this.preview.url);
        this.preview = undefined;
        this.previewKind = undefined;
        if (restoreFocus) this.focusHeading();
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

    async save(sendForChecking = false): Promise<void> {
        if (sendForChecking ? !this.canSend : !this.canSave) return;
        const checkingConfirmation = sendForChecking ? this.currentDestination?.confirmation : undefined;
        this.confirmation = '';
        await this.run('Saving scanned pages…', async () => {
            try {
                await this.prepareDraft();
                if (this.closed || !this.active) return;
                if (this.active.status !== 'draft') return;
                for (const kind of this.kinds) await this.upload(kind);
                if (this.closed || !this.active) return;
                if (sendForChecking) {
                    this.busy = 'Sending for checking…';
                    this.record(await this.api.submission(this.path() + '/submit', { version: this.active.version, checkingConfirmation }, this.signal));
                } else {
                    this.confirmation = this.active.submittedAt ? 'Replacement pages saved.' : 'Private draft saved.';
                }
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
        if (!file || !this.active) return;
        if (!saved && kind === 'question') {
            await this.resetSavedScan(kind, file);
            saved = this.saved(kind);
        }
        if (!saved) return;
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
            const page = preparedPage(file, i);
            const jpeg = await encodeScan(page?.jpeg ?? await scanPage(file, i));
            const existing = this.saved(kind)?.pages.find(page => page.index === index);
            if (existing) {
                if (existing.sha === await this.fingerprint(jpeg)) continue;
                await this.resetSavedScan(kind, file, replacementPage);
                return this.upload(kind);
            }
            this.record(await this.api.submission(this.pagePath(kind, index), {
                jpeg, version: this.active.version, ...(page?.sourceBasename ? { sourceBasename: page.sourceBasename } : {}),
            }, this.signal));
        }
    }

    private async resetSavedScan(kind: ScanKind, file: LocalScan, replacePage?: number): Promise<void> {
        if (!this.active) return;
        this.record(await this.api.submission(this.path() + '/revise', { version: this.active.version,
            answerPageCount: kind === 'answer' && !replacePage ? file.order.length : this.active.answer.pageCount,
            ...(kind === 'question' && !replacePage ? { questionPageCount: file.order.length } :
                this.active.question ? { questionPageCount: this.active.question.pageCount } : {}),
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
                case 'review': case 'final': return 'Checking';
                case 'failed': return 'Waiting for your teacher';
                default: return 'Queued for checking';
            }
        }
        return submissionStatusLabels[item.status];
    }

    shareResult(): void {
        const row = this.active;
        if (this.closed || row?.status !== 'released' || !this.result?.share) return;
        this.closeShare?.();
        this.closeShare = openResultShare({
            metadata: signal => this.api.shareAssessment(row.id,signal),
            report: (revision,signal) => this.api.shareReport(row.id,revision,signal),
            loadPdf: loadScanPdfWriter,
        });
    }

    download(): Promise<void> {
        return this.run('Preparing your marked copy…', async () => {
            if (!this.active || !this.result || this.active.status !== 'released') return;
            const pdf = this.result.share
                ? await this.api.shareReport(this.active.id,this.result.share.revision,this.signal)
                : await this.api.blob(this.path() + '/result/pdf', this.signal);
            if (this.closed) return;
            this.downloadFile(pdf, this.result.filename || 'GT-marked-answer-sheet.pdf');
        });
    }

    private downloadFile(blob: Blob, filename: string): void {
        if (this.downloadUrl) URL.revokeObjectURL(this.downloadUrl);
        this.downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = this.downloadUrl;
        link.download = filename;
        link.click();
    }
}
