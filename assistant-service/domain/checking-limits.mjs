export const maxCheckingPages = 32;

export function checkingModelBudgetMs(pageCount, questionCount) {
  // Larger booklets need time for both image reading and a structured per-question response.
  const minutes = Math.min(30, 4 + Math.ceil(pageCount / 2) + Math.ceil(questionCount / 5));
  return minutes * 60_000;
}

export function checkingLeaseMs(pageCount, questionCount) {
  return checkingModelBudgetMs(pageCount, questionCount) + 3 * 60_000;
}
