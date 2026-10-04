/** Display order is separate from the bank's canonical indices (also used by live answers). */
export function canonicalIndex(question: any, index: number | null | undefined): number | null {
    if (!Number.isInteger(index) || Number(index) < 0) return null;
    return question.optionOrder?.[Number(index)] ?? Number(index);
}

export function validOrder(order: unknown, length: number): order is number[] {
    return Array.isArray(order) && order.length === length &&
        new Set(order).size === length && order.every(i => Number.isInteger(i) && i >= 0 && i < length);
}

function relabel(text: any, order: number[]): any {
    if (typeof text !== 'string') return text;
    return text.replace(/\b(option\s+)([A-Z])\b/gi, (match, prefix, letter) => {
        const display = order.indexOf(letter.toUpperCase().charCodeAt(0) - 65);
        return display < 0 ? match : `${prefix}${String.fromCharCode(65 + display)}`;
    });
}

function hasUnhandledOptionReference(text: unknown): boolean {
    if (typeof text !== 'string') return false;
    // Only explicit "Option A" is safely relabelled. Preserve the bank's order
    // for bare/quoted labels and answer/choice references with ambiguous wording.
    const unhandled = text.replace(/\boption\s+[A-Z]\b/gi, 'option');
    return /^\s*[A-D]\s*$/i.test(unhandled) ||
        /\b[A-D]\s*(?:[).:;,!?"'\u2019\u201d\u2013\u2014]|(?:and|or|&)\s*[A-D])/i.test(unhandled) ||
        /\b(?:answer|choice|alternative|response|label|letter)\s*(?:(?:is|was|would\s+be|should\s+be)\s*|[:=]\s*)?["'(\s]*[A-D]\b/i.test(unhandled) ||
        /\b[A-D]\s+(?:is|was)\s+(?:correct|incorrect|right|wrong|true|false)\b/i.test(unhandled);
}

export function canonicalQuestion(question: any): any {
    if (!validOrder(question.optionOrder, question.options?.length || 0)) return { ...question };
    const options: any[] = [];
    question.optionOrder.forEach((canonical: number, display: number) => options[canonical] = question.options[display]);
    const inverse = options.map((_, canonical) => question.optionOrder.indexOf(canonical));
    const { optionOrder, ...rest } = question;
    return {
        ...rest, options,
        question: relabel(question.question, inverse),
        solutions: Array.isArray(question.solutions) ? question.solutions.map((s: any) => relabel(s, inverse)) : relabel(question.solutions, inverse),
        selectedIndex: canonicalIndex(question, question.selectedIndex),
        correctIndex: canonicalIndex(question, question.correctIndex)
    };
}

export function restorePresentation(question: any, order: unknown, selectedIndex: number | null, correctIndex: number): any {
    const canonical = canonicalQuestion(question);
    const options = canonical.options || [];
    if (!validOrder(order, options.length)) return { ...canonical, selectedIndex, correctIndex };
    return {
        ...canonical,
        options: order.map(i => options[i]), optionOrder: [...order],
        question: relabel(canonical.question, order),
        // Preserve every paragraph. Array length does not establish an option-specific schema.
        solutions: Array.isArray(canonical.solutions) ? canonical.solutions.map((s: any) => relabel(s, order)) : relabel(canonical.solutions, order),
        selectedIndex: selectedIndex == null || selectedIndex < 0 ? null : order.indexOf(selectedIndex),
        correctIndex: order.indexOf(correctIndex)
    };
}

export function presentQuestion(question: any, random = Math.random): any {
    const canonical = canonicalQuestion(question);
    const options = canonical.options;
    if (!Array.isArray(options) || !options.length) return canonical;
    const order = options.map((_, i) => i);
    // Positional answer choices ("all above", "A and C") require editorial review before shuffling.
    const dependent = options.some((text: any) => typeof text === 'string' &&
        /\b(?:above|below|option\s+[A-Z]|[A-D]\s*(?:and|or|&)\s*[A-D])\b/i.test(text)) ||
        [...options, canonical.question, ...(Array.isArray(canonical.solutions) ? canonical.solutions : [canonical.solutions])]
            .some(hasUnhandledOptionReference);
    if (!dependent) {
        for (let i = order.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [order[i], order[j]] = [order[j], order[i]];
        }
    }
    return restorePresentation(canonical, order, canonical.selectedIndex ?? null, canonical.correctIndex);
}

/** Live reloads retain the same presentation while the server receives canonical answers. */
export function presentLiveQuestion(question: any, sessionId: string, uid: string): any {
    let seed = 2166136261;
    for (const char of `${sessionId}:${uid}:${question.id}`) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
    return presentQuestion(question, () => {
        seed += 0x6D2B79F5;
        let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
        value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
        return ((value ^ value >>> 14) >>> 0) / 4294967296;
    });
}

export function explanationText(question: any): string {
    return Array.isArray(question.solutions) ? question.solutions.filter((s: any) => typeof s === 'string').join('\n\n') : (question.solutions || '');
}
