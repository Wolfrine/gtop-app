import { Injectable, inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';

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
    rubric: { title: string; marks: number };
    sheet: {
        grade: {
            awarded: number;
            max: number;
            answers: { number: number; awarded: number | null; max: number; explanation: string; counted?: boolean }[];
        };
    };
}

export const submissionStatusLabels: Record<SubmissionStatus, string> = {
    draft: 'Draft', submitted: 'Submitted', needs_rescan: 'Rescan needed', checking: 'Checking', released: 'Results ready',
};

function gatewayOrigin(): string {
    if (['localhost', '127.0.0.1'].includes(location.hostname)) {
        try {
            if (new URLSearchParams(location.search).has('emulator') || sessionStorage.getItem('gtop.local-emulators') === '1') {
                return 'http://127.0.0.1:5201/gtop-app/us-central1/gtopAssistantGateway';
            }
        } catch { /* An unavailable browser store does not affect the production gateway. */ }
    }
    return 'https://us-central1-gtop-app.cloudfunctions.net/gtopAssistantGateway';
}

@Injectable({ providedIn: 'root' })
export class StudentSubmissionsService {
    private readonly auth = inject(Auth);
    preview(signal: AbortSignal): Promise<{ submissions: StudentSubmission[] }> {
        return this.json('?preview=1', undefined, signal);
    }

    list(cursor?: string, signal?: AbortSignal): Promise<SubmissionPage> {
        return this.json(cursor ? '?cursor=' + encodeURIComponent(cursor) : '', undefined, signal);
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

    async blob(path: string, signal: AbortSignal): Promise<Blob> {
        return (await this.request(path, undefined, signal)).blob();
    }

    private async json<T>(path: string, body?: object, signal?: AbortSignal): Promise<T> {
        return (await this.request(path, body, signal)).json();
    }

    private async request(path: string, body?: object, signal?: AbortSignal): Promise<Response> {
        const user = this.auth.currentUser;
        if (!user || user.isAnonymous) throw Error('Sign in to your GTOP account to continue.');
        const token = await user.getIdToken();
        if (this.auth.currentUser !== user) throw Error('Your account changed. Reopen your answer sheets.');
        const headers = new Headers({ Authorization: 'Bearer ' + token });
        if (body) headers.set('Content-Type', 'application/json');
        let response: Response;
        try {
            response = await fetch(gatewayOrigin() + '/student-submissions' + path, {
                method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined,
                signal, cache: 'no-store', credentials: 'omit',
            });
        } catch (error) {
            if (signal?.aborted) throw error;
            throw Error('Could not reach GT Papers. Check your connection and try again.');
        }
        if (!response.ok) {
            const message = (await response.json().catch(() => null))?.error?.message;
            throw Error(typeof message === 'string' && message ? message : 'GT Papers could not complete the request. Try again.');
        }
        return response;
    }
}
