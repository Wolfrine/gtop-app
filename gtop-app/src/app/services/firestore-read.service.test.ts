import '@angular/compiler';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BehaviorSubject } from 'rxjs';
import { Auth } from '@angular/fire/auth';
import { Query, DocumentData, QuerySnapshot } from '@angular/fire/firestore';
import { FirestoreReadService } from './firestore-read.service';

const state = vi.hoisted(() => ({ identity: null as any, listeners: [] as any[] }));
vi.mock('@angular/fire/auth', () => ({ Auth: class {}, authState: () => state.identity }));
vi.mock('@angular/fire/firestore', () => ({
  queryEqual: (a: unknown,b: unknown) => JSON.stringify(a) === JSON.stringify(b),
  onSnapshot: vi.fn((query, options, next, error) => {
    const listener = { query, options, next, error, stop: vi.fn() };
    state.listeners.push(listener);return listener.stop;
  }),
}));

const request = (path='bank') => ({path}) as unknown as Query<DocumentData>;
const snapshot = (name:string,fromCache:boolean) => ({docs:[{id:name}],metadata:{fromCache}}) as unknown as QuerySnapshot<DocumentData>;
describe('shared persistent Firestore reads', () => {
  let reads:FirestoreReadService;
  beforeEach(() => {vi.useFakeTimers();state.identity=new BehaviorSubject({uid:'admin-one'});state.listeners=[];reads=new FirestoreReadService({} as Auth);});
  afterEach(() => {reads.ngOnDestroy();vi.useRealTimers();});
  it('shares a query, renders the cache, then replaces it with server updates', () => {
    const first:unknown[]=[];const second:unknown[]=[];
    const a=reads.watch(request()).subscribe(value=>first.push(value));
    const b=reads.watch(request()).subscribe(value=>second.push(value));
    expect(state.listeners).toHaveLength(1);
    expect(state.listeners[0].options.includeMetadataChanges).toBe(true);
    const cached=snapshot('cached',true);const live=snapshot('server-edit',false);
    state.listeners[0].next(cached);expect(reads.checking()).toBe(true);
    state.listeners[0].next(live);expect(reads.checking()).toBe(false);
    expect(first).toEqual([cached,live]);expect(second).toEqual(first);
    a.unsubscribe();b.unsubscribe();
  });
  it('reuses warm navigation and releases the listener after its last reader leaves', () => {
    const a=reads.watch(request()).subscribe();state.listeners[0].next(snapshot('bank',false));a.unsubscribe();
    vi.advanceTimersByTime(14_000);
    const seen:unknown[]=[];const b=reads.watch(request()).subscribe(value=>seen.push(value));
    expect(state.listeners).toHaveLength(1);expect(seen).toHaveLength(1);
    vi.advanceTimersByTime(2_000);expect(state.listeners[0].stop).not.toHaveBeenCalled();
    b.unsubscribe();vi.advanceTimersByTime(15_000);expect(state.listeners[0].stop).toHaveBeenCalledOnce();
    reads.watch(request()).subscribe();expect(state.listeners).toHaveLength(2);
  });
  it('does not replay another signed-in account’s memory snapshot', () => {
    const seen:unknown[]=[];const sub=reads.watch(request()).subscribe(value=>seen.push(value));
    state.listeners[0].next(snapshot('admin-one-data',false));seen.length=0;
    state.identity.next({uid:'admin-two'});
    expect(state.listeners[0].stop).toHaveBeenCalledOnce();expect(state.listeners).toHaveLength(2);
    expect(seen).toEqual([]);expect(reads.checking()).toBe(true);
    state.listeners[1].next(snapshot('admin-two-data',false));expect(seen).toHaveLength(1);
    sub.unsubscribe();
  });
  it('removes failed listeners so retry performs a new authorized read', () => {
    const errors:unknown[]=[];reads.watch(request()).subscribe({error:e=>errors.push(e)});
    state.listeners[0].error(new Error('permission-denied'));
    expect(errors).toHaveLength(1);expect(state.listeners[0].stop).toHaveBeenCalledOnce();
    reads.watch(request()).subscribe();expect(state.listeners).toHaveLength(2);
  });
  it('bounds listeners retained during rapid navigation', () => {
    for(let i=0;i<14;i++)reads.watch(request(String(i))).subscribe().unsubscribe();
    expect(state.listeners.filter(listener=>listener.stop.mock.calls.length===0)).toHaveLength(12);
    vi.advanceTimersByTime(15_000);
    expect(state.listeners.every(listener=>listener.stop.mock.calls.length===1)).toBe(true);
  });
});
