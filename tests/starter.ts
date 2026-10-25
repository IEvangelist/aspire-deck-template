// The one place that decides which tests belong to this template rather than to any deck.
//
// A test tagged with `starter` asserts the template's own starter slides, examples, copy, or diagrams: their ids, order,
// code, or notes. Those run in `npm run test:starter`, which this repository's CI runs. Every other test builds its own
// slides or checks whatever deck is present, so `npm test` stays valid after an author replaces, removes, renames, or
// reorders the starter slides. Tag a test with `starter` only when it needs the starter deck itself.
//
//   test('the starter shows ...', starter, async ({ page }) => { ... });
//   test.describe('the starter ...', starter, () => { ... });
export const starterTag = '@starter';
export const starter = { tag: starterTag } as const;
