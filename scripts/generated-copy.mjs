// Proves that a repository generated from this template stays green after its author replaces the starter.
//
// It makes a copy of this project in test-results/generated-copy as a fresh clone plus `npm ci` would leave it, replaces every
// slide, deck.config.json, diagrams.json, and public/assets file with tests/fixtures/generated-copy (no starter id, copy,
// diagram, or image survives), then runs what a generated repository's author and its Pages workflow run inside that copy:
// `npm run build` with the Pages settings, then `npm test`. The starter-tagged tests (tests/starter.ts) are excluded by the
// copy's own playwright.config.ts, exactly as in any generated repository.
//
//   node scripts/generated-copy.mjs         assemble the copy, build it, and run its tests (`npm run test:starter` does this)
//   node scripts/generated-copy.mjs serve   assemble the copy and serve it at http://127.0.0.1:4388/ to look at it
import { spawn } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = resolve(fileURLToPath(new URL('..', import.meta.url)));
const copy = join(repository, 'test-results', 'generated-copy');
const fixture = join(repository, 'tests', 'fixtures', 'generated-copy');
const base = '/generated-copy/';
const site = `https://example.github.io${base}`;

// A fresh clone has no builds or test output, and a fresh install has no dev-server caches.
const notCloned = new Set(['.git', 'dist', 'test-results', 'playwright-report']);
const caches = new Set(['.vite', '.vite-temp']);

function assemble() {
  rmSync(copy, { recursive: true, force: true });
  mkdirSync(copy, { recursive: true });
  for (const name of readdirSync(repository)) {
    if (notCloned.has(name)) continue;
    cpSync(join(repository, name), join(copy, name), {
      recursive: true,
      verbatimSymlinks: true,
      filter: (source) => !caches.has(basename(source)),
    });
  }
  rmSync(join(copy, 'public', 'assets'), { recursive: true, force: true });
  cpSync(fixture, copy, { recursive: true });
}

// Run a command in the copy as in a fresh terminal there, not as a child of the npm script that started this one.
function run(command, env = {}) {
  const clean = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^npm_/i.test(name)));
  return new Promise((done, fail) => {
    const child = spawn(command, { cwd: copy, env: { ...clean, ...env }, shell: true, stdio: 'inherit' });
    child.on('error', fail);
    child.on('exit', (code) => (code === 0 ? done() : fail(new Error(`${command} exited with code ${code}.`))));
  });
}

async function build() {
  await run('npm run build', { PAGES_BASE_PATH: base, PAGES_URL: site });
  const html = readFileSync(join(copy, 'dist', 'index.html'), 'utf8');
  const bundled = readdirSync(join(copy, 'dist', 'assets')).find((name) => /^slides-.+\.md$/.test(name));
  const markdown = bundled ? readFileSync(join(copy, 'dist', 'assets', bundled), 'utf8') : '';
  const missing = [
    [html.includes('<title>Small services, clear contracts</title>'), 'the fixture title in index.html'],
    [html.includes(`href="${site}"`), 'the canonical URL under the project base path'],
    [markdown.includes('id="why-small"'), 'the fixture slides in the production bundle'],
    [!markdown.includes('id="write-in-markdown"') && !markdown.includes('id="guide-start"'), 'no starter slide in the production bundle'],
  ].filter(([found]) => !found).map(([, what]) => what);
  if (missing.length) throw new Error(`The generated copy's production build lacks: ${missing.join('; ')}.`);
  console.log(`The generated copy builds under ${base} and ships only its own slides.`);
}

try {
  assemble();
  if (process.argv[2] === 'serve') {
    await run('npm run dev -- --host 127.0.0.1 --port 4388 --strictPort');
  } else {
    await build();
    await run('npm test');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
