import { Bytes, DocumentData, Firestore, GeoPoint, Timestamp, doc, getDocFromServer } from '@angular/fire/firestore';
import { User } from '@angular/fire/auth';
import { useEmulators } from '../firebase-environment';

export interface QuizQuestionFilter {
    board: string;
    standard: string;
    subjects: string[];
    chapters: string[];
}

interface FirestoreValue {
    nullValue?: null;
    booleanValue?: boolean;
    integerValue?: string;
    doubleValue?: number | string;
    stringValue?: string;
    timestampValue?: string;
    referenceValue?: string;
    bytesValue?: string;
    geoPointValue?: { latitude?: number; longitude?: number };
    arrayValue?: { values?: FirestoreValue[] };
    mapValue?: { fields?: Record<string, FirestoreValue> };
}

interface RankBucket {
    filter: QuizQuestionFilter;
    first?: string;
    after?: string;
    capacity: number;
}

export interface QuizRankScope {
    population: number;
    buckets: RankBucket[];
}

const maxPartitions = 32;
const maxReads = 768;
const parallelQueries = 6;

export class QuizRankReadError extends Error {
    constructor() { super('The selected questions could not be loaded. Please try starting the quiz again.'); }
}

export function quizRankScope(filter: QuizQuestionFilter, ids: string[]): QuizRankScope {
    const width = Math.max(1, Math.ceil(ids.length / maxPartitions));
    // Boundary ordering is unambiguous for ordinary ASCII auto IDs. Open
    // outer ranges and the intervening ranges still include every legacy ID.
    const anchors = ids.filter(id => /^[A-Za-z0-9]{20}$/.test(id)).sort()
        .filter((_, index) => index > 0 && index % width === 0);
    const buckets = [undefined, ...anchors].map((first, index) => ({ filter, first, after: anchors[index], capacity: width * 2 }));
    return { population: ids.length, buckets };
}

function fieldsOf(firestore: Firestore, fields?: Record<string, FirestoreValue>): DocumentData {
    return Object.fromEntries(Object.entries(fields ?? {}).map(([name, value]) => [name, decode(firestore, value)]));
}

function decode(firestore: Firestore, value: FirestoreValue): unknown {
    if ('nullValue' in value) return null;
    if ('booleanValue' in value) return value.booleanValue;
    if ('integerValue' in value) return Number(value.integerValue);
    if ('doubleValue' in value) return Number(value.doubleValue);
    if ('stringValue' in value) return value.stringValue;
    if (value.timestampValue) {
        const date = value.timestampValue;
        const seconds = Math.floor(Date.parse(date) / 1000);
        const nanos = Number((date.match(/\.(\d+)Z$/)?.[1] ?? '').padEnd(9, '0'));
        return new Timestamp(seconds, nanos);
    }
    if (value.referenceValue) return doc(firestore, value.referenceValue.slice(value.referenceValue.indexOf('/documents/') + 11));
    if (value.bytesValue !== undefined) return Bytes.fromBase64String(value.bytesValue);
    if (value.geoPointValue) return new GeoPoint(value.geoPointValue.latitude ?? 0, value.geoPointValue.longitude ?? 0);
    if (value.arrayValue) return (value.arrayValue.values ?? []).map(item => decode(firestore, item));
    if (value.mapValue) return fieldsOf(firestore, value.mapValue.fields);
    throw Error('Unsupported question field');
}

// Rejection avoids modulo bias for populations that do not divide 2^32.
function uniformBelow(max: number): number {
    const word = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / max) * max;
    do { crypto.getRandomValues(word); } while (word[0] >= limit);
    return word[0] % max;
}

async function mapPages<T, U>(items: readonly T[], read: (item: T) => Promise<U>): Promise<U[]> {
    const results: U[] = [];
    for (let offset = 0; offset < items.length; offset += parallelQueries) {
        results.push(...await Promise.all(items.slice(offset, offset + parallelQueries).map(read)));
    }
    return results;
}

