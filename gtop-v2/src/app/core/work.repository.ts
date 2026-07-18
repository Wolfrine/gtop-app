import { Injectable } from '@angular/core';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { FirebaseClient } from './firebase';
import { Actor, WorkItem, WorkStatus, WorkUpdate, asDate, normalizeWorkItem } from './models';

@Injectable({ providedIn: 'root' })
export class WorkRepository {
  constructor(private readonly firebase: FirebaseClient) {}

  observe(callback: (items: WorkItem[]) => void, onError: (error: Error) => void): () => void {
    return onSnapshot(
      query(collection(this.firebase.firestore, 'actionPlans'), limit(200)),
      (snapshot) =>
        callback(
          snapshot.docs
            .map((item) => normalizeWorkItem(item.id, item.data()))
            .filter((item) => !item.archived)
            .sort(
              (a, b) =>
                (asDate(b.updatedAt ?? b.createdAt)?.getTime() ?? 0) -
                (asDate(a.updatedAt ?? a.createdAt)?.getTime() ?? 0),
            ),
        ),
      (error) => onError(error),
    );
  }

  async updates(itemId: string): Promise<WorkUpdate[]> {
    const snapshot = await getDocs(
      query(
        collection(this.firebase.firestore, `actionPlans/${itemId}/updates`),
        orderBy('createdAt', 'desc'),
        limit(100),
      ),
    );
    return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as WorkUpdate);
  }

  async create(
    input: Partial<WorkItem> &
      Pick<WorkItem, 'title' | 'description' | 'area' | 'owner' | 'status' | 'priority'>,
    actor: Actor,
  ): Promise<string> {
    const created = await addDoc(collection(this.firebase.firestore, 'actionPlans'), {
      ...input,
      labels: input.labels ?? [],
      dependencies: input.dependencies ?? [],
      acceptanceCriteria: input.acceptanceCriteria ?? [],
      sourceReferences: input.sourceReferences ?? [],
      archived: false,
      createdBy: actor,
      updatedBy: actor,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await this.addUpdate(created.id, { message: 'Activity created.', type: 'progress', actor });
    return created.id;
  }

  async update(
    itemId: string,
    changes: Partial<WorkItem>,
    actor: Actor,
    message?: string,
  ): Promise<void> {
    const safe = { ...changes } as Record<string, unknown>;
    delete safe['id'];
    const ref = doc(this.firebase.firestore, 'actionPlans', itemId);
    await updateDoc(ref, { ...safe, updatedBy: actor, updatedAt: serverTimestamp() });
    if (message) await this.addUpdate(itemId, { message, type: 'progress', actor });
  }

  async transition(
    item: WorkItem,
    status: WorkStatus,
    actor: Actor,
    message: string,
  ): Promise<void> {
    await updateDoc(doc(this.firebase.firestore, 'actionPlans', item.id), {
      status,
      latestUpdate: message,
      ...(status !== 'blocked' ? { blockedReason: '' } : {}),
      updatedBy: actor,
      updatedAt: serverTimestamp(),
    });
    await this.addUpdate(item.id, {
      message,
      type:
        status === 'blocked'
          ? 'blocker'
          : status === 'review'
            ? 'review'
            : status === 'done'
              ? 'completion'
              : 'status',
      fromStatus: item.status,
      toStatus: status,
      actor,
    });
  }

  async addUpdate(itemId: string, update: Omit<WorkUpdate, 'id' | 'createdAt'>): Promise<void> {
    await addDoc(collection(this.firebase.firestore, `actionPlans/${itemId}/updates`), {
      ...update,
      createdAt: serverTimestamp(),
    });
  }

  async seedV2(actor: Actor): Promise<void> {
    const current = await getDocs(
      query(collection(this.firebase.firestore, 'actionPlans'), limit(100)),
    );
    if (current.docs.some((entry) => entry.data()['milestone'] === 'GTOP v2')) return;
    const work = [
      [
        'V2 foundation and design system',
        'Build the Angular 21 foundation, authentication state, repositories, responsive shells, and premium academic design system.',
        'Platform foundation',
      ],
      [
        'V2 learner practice loop',
        'Deliver profile setup, practice selection, quiz, summary, reporting, retry, and question feedback.',
        'Learner experience',
      ],
      [
        'V2 administration workspace',
        'Deliver question, syllabus, user, report, live-session, log, and action-plan administration.',
        'Admin operations',
      ],
      [
        'V2 live practice',
        'Deliver live quiz and quiz-run creation, lobby, participation, control, and summary experiences.',
        'Live practice',
      ],
      [
        'Firestore MCP and agent workflow',
        'Expose audited action-plan and full Firestore tools, then require agents to coordinate through them.',
        'Agent operations',
      ],
      [
        'V2 UAT validation and release',
        'Complete automated validation, owner review, rollback rehearsal, and controlled production cutover.',
        'Release',
      ],
    ];
    for (const [title, description, area] of work) {
      await this.create(
        {
          title,
          description,
          area,
          owner: 'GTOP product and engineering agents',
          status: 'in-progress',
          priority: 'high',
          milestone: 'GTOP v2',
          labels: ['v2'],
          dependencies: [],
          acceptanceCriteria: [
            'Implementation is complete.',
            'Relevant automated checks pass.',
            'Evidence is attached for owner review.',
          ],
          sourceReferences: ['feature/gtop-v2'],
        },
        actor,
      );
    }
  }
}
