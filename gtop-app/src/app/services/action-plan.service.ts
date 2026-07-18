import { Injectable } from '@angular/core';
import {
  Firestore,
  addDoc,
  collection,
  collectionData,
  doc,
  serverTimestamp,
  updateDoc,
} from '@angular/fire/firestore';
import { Observable, map } from 'rxjs';

export type ActionPlanStatus = 'planned' | 'in-progress' | 'blocked' | 'review' | 'done';
export type ActionPlanPriority = 'critical' | 'high' | 'medium' | 'low';

export interface ActionPlanActor {
  uid?: string | null;
  name: string;
  email?: string | null;
}

export interface ActionPlanItem {
  id?: string;
  title: string;
  description: string;
  area: string;
  owner: string;
  status: ActionPlanStatus;
  priority: ActionPlanPriority;
  dueDate?: string | null;
  acceptanceCriteria?: string;
  latestUpdate?: string;
  sourceReference?: string;
  archived?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: ActionPlanActor;
  updatedBy?: ActionPlanActor;
}

export type ActionPlanDraft = Omit<
  ActionPlanItem,
  'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'archived'
>;

@Injectable({ providedIn: 'root' })
export class ActionPlanService {
  private readonly plansCollection = collection(this.firestore, 'actionPlans');

  constructor(private firestore: Firestore) {}

  observePlans(): Observable<ActionPlanItem[]> {
    return collectionData(this.plansCollection, { idField: 'id' }).pipe(
      map(items => (items as ActionPlanItem[])
        .filter(item => !item.archived)
        .sort((left, right) => this.timestampMillis(right.updatedAt) - this.timestampMillis(left.updatedAt)))
    );
  }

  async createPlan(draft: ActionPlanDraft, actor: ActionPlanActor): Promise<void> {
    await addDoc(this.plansCollection, {
      ...draft,
      archived: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: actor,
      updatedBy: actor,
    });
  }

  async updatePlan(id: string, changes: Partial<ActionPlanDraft>, actor: ActionPlanActor): Promise<void> {
    const planRef = doc(this.firestore, `actionPlans/${id}`);
    await updateDoc(planRef, {
      ...changes,
      updatedAt: serverTimestamp(),
      updatedBy: actor,
    });
  }

  async archivePlan(id: string, actor: ActionPlanActor): Promise<void> {
    const planRef = doc(this.firestore, `actionPlans/${id}`);
    await updateDoc(planRef, {
      archived: true,
      updatedAt: serverTimestamp(),
      updatedBy: actor,
    });
  }

  private timestampMillis(value: any): number {
    if (value?.toMillis) {
      return value.toMillis();
    }

    if (value instanceof Date) {
      return value.getTime();
    }

    return 0;
  }
}