export async function sampleQuizRanks(
    firestore: Firestore, user: User, scopes: QuizRankScope[], amount: number,
): Promise<(DocumentData & { id: string })[] | null> {
    const previousSize = scopes.reduce((total, scope) => total + scope.population, 0);
    const buckets = scopes.flatMap(scope => scope.buckets);
    if (previousSize < 256 || !Number.isInteger(amount) || amount < 1 || amount > 24 || buckets.length > 64 ||
        !navigator.onLine || buckets.length + amount * (1 + Math.max(...buckets.map(bucket => bucket.capacity))) >= Math.min(previousSize, maxReads)) return null;

    const project = firestore.app.options.projectId;
    const database = `projects/${project}/databases/(default)/documents`;
    const host = useEmulators ? 'http://127.0.0.1:8080' : 'https://firestore.googleapis.com';
    const token = await user.getIdToken();
    const signal = AbortSignal.timeout(8000);
    let countQueries = 0;
    let countedEntries = 0;
    let questionReads = 0;
    let cacheReads = 0;
    let hydrated = 0;
    let drawn = false;
    async function request<T>(method: string, body: object): Promise<T> {
        const response = await fetch(`${host}/v1/${database}:${method}`, {
            method: 'POST', signal, cache: 'no-store',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        });
        if (!response.ok) throw Error(`Rank query unavailable (${response.status})`);
        return response.json();
    }
    function structuredQuery(bucket: RankBucket, limit?: number) {
        const field = (fieldPath: string) => ({ fieldPath });
        const equal = (name: string, value: string) => ({ fieldFilter: { field: field(name), op: 'EQUAL', value: { stringValue: value } } });
        const choices = (name: string, values: string[]) => ({ fieldFilter: {
            field: field(name), op: 'IN', value: { arrayValue: { values: values.map(stringValue => ({ stringValue })) } }
        } });
        const { board, standard, subjects, chapters } = bucket.filter;
        const filters = [equal('board', board), equal('standard', standard)];
        return {
            from: [{ collectionId: 'questions' }],
            where: { compositeFilter: { op: 'AND', filters: [
                ...filters, ...(subjects.length === 1 ? [equal('subject', subjects[0])] : subjects.length ? [choices('subject', subjects)] : []),
                ...(chapters.length === 1 ? [equal('chapter', chapters[0])] : chapters.length ? [choices('chapter', chapters)] : [])
            ] } },
            orderBy: [{ field: field('__name__'), direction: 'ASCENDING' }],
            ...(bucket.first ? { startAt: { before: true, values: [{ referenceValue: `${database}/questions/${bucket.first}` }] } } : {}),
            ...(bucket.after ? { endAt: { before: true, values: [{ referenceValue: `${database}/questions/${bucket.after}` }] } } : {}),
            ...(limit !== undefined ? { limit } : {})
        };
    }
    type CountLine = { readTime?: string; result?: { aggregateFields: { count?: { integerValue?: string } } } };
    async function count(bucket: RankBucket, readTime?: string) {
        countQueries++;
        const entries = await request<CountLine[]>('runAggregationQuery', {
            structuredAggregationQuery: { structuredQuery: structuredQuery(bucket),
                aggregations: [{ count: { upTo: String(bucket.capacity + 1) }, alias: 'count' }] },
            ...(readTime ? { readTime } : {})
        });
        const row = entries.find(entry => entry.result);
        const size = Number(row?.result?.aggregateFields.count?.integerValue);
        if (!Number.isSafeInteger(size) || size < 0 || !row?.readTime) throw Error('Invalid question count');
        countedEntries += size;
        return { size, readTime: row.readTime };
    }
    try {
        const first = await count(buckets[0]);
        const sizes = [first.size, ...await mapPages(buckets.slice(1), async bucket => (await count(bucket, first.readTime)).size)];
        const population = sizes.reduce((sum, size) => sum + size, 0);
        const wanted = Math.min(amount, population);
        // Admission uses every current range and happens before any draw.
        if (sizes.some((size, i) => size > buckets[i].capacity) ||
            countQueries + wanted * (1 + Math.max(...sizes)) >= Math.min(population, maxReads)) return null;

        const ranks = new Set<number>();
        drawn = true;
        for (let end = population - wanted; end < population; end++) {
            const pick = uniformBelow(end + 1);
            ranks.add(ranks.has(pick) ? end : pick);
        }
        let base = 0;
        const ordered = [...ranks].sort((a, b) => a - b);
        const selected = buckets.map((bucket, index) => {
            const locals = ordered.filter(rank => rank >= base && rank < base + sizes[index]).map(rank => rank - base);
            base += sizes[index];
            return { bucket, locals };
        }).filter(entry => entry.locals.length);
        const responses = await mapPages(selected, async ({ bucket, locals }) => {
            type QueryLine = { document?: { name: string; fields?: Record<string, FirestoreValue> } };
            const lines = await request<QueryLine[]>('runQuery', { structuredQuery: structuredQuery(bucket, locals.at(-1)! + 1), readTime: first.readTime });
            const rows = lines.flatMap(line => line.document ? [line.document] : []);
            questionReads += rows.length;
            return locals.map(rank => {
                const row = rows[rank];
                if (!row) throw Error('Question rank missing from snapshot');
                return { ...fieldsOf(firestore, row.fields), id: row.name.split('/').at(-1)! };
            });
        });
        const result = responses.flat();
        for (let i = result.length - 1; i > 0; i--) {
            const j = uniformBelow(i + 1);
            [result[i], result[j]] = [result[j], result[i]];
        }
        // REST returns the selected snapshot. Read the selected documents
        // through the SDK as well so later offline practice sees these IDs and edits.
        await mapPages(result, async item => {
            cacheReads++;
            try {
                if ((await getDocFromServer(doc(firestore, 'questions', item.id))).exists()) hydrated++;
            } catch {
                // A cache refresh must never discard a completed exact draw.
            }
        });
        return result;
    } catch {
        if (drawn) throw new QuizRankReadError();
        return null;
    } finally {
        console.debug('[firestore-read]', { scope: 'quiz-rank-snapshot', countQueries, countedEntries, questionReads, cacheReads, hydrated, writes: 0 });
    }
}
