import { Injectable, inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { assistantGatewayUrl } from '../firebase-environment';
import type { ShareAssessment } from '../../../../assistant-service/domain/result-share.mjs';

export type ScanKind = 'answer' | 'question';
export type SubmissionStatus = 'draft' | 'submitted' | 'needs_rescan' | 'checking' | 'released';

export interface CheckingDestination {
    source: 'growth_tutorials' | 'assigned';
    label: string;
    confirmation: string;
}

export interface SavedScan {
    name: string;
    pageCount: number;
    pages: { index: number; sha: string }[];
}

export interface StudentSubmission {
    id: string;
    status: SubmissionStatus;
    teacherUpload?: boolean;
    version: number;
    revision: number;
    title: string;
    subject?: string;
    testCode?: string;
    answer: SavedScan;
    question: SavedScan | null;
    rescan: { kind: ScanKind; page?: number; reason: string } | null;
    createdAt: string;
    updatedAt: string;
    submittedAt?: string;
    sheetState?: string;
    mayResend?: boolean;
    checkingDestination?: CheckingDestination | null;
    checkingRecipient?: string;
}

export interface SubmissionPage {
    eligible: boolean;
    savesEnabled?: boolean;
    checkingAvailable?: boolean;
    checkingDestination?: CheckingDestination | null;
    sharedTestsAvailable?: boolean;
    checkingNeedsProfile?: boolean;
    submissions: StudentSubmission[];
    nextCursor: string | null;
}

export interface SubmissionTest {
    code: string;
    title: string;
    subject?: string;
}

export interface SubmissionResult {
    filename: string;
    rubric: { title: string; marks: number | null };
    outcome?: 'complete' | 'partial' | 'unassessable';
    message?: string | null;
    assessedAwarded?: number | null;
    assessedMax?: number | null;
    share?: ShareAssessment;
    sheet: {
        grade: {
            awarded: number | null;
            max: number | null;
            pending?: number | null;
            answers: { number: number; awarded: number | null; max: number; explanation: string; status?: string; counted?: boolean | null }[];
        };
    };
}

export interface StaffReleasedPage {
    submissions: {id: string; title: string; paperTitle?: string; studentLabel?: string; releasedAt?: string}[];
    nextCursor: string | null;
}

export interface ReleasedPaperScore {
    id: string;
    title: string | null;
    subject: string | null;
    releasedAt: string | null;
    awarded: number | null;
    max: number | null;
}

export interface ReleasedPaperPage {
    papers: ReleasedPaperScore[];
    nextCursor: string | null;
}

export const submissionStatusLabels: Record<SubmissionStatus, string> = {
    draft: 'Draft', submitted: 'Submitted', needs_rescan: 'Rescan needed', checking: 'Checking', released: 'Results ready',
};

@Injectable({ providedIn: 'root' })
export class StudentSubmissionsService {
    private readonly auth = inject(Auth);
    preview(signal: AbortSignal): Promise<{ submissions: StudentSubmission[] }> {
        return this.json('?preview=1', undefined, signal);
    }

    list(cursor?: string, signal?: AbortSignal): Promise<SubmissionPage> {
        return this.json(cursor ? '?cursor=' + encodeURIComponent(cursor) : '', undefined, signal);
    }

    async releasedScores(signal: AbortSignal, cursor?: string): Promise<ReleasedPaperPage> {
        const path = '?view=released-scores' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '');
        const page = await this.json<ReleasedPaperPage>(path, undefined, signal);
        if (!Array.isArray(page.papers)) throw Error('Released scores are unavailable.');
        return page;
    }

    join(code: string, signal?: AbortSignal): Promise<{ testCode?: string }> {
        return this.json('/enroll', { code }, signal);
    }

    test(code: string, signal?: AbortSignal): Promise<SubmissionTest> {
        return this.json('/test/' + encodeURIComponent(code), undefined, signal);
    }

    async submission(path: string, body?: object, signal?: AbortSignal): Promise<StudentSubmission> {
        const result = await this.json<{ submission: StudentSubmission }>(path, body, signal);
        return result.submission;
    }

    result(id: string, signal: AbortSignal): Promise<SubmissionResult> {
        return this.json('/' + encodeURIComponent(id) + '/result', undefined, signal);
    }

    async staffReleasedAccess(signal: AbortSignal): Promise<boolean> {
        const response = await this.request('?status=released&access=1',undefined,signal,true);
        return (await response.json()).allowed === true;
    }

    async staffReleased(cursor: string | null, signal: AbortSignal): Promise<StaffReleasedPage> {
        const path = '?status=released' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '');
        return (await this.request(path,undefined,signal,true)).json();
    }

    async shareAssessment(id: string, signal: AbortSignal, staff = false): Promise<ShareAssessment> {
        const path = '/' + encodeURIComponent(id) + '/result';
        const response = await this.request(path,undefined,signal,staff);
        const result = await response.json();
        if (!result.share) throw Error('Sharing is unavailable for this result.');
        return result.share;
    }

    async shareReport(id: string, revision: string, signal: AbortSignal, staff = false): Promise<Blob> {
        const path = '/' + encodeURIComponent(id) + (staff ? '/report' : '/result/pdf');
        const response = await this.request(path + '?revision=' + encodeURIComponent(revision),undefined,signal,staff);
        return response.blob();
    }

    async blob(path: string, signal: AbortSignal): Promise<Blob> {
        return (await this.request(path, undefined, signal)).blob();
    }

    private async json<T>(path: string, body?: object, signal?: AbortSignal): Promise<T> {
        return (await this.request(path, body, signal)).json();
    }

    private async request(path: string, body?: object, signal?: AbortSignal, staff = false): Promise<Response> {
        const user = this.auth.currentUser;
        if (!user || user.isAnonymous) throw Error('Sign in to your GTOP account to continue.');
        const token = await user.getIdToken();
        if (this.auth.currentUser !== user) throw Error('Your account changed. Reopen your answer sheets.');
        const headers = new Headers({ Authorization: 'Bearer ' + token });
        if (body) headers.set('Content-Type', 'application/json');
        let response: Response;
        try {
            response = await fetch(assistantGatewayUrl + (staff ? '/staff' : '') + '/student-submissions' + path, {
                method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined,
                signal, cache: 'no-store', credentials: 'omit',
            });
        } catch (error) {
            if (signal?.aborted) throw error;
            throw Error('Could not reach GT Papers. Check your connection and try again.');
        }
        if (this.auth.currentUser !== user) throw Error('Your account changed. Reopen your answer sheets.');
        if (!response.ok) {
            const message = (await response.json().catch(() => null))?.error?.message;
            throw Object.assign(Error(typeof message === 'string' && message ? message : 'GT Papers could not complete the request. Try again.'), {status:response.status});
        }
        return response;
    }
}
