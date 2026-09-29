import { Injectable, OnDestroy, signal } from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
import { DocumentData, Query, QuerySnapshot, onSnapshot, queryEqual } from '@angular/fire/firestore';
import { EMPTY, Observable, ReplaySubject, Subject, distinctUntilChanged, map, shareReplay, switchMap, takeUntil, tap } from 'rxjs';

interface ReadEntry {
  query: Query<DocumentData>;
  uid: string;
  subject: ReplaySubject<QuerySnapshot<DocumentData>>;
  users: number;
  stop: () => void;
  timer?: ReturnType<typeof setTimeout>;
  closed: boolean;
  fromCache: boolean;
}

// Firestore owns persistence, synchronization and write acknowledgements. This
// only shares identical live queries between Angular consumers/navigation.
@Injectable({ providedIn: 'root' })
export class FirestoreReadService implements OnDestroy {
  private readonly entries: ReadEntry[] = [];
  readonly checking = signal(false);
  private readonly identity$;
  private readonly destroyed=new Subject<void>();
  constructor(auth: Auth) {
    this.identity$ = authState(auth).pipe(
      map(user => user?.uid ?? ''), distinctUntilChanged(),
      tap(uid => this.entries.slice().filter(entry => entry.uid !== uid).forEach(entry => this.close(entry))),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  watch(request: Query<DocumentData>): Observable<QuerySnapshot<DocumentData>> {
    // All shared catalogue/module queries require a signed-in user. Keep the
    // auth subscription alive across logout without starting a denied listener.
    return this.identity$.pipe(switchMap(uid => uid ? new Observable<QuerySnapshot<DocumentData>>(subscriber => {
      let entry = this.entries.find(item => item.uid === uid && queryEqual(item.query, request));
      const created = !entry;
      if (!entry) {
        entry = { query: request, uid, subject: new ReplaySubject(1), users: 0, stop: () => {}, closed: false, fromCache: true };
        this.entries.push(entry);
      }
      const current = entry;
      if (current.timer) clearTimeout(current.timer);
      current.users++;
      this.updateStatus();
      const subscription = current.subject.subscribe(subscriber);
      if (created) {
        const stop = onSnapshot(request, { includeMetadataChanges: true }, snapshot => {
          current.fromCache = snapshot.metadata.fromCache;
          this.updateStatus();
          current.subject.next(snapshot);
        }, error => {
          current.subject.error(error);
          this.close(current);
        });
        if (current.closed) stop(); else current.stop = stop;
      }
      return () => {
        subscription.unsubscribe();
        current.users--;
        this.updateStatus();
        if (!current.users && !current.closed) {
          current.timer = setTimeout(() => this.close(current), 15_000);
          // Fast navigation must not retain an unbounded number of listeners.
          const idle = this.entries.filter(item => !item.users && !item.closed);
          idle.slice(0, Math.max(0, idle.length - 12)).forEach(item => this.close(item));
        }
      };
    }) : EMPTY),takeUntil(this.destroyed));
  }

  ngOnDestroy(): void {this.destroyed.next();this.destroyed.complete();this.entries.slice().forEach(entry => this.close(entry)); }
  private close(entry: ReadEntry): void {
    if (entry.closed) return;
    entry.closed = true;
    if (entry.timer) clearTimeout(entry.timer);
    entry.stop();
    this.entries.splice(this.entries.indexOf(entry), 1);
    this.updateStatus();
    entry.subject.complete();
  }
  private updateStatus(): void { this.checking.set(this.entries.some(entry => entry.users > 0 && entry.fromCache)); }
}
