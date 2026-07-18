import { describe, expect, it } from 'vitest';
import { assertBatchSize, assertCollectionPath, assertDeleteConfirmation, assertDocumentPath, boundedLimit } from './safety.js';

describe('Firestore MCP safety helpers', () => {
  it('distinguishes collection and document paths', () => {
    expect(assertDocumentPath('actionPlans/item-1')).toBe('actionPlans/item-1');
    expect(assertCollectionPath('actionPlans/item-1/updates')).toBe('actionPlans/item-1/updates');
    expect(() => assertDocumentPath('actionPlans')).toThrow();
    expect(() => assertCollectionPath('actionPlans/item-1')).toThrow();
  });
  it('bounds queries and batches', () => {
    expect(boundedLimit(999)).toBe(200);
    expect(() => boundedLimit(0)).toThrow();
    expect(() => assertBatchSize(Array.from({ length: 21 }))).toThrow();
  });
  it('requires exact delete confirmation', () => {
    expect(() => assertDeleteConfirmation('users/1', 'delete users/1')).toThrow();
    expect(() => assertDeleteConfirmation('users/1', 'DELETE users/1')).not.toThrow();
  });
});
