import { describe, expect, it } from 'vitest';
import { canonicalIndex, canonicalQuestion, explanationText, presentLiveQuestion, presentQuestion, restorePresentation } from './question-presentation';

const bank = { id: 'bank-1', question: 'Choose the correct statement.', options: ['right', 'wrong1', 'wrong2', 'wrong3'], correctIndex: 0, selectedIndex: null,
    solutions: ['Option A is correct.', 'Reason one.', 'Reason two.', 'Reason three.'] };

describe('canonical question presentation', () => {
    it('moves the dominant canonical A answer while preserving scoring and bank data', () => {
        const shown = presentQuestion(bank, () => 0);
        expect(shown.options).toEqual(['wrong1', 'wrong2', 'wrong3', 'right']);
        expect(shown.correctIndex).toBe(3);
        shown.selectedIndex = 3;
        expect(canonicalIndex(shown, shown.selectedIndex)).toBe(0);
        expect(canonicalQuestion(shown)).toEqual({ ...bank, selectedIndex: 0 });
        expect(bank.correctIndex).toBe(0);
        expect(bank.options[0]).toBe('right');
    });

    it('preserves every reasoning paragraph and relabels explicit Option references', () => {
        const shown = presentQuestion(bank, () => 0);
        expect(explanationText(shown)).toBe('Option D is correct.\n\nReason one.\n\nReason two.\n\nReason three.');
    });

    it('still shuffles and relabels a supported explicit answer reference', () => {
        const original = { ...bank, solutions: ['The correct answer is Option A.', 'Reasoning remains visible.'] };
        const shown = presentQuestion(original, () => 0);
        expect(shown.options).toEqual(['wrong1', 'wrong2', 'wrong3', 'right']);
        expect(shown.solutions).toEqual(['The correct answer is Option D.', 'Reasoning remains visible.']);
        expect(canonicalQuestion(shown)).toEqual(original);
    });

    it.each([
        'The correct answer is A.',
        'The correct answer is A',
        'A',
        'Choice A is correct.',
        'choice A',
        'answer (A)',
        'The answer is (A).',
        'The answer is "A".',
        'A) This option is correct.',
        'A: This option is correct.',
        'A and B are both mentioned.',
        'A is correct because the quantity increases.',
    ])('preserves canonical order for an unhandled explanation reference: %s', reference => {
        const original = { ...bank, solutions: [reference, 'Keep this second reasoning paragraph.'] };
        const shown = presentQuestion(original, () => 0);
        expect(shown.options).toEqual(original.options);
        expect(shown.optionOrder).toEqual([0, 1, 2, 3]);
        expect(shown.correctIndex).toBe(0);
        expect(shown.solutions).toEqual(original.solutions);
        const restored = restorePresentation(original, shown.optionOrder, 0, 0);
        expect(canonicalQuestion(restored)).toEqual({ ...original, selectedIndex: 0 });
        expect(presentQuestion({ ...canonicalQuestion(restored), selectedIndex: null }, () => 0).options).toEqual(original.options);
    });

    it('also preserves order for unhandled references in question text or answer choices', () => {
        const prompt = { ...bank, question: 'Which of choice A and choice C is correct?' };
        expect(presentQuestion(prompt, () => 0).options).toEqual(prompt.options);
        const choices = { ...bank, options: ['first', 'second', 'Choice A', 'fourth'] };
        expect(presentQuestion(choices, () => 0).options).toEqual(choices.options);
    });

    it('roundtrips saved presentation and leaves historical canonical summaries intact', () => {
        const restored = restorePresentation(bank, [2, 0, 3, 1], 0, 0);
        expect(restored.selectedIndex).toBe(1);
        expect(restored.correctIndex).toBe(1);
        expect(canonicalIndex(restored, 1)).toBe(0);
        expect(restorePresentation(bank, undefined, 2, 0)).toMatchObject({ options: bank.options, selectedIndex: 2, correctIndex: 0 });
    });

    it('resets retries without accumulating option permutations', () => {
        const shown = presentQuestion(bank, () => 0);
        shown.selectedIndex = shown.correctIndex;
        const retry = presentQuestion({ ...canonicalQuestion(shown), selectedIndex: null }, () => 0.999);
        expect(retry.options).toEqual(bank.options);
        expect(retry.selectedIndex).toBeNull();
        expect(retry.solutions).toEqual(bank.solutions);
    });

    it('handles unanswered, malformed mapping and position-dependent choices conservatively', () => {
        expect(canonicalIndex(bank, null)).toBeNull();
        expect(canonicalIndex(bank, -1)).toBeNull();
        const dependent = { ...bank, options: ['first', 'second', 'Both A and B', 'All of the above'] };
        expect(presentQuestion(dependent, () => 0).options).toEqual(dependent.options);
        expect(restorePresentation(bank, [0, 0, 1, 2], null, 0).options).toEqual(bank.options);
    });

    it('Fisher-Yates reaches each of the 24 four-option permutations once for all swap choices', () => {
        const permutations = new Set<string>();
        for (let a = 0; a < 4; a++) for (let b = 0; b < 3; b++) for (let c = 0; c < 2; c++) {
            const draws = [(a + 0.5) / 4, (b + 0.5) / 3, (c + 0.5) / 2];
            permutations.add(presentQuestion(bank, () => draws.shift()!).optionOrder.join(','));
        }
        expect(permutations.size).toBe(24);
    });

    it('retains the same live display order on reload and submits canonical option identity', () => {
        const first = presentLiveQuestion(bank, 'live-session', 'student');
        const reload = presentLiveQuestion(bank, 'live-session', 'student');
        expect(first.optionOrder).toEqual(reload.optionOrder);
        expect(canonicalIndex(reload, reload.correctIndex)).toBe(bank.correctIndex);
    });
});
