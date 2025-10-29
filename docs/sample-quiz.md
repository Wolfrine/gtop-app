# Sample Quiz Feature Notes

The public sample quiz experience uses a static pool of MCQs defined in [`gtop-app/src/app/data/sample-questions.ts`](../gtop-app/src/app/data/sample-questions.ts).

## Updating the Sample Question Pool

- Each entry follows the shared `MCQ` interface from `src/app/services/mcq.service.ts`.
- Include `id`, `board`, `standard`, `subject`, `chapter`, `title`, `question`, four `options`, a `correctIndex`, matching `solutions` array, and set `selected` to `false`.
- Keep the pool to at least twenty diverse questions so the sampler can rotate varied sets of five.
- Because the sample quiz runs entirely client-side through `SampleQuizService`, updating the static array is all that is required—no backend changes or deployments are needed beyond the usual frontend release.
- After editing the pool, run `npm run build -- --configuration production` to ensure type safety and bundling succeed.

## Service Behaviour

- `SampleQuizService` shuffles the pool and returns five questions per attempt.
- LocalStorage persists the most recent attempt and attempt history (up to ten) for anonymous users so they can revisit explanations after navigating away.
- Retry flows reuse the same in-memory service contracts as the authenticated quiz, ensuring UI elements such as “Retry Incorrect” continue to work without backend calls.
