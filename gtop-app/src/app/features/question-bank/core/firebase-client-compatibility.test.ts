import '@angular/compiler';
import 'zone.js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';
import { FirebaseApp, initializeApp, deleteApp, provideFirebaseApp } from '@angular/fire/app';
import { Auth, getAuth, provideAuth } from '@angular/fire/auth';
import { SyllabusService } from '../../../services/syllabus.service';
import { FirestoreReadService } from '../../../services/firestore-read.service';
import { Firestore, initializeFirestore, provideFirestore, terminate } from '@angular/fire/firestore';
import { FirebaseClient } from './firebase';
import { QuestionPaperRepository } from './question-paper.repository';
import { QuestionReviewRepository } from './question-review.repository';

// Keep real SDK reference/query construction. Stub only network reads so a
// mixed Firebase SDK cannot hide behind an all-mocked repository test.
vi.mock('@angular/fire/firestore', async importOriginal => {
  const actual = await importOriginal<typeof import('@angular/fire/firestore')>();
  return { ...actual,
    getDocs: vi.fn(async () => ({ docs: [], size: 0, empty: true })),
    getDocsFromServer: vi.fn(async () => ({ docs: [], size: 0, empty: true })),
    onSnapshot: vi.fn((_query, _options, next) => { queueMicrotask(() => next({docs:[],size:0,empty:true,metadata:{fromCache:false,hasPendingWrites:false}}));return () => {}; }),
    getCountFromServer: vi.fn(async () => ({ data: () => ({ count: 0 }) })),
  };
});

describe('current application Firebase compatibility', () => {
  beforeAll(() => TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting()));
  afterAll(() => TestBed.resetTestEnvironment());
  it('builds paper and review queries using the existing AngularFire client', async () => {
    TestBed.configureTestingModule({ providers: [
      provideFirebaseApp(() => initializeApp({ projectId: 'demo-client-compatibility', apiKey: 'demo' })),
      provideFirestore(() => initializeFirestore(inject(FirebaseApp), {})),
      provideAuth(() => getAuth(inject(FirebaseApp))),
    ] });
    const firestore = TestBed.inject(Firestore);
    const app = TestBed.inject(FirebaseApp);
    const reads = new FirestoreReadService(TestBed.inject(Auth));
    const syllabus = new SyllabusService(firestore,reads);
    try {
      const client = new FirebaseClient(firestore);
      const papers = new QuestionPaperRepository(client,syllabus,reads);
      await expect(papers.syllabus()).resolves.toEqual([]);
      await expect(papers.templates()).resolves.toEqual([]);
      await expect(papers.recentDrafts()).resolves.toEqual([]);
      await expect(papers.approvedQuestions('CBSE', '10', [{ subject: 'Science', chapter: 'Motion' }])).resolves.toEqual({ questions: [], truncatedScopes: [], excludedCount: 0 });
      await expect(new QuestionReviewRepository(client).pending()).resolves.toMatchObject({ items: [], truncated: false });
    } finally {
      syllabus.ngOnDestroy();reads.ngOnDestroy();
      await terminate(firestore);
      await deleteApp(app);
    }
  });
});
