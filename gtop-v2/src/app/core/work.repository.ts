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
    const existingTitles = new Set(
      current.docs.map((entry) => String(entry.data()['title'] ?? '')),
    );
    const work = [
      [
        'V2 admin shell continuity',
        'Keep administrators inside the admin shell throughout learner-mode practice, review, reports, live sessions, and quiz runs.',
        'Admin experience',
      ],
      [
        'V2 dashboard metrics and presence',
        'Show isolated Firestore metrics and live Realtime Database presence without all-or-nothing failures.',
        'Admin observability',
      ],
      [
        'V2 Action Plan browser access',
        'Validate signed-in admin browser access, actionable errors, rules drift, and reliable work updates.',
        'Agent operations',
      ],
      [
        'V2 PWA and offline learning',
        'Restore installability, branded icons, safe updates, multi-tab persistence, and explicit offline boundaries.',
        'Platform foundation',
      ],
      [
        'V2 authentication and public metadata',
        'Restore One Tap, canonical and social metadata, production analytics, and application version awareness.',
        'Platform foundation',
      ],
      [
        'V2 legacy entry contracts',
        'Preserve functioning v1 routes, query parameters, Hub return paths, and historical review links.',
        'Compatibility',
      ],
      [
        'V2 content parity',
        'Complete question paging/import, syllabus preview, flags, user filters, reports, and audit evidence.',
        'Admin operations',
      ],
      [
        'V2 live-session correctness',
        'Validate scheduling, open-room queries, join behavior, reconnect handling, indexes, results, and deterministic ranking.',
        'Live practice',
      ],
      [
        'V2 Theme Lab and motion',
        'Complete five-theme comparison, four viewports, representative controls, publishing metadata, and reduced motion.',
        'Experience',
      ],
      [
        'V2 mobile shell and navigation',
        'Deliver learner bottom navigation, grouped admin drawer, measured banner offsets, immersive sessions, safe areas, and accessible overlay behavior.',
        'Mobile experience',
      ],
      [
        'V2 mobile learning journeys',
        'Verify practice, quiz, review, reports, live sessions, reconnect behavior, and shell return paths from 320px through tablet layouts.',
        'Mobile experience',
      ],
      [
        'V2 mobile admin operations',
        'Deliver phone-safe users, content, Action Plan, diagnostics, reporting, live control, and Theme Lab workflows without hidden actions.',
        'Mobile administration',
      ],
      [
        'V2 device verification',
        'Add compact phone, Android, iPhone WebKit, landscape, tablet, PWA, keyboard, overlap, touch-target, accessibility, and visual evidence.',
        'Release',
      ],
      [
        'V2 release evidence',
        'Replace aspirational parity claims with runnable authenticated, emulator, PWA, accessibility, and visual evidence.',
        'Release',
      ],
    ];
    for (const [title, description, area] of work) {
      if (existingTitles.has(title)) continue;
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
