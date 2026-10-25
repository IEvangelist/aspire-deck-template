import { defineConfig } from '@playwright/test';
import base from './playwright.config';
import { starterTag } from './tests/starter';

// This template's own regression suite: only the tests tagged with `starter` (tests/starter.ts), on the real starter deck.
// They assert the starter slides, examples, notes, and guide that this repository ships. `npm run test:starter` runs them,
// then proves that a copy with every slide replaced still passes `npm test` (scripts/generated-copy.mjs). CI runs it only in
// this repository. A generated repository's `npm test` never includes these tests.
export default defineConfig({
  ...base,
  grepInvert: undefined,
  grep: new RegExp(starterTag),
});
