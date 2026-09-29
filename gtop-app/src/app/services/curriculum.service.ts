import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Firestore, collection, doc, getDoc, getDocs, limit, query, runTransaction, serverTimestamp, startAfter, where, type DocumentData, type QueryDocumentSnapshot } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { curriculumKey, curriculumValidation, legacyDrafts, type CurriculumSeed, type CurriculumSubject, type LegacyChapter } from './curriculum.domain';

@Injectable({ providedIn: 'root' })
export class CurriculumService {
  constructor(private readonly firestore: Firestore, private readonly http: HttpClient, private readonly auth: AuthService) {}
  seed(): Promise<CurriculumSeed> { return firstValueFrom(this.http.get<CurriculumSeed>('assets/curriculum/catalogue.json')); }

  async requestImport(year: string, board: string, standard: string): Promise<void> {
    const actor = this.actor();
    const seed = await this.seed();
    const id = [year,board || 'all-boards',standard || 'all-standards'].map(encodeURIComponent).join('~');
    const ref = doc(this.firestore,'curriculumImports',id);
    await runTransaction(this.firestore,async transaction => {
      const snapshot = await transaction.get(ref);
      if (snapshot.exists() && snapshot.data()['status'] !== 'complete') return;
      transaction.set(ref,{id,academicYear:year,board,standard,status:'requested',source:'admin-syllabus-review',
        targetBoards:seed.boards.filter(item => !board || item.board === board).map(item => ({...item,standards:standard ? [standard] : item.standards})),
        instruction:'Discover the complete subject inventory and official current-year chapter/topic lists for the requested boards and standards. Write only reviewable curriculumSubjects drafts. Never approve versions or change active releases. Explicitly flag inaccessible sources, edition/cohort ambiguity and incomplete coverage.',
        createdBy:actor,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),completedSubjects:[],blockers:[]});
    });
  }
  imports(year: string): Promise<(DocumentData & {id:string})[]> { return this.documents('curriculumImports',year); }

  private async documents(path: string, year: string): Promise<(DocumentData & { id: string })[]> {
    const result: (DocumentData & { id: string })[] = [];
    let cursor: QueryDocumentSnapshot<DocumentData> | undefined;
    for (let page = 0; page < 40; page++) {
      const snapshot = await getDocs(query(collection(this.firestore, path), where('academicYear', '==', year),
        ...(cursor ? [startAfter(cursor)] : []), limit(250)));
      result.push(...snapshot.docs.map(item => ({ ...item.data(), id: item.id })));
      if (snapshot.size < 250) return result;
      cursor = snapshot.docs.at(-1);
    }
    throw new Error('The catalogue could not be loaded completely. Narrow the year and retry.');
  }
  async published(year: string): Promise<CurriculumSubject[]> {
    const releases = await this.documents('curriculumReleases', year);
    const versions: CurriculumSubject[] = [];
    // Bounded reads; do not trust a head whose referenced version has disappeared.
    for (let index = 0; index < releases.length; index += 12) {
      const group = await Promise.all(releases.slice(index, index + 12).map(async release => {
        const snapshot = await getDoc(doc(this.firestore, 'curriculumVersions', release['versionId']));
        if (!snapshot.exists()) throw new Error('A published syllabus version is unavailable. Ask an admin to review the release.');
        return { ...snapshot.data(), versionId: snapshot.id } as CurriculumSubject;
      }));
      versions.push(...group);
    }
    return versions;
  }
  async catalogue(year: string, legacy: LegacyChapter[]): Promise<{ subjects: CurriculumSubject[]; published: CurriculumSubject[]; seed: CurriculumSeed }> {
    const [seed, drafts, published] = await Promise.all([this.seed(), this.documents('curriculumSubjects', year), this.published(year)]);
    const combined = new Map(legacyDrafts(legacy, year).map(item => [item.id, item]));
    for (const item of seed.subjects.filter(item => item.academicYear === year)) combined.set(item.id || curriculumKey(item), { ...item, id: item.id || curriculumKey(item) });
    for (const item of published) combined.set(item.id, item);
    for (const item of drafts) combined.set(item.id, item as CurriculumSubject);
    return { seed, published, subjects: [...combined.values()].sort((a,b) => `${a.board}|${a.standard}|${a.subject}`.localeCompare(`${b.board}|${b.standard}|${b.subject}`, undefined, { numeric: true })) };
  }
  async save(value: CurriculumSubject): Promise<CurriculumSubject> {
    const actor = this.actor();
    if (value.id !== curriculumKey(value)) throw new Error('Create a new subject to change its identity.');
    if (new TextEncoder().encode(JSON.stringify(value)).length > 700_000) throw new Error('The syllabus is too large. Shorten source excerpts.');
    return runTransaction(this.firestore, async transaction => {
      const ref = doc(this.firestore, 'curriculumSubjects', value.id);
      const headRef = doc(this.firestore, 'curriculumReleases', value.id);
      const [snapshot, head] = await Promise.all([transaction.get(ref), transaction.get(headRef)]);
      const current = snapshot.exists() ? snapshot.data() : null;
      if ((current?.['revision'] ?? 0) !== value.revision) throw new Error('Another admin changed this subject. Refresh before saving.');
      const baseVersionId = head.data()?.['versionId'] ?? '';
      if (value.baseVersionId !== baseVersionId) throw new Error('A newer syllabus was approved. Refresh and compare it before editing.');
      const saved = { ...value, reviewStatus: 'draft' as const, revision: value.revision + 1, baseVersionId };
      // Approval metadata belongs to the immutable version, never an edited draft.
      delete saved.versionId; delete saved.approvedAt; delete saved.approvedBy;
      transaction.set(ref, { ...saved, updatedAt: serverTimestamp(), updatedBy: actor });
      return saved;
    });
  }
  async approve(value: CurriculumSubject): Promise<string> {
    const errors = curriculumValidation(value);
    if (errors.length) throw new Error(errors.join(' '));
    const actor = this.actor();
    const versionRef = doc(collection(this.firestore, 'curriculumVersions'));
    await runTransaction(this.firestore, async transaction => {
      const ref = doc(this.firestore, 'curriculumSubjects', value.id);
      const headRef = doc(this.firestore, 'curriculumReleases', value.id);
      const [snapshot, head] = await Promise.all([transaction.get(ref), transaction.get(headRef)]);
      if (!snapshot.exists() || snapshot.data()['revision'] !== value.revision || snapshot.data()['reviewStatus'] !== 'draft')
        throw new Error('This subject changed since preview. Refresh and review it again.');
      if ((head.data()?.['versionId'] ?? '') !== value.baseVersionId) throw new Error('A newer version was published. Refresh before approving.');
      const saved = snapshot.data() as CurriculumSubject;
      const latestErrors = curriculumValidation(saved);
      if (latestErrors.length) throw new Error(latestErrors.join(' '));
      const approved = { ...saved, reviewStatus: 'approved', versionId: versionRef.id, approvedBy: actor, approvedAt: serverTimestamp() };
      transaction.set(versionRef, approved);
      transaction.set(headRef, { id: value.id, academicYear: value.academicYear, board: value.board, standard: value.standard,
        subject: value.subject, versionId: versionRef.id, approvedBy: actor, approvedAt: serverTimestamp() });
      transaction.update(ref, { reviewStatus: 'approved', baseVersionId: versionRef.id, versionId: versionRef.id, revision: value.revision + 1,
        approvedBy: actor, approvedAt: serverTimestamp() });
    });
    return versionRef.id;
  }
  async history(scopeId: string): Promise<CurriculumSubject[]> {
    const snapshots = await getDocs(query(collection(this.firestore, 'curriculumVersions'), where('id', '==', scopeId)));
    return snapshots.docs.map(item => ({ ...item.data(), versionId: item.id }) as CurriculumSubject)
      .sort((a,b) => b.revision - a.revision);
  }
  private actor(): string {
    const profile = this.auth.profile();
    if (!profile?.uid || profile.role !== 'admin') throw new Error('Sign in as an admin to review syllabi.');
    return profile.uid;
  }
}
