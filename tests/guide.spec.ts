import AxeBuilder from '@axe-core/playwright';
import { existsSync, readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { parseDeckConfig, slideNumberPositions } from '../src/config';
import { authorMarkdown, jump, ready, renderedIds } from './helpers';
import { starter } from './starter';

const original = ['intro', 'make-it-yours', 'write-in-markdown', 'copyable-code', 'apphost-example', 'apphost-csharp', 'go-workload', 'compare-code',
  'run-and-reveal', 'rich-architecture', 'model-to-observation', 'animate-a-model', 'animate-add-cache', 'add-media', 'reveal-the-story',
  'a-little-deeper', 'statement-layout', 'split-layout', 'comparison-layout', 'transitions', 'publish-on-push'];
const guide = ['guide-start', 'guide-config', 'guide-settings', 'guide-markdown', 'guide-teach', 'guide-media', 'guide-present', 'guide-publish'];
const repository = 'https://github.com/IEvangelist/aspire-deck-template';

// What the audience can read on a slide: everything except the presenter notes.
const shown = (page: Page, id: string) => page.locator(`#${id}`).evaluate((slide) => {
  const copy = slide.cloneNode(true) as HTMLElement;
  for (const notes of copy.querySelectorAll('aside.notes')) notes.remove();
  return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
});
const code = async (page: Page, id: string, index = 0) => (await page.locator(`#${id} .code-panel`).nth(index).locator('pre code').textContent()) ?? '';
const flat = (value: string) => value.replace(/\s+/g, ' ');

// The guide is the starter's own manual, so everything here is a starter test: `npm run test:starter`, not `npm test`.
test.describe('the starter teaches how to use and configure the deck', starter, () => {
  test('every earlier slide stays in order and the guide sits before the closing slide', async ({ page }) => {
    await ready(page);
    const ids = await renderedIds(page);
    expect(ids.filter((id) => original.includes(id))).toEqual(original);
    expect(ids.slice(ids.indexOf('transitions'), ids.indexOf('publish-on-push') + 1)).toEqual(['transitions', ...guide, 'publish-on-push']);
    expect(ids).toHaveLength(original.length + guide.length);
    expect(new Set(ids).size).toBe(ids.length);
    await expect(page.locator('#menu-summary')).toHaveText(`${ids.length} slides`);
  });

  test('each guide slide is a named leaf with a kicker, a heading, and useful public notes', async ({ page }) => {
    await ready(page);
    for (const id of guide) {
      const slide = page.locator(`section#${id}`);
      await expect(slide, id).toHaveCount(1);
      await expect(slide.locator('.slide-kicker'), id).toHaveText('Guide');
      await expect(slide.locator('h2'), id).toHaveCount(1);
      expect(await slide.evaluate((node) => node.parentElement?.closest('.stack') === null && node.querySelector('section') === null), `${id} is a leaf`).toBe(true);
      const notes = slide.locator('aside.notes');
      await expect(notes, `${id} has exactly one notes block`).toHaveCount(1);
      await expect(notes, `${id} notes stay off the audience's screen`).toBeHidden();
      const body = (await notes.textContent())!.trim();
      expect(body, `${id} notes are a real cue`).toMatch(/^Cue: /);
      expect(body.length, `${id} notes`).toBeGreaterThan(400);
      // Nothing from the notes may leak into the slide when the notes separator misfires.
      expect(await shown(page, id), id).not.toContain('Cue:');
    }
  });

  test('the project map and the commands are the real ones', async ({ page }) => {
    await ready(page);
    const map = (await code(page, 'guide-start', 0)).split('\n').filter(Boolean);
    const paths = map.map((line) => line.split(/\s+/)[0]);
    expect(paths).toEqual(['deck.config.json', 'slides.md', 'diagrams.json', 'public/assets/', 'src/']);
    for (const path of paths) expect(existsSync(path), `${path} exists`).toBe(true);
    const commands = (await code(page, 'guide-start', 1)).split('\n').filter(Boolean);
    expect(commands).toEqual(['npm ci', 'npm run dev', 'npm test', 'npm run build', 'npm run preview']);
    const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
    for (const command of commands) {
      const script = command.match(/^npm run (\S+)$/)?.[1];
      if (script) expect(Object.keys(manifest.scripts), command).toContain(script);
      else expect(['npm ci', 'npm test'], command).toContain(command);
    }
    expect(manifest.scripts.test).toBe('playwright test');
    expect(manifest.scripts['test:starter']).toBe('playwright test -c playwright.starter.config.ts && node scripts/generated-copy.mjs');
    const readme = readFileSync('README.md', 'utf8');
    for (const command of [...commands, 'npm run test:starter']) expect(readme, `README documents ${command}`).toContain(command);
    const text = await shown(page, 'guide-start');
    expect(text).toContain('npx playwright install chromium');
    expect(readme).toContain('npx playwright install chromium');
    expect(text).toContain('Node.js 22.12+ or 24 LTS');
    expect(manifest.engines.node).toBe('^22.12.0 || >=24.0.0');
    expect(text).toMatch(/no \.NET SDK, Docker, or Aspire runtime/i);
    // The slide says what the two test commands are for, and the notes, README, and SKILL.md say the same.
    expect(flat(text)).toContain('npm test checks your deck');
    expect(flat(text)).toContain("npm run test:starter this template's own examples");
    const notes = flat((await page.locator('#guide-start aside.notes').textContent()) ?? '');
    expect(notes).toContain("test:starter maintains this template's own examples and guide");
    expect(notes).toContain("the template's CI runs it");
    for (const document of [readme, readFileSync('SKILL.md', 'utf8')]) {
      expect(flat(document)).toContain('npm run test:starter');
      expect(flat(document)).toContain('tests/fixtures/generated-copy');
    }
  });

  test('the workflow runs npm test everywhere and the starter suite only in the template repository', () => {
    const workflow = readFileSync('.github/workflows/pages.yml', 'utf8').replace(/\r\n/g, '\n');
    expect(workflow, 'npm test runs with no condition').toMatch(/^ {6}- name: [^\n]+\n {8}run: npm test$/m);
    const starterSteps = [...workflow.matchAll(/^ {6}- name: [^\n]+\n {8}if: ([^\n]+)\n {8}run: npm run test:starter$/gm)];
    expect(starterSteps, 'one step runs the starter suite').toHaveLength(1);
    expect(starterSteps[0][1]).toBe(`github.repository == '${repository.replace('https://github.com/', '')}'`);
    expect(workflow.match(/npm run test:starter/g), 'and nothing else runs it').toHaveLength(1);
    expect(Number(workflow.match(/^ {4}timeout-minutes: (\d+)$/m)?.[1]), 'the build job has time for both suites').toBeGreaterThanOrEqual(40);
  });

  test('the configuration excerpts are valid and every field is named on a slide', async ({ page }) => {
    await ready(page);
    const intro = parseDeckConfig(JSON.parse(`{${await code(page, 'guide-config')}}`));
    expect(intro).toMatchObject({ title: 'Your talk title', subtitle: 'A tagline under the title' });
    expect(intro.presenter).toMatchObject({ name: 'Your name', avatar: { src: 'assets/you.webp', alt: 'Your photo' } });
    expect(intro.event).toMatchObject({ name: 'Your event', date: 'Your date' });
    expect(intro.links).toEqual([{ label: 'Blog', url: 'https://example.com/' }]);
    // The smallest valid file really is just these two fields.
    expect(() => parseDeckConfig({ title: 'A talk', presenter: { name: 'A presenter' } })).not.toThrow();
    const settings = parseDeckConfig({ title: 'A talk', presenter: { name: 'A presenter' }, ...JSON.parse(`{${await code(page, 'guide-settings')}}`) });
    expect(settings.description).toBeTruthy();
    expect(settings.transition).toEqual({ style: 'fade', speed: 'fast' });
    expect(settings.chapters).toEqual({ code: { style: 'slide' } });
    expect(settings.slideNumber).toEqual({ visible: true, position: 'bottom-left' });
    expect(settings.social).toMatchObject({ image: 'assets/social-card.png', alt: 'Describe the card, including its text' });
    expect(existsSync('public/assets/social-card.png')).toBe(true);
    const text = `${await shown(page, 'guide-config')} ${await shown(page, 'guide-settings')}`;
    for (const field of ['title', 'subtitle', 'description', 'presenter.name', 'presenter.role', 'presenter.organization', 'avatar', 'src', 'alt',
      'event', 'date', 'location', 'links', 'label', 'url', 'transition', 'style', 'speed', 'chapters', 'slideNumber', 'visible', 'position',
      'social', 'image', 'siteName']) {
      expect(text, `a slide names ${field}`).toContain(field);
    }
    for (const position of slideNumberPositions) expect(text, position).toContain(position);
    expect(text).toContain('"visible": false');
    expect(text).toContain('bottom-left (the default)');
    expect(flat(await shown(page, 'guide-config'))).toContain('Only title and presenter.name are required');
  });

  test('the first step marks the two required fields and each Next adds one optional part', async ({ page }) => {
    await ready(page, '?mode=present#/guide-config');
    const focused = () => page.locator('#guide-config .code-line.is-focused').evaluateAll((lines) => lines.map((line) => (line.textContent ?? '').trim()));
    await expect.poll(focused).toEqual(['"title": "Your talk title",', '"name": "Your name",']);
    const expected = ['"subtitle": "A tagline under the title",', '"avatar": { "src": "assets/you.webp", "alt": "Your photo" }',
      '"event": { "name": "Your event", "date": "Your date" },', '"links": [{ "label": "Blog", "url": "https://example.com/" }]'];
    for (const line of expected) {
      await page.keyboard.press('Space');
      await expect.poll(focused).toEqual([line]);
    }
  });

  test('the counter settings are documented in the starter config, the guide, the README, and the skill', async ({ page }) => {
    await ready(page);
    const text = await shown(page, 'guide-settings');
    expect(text).toContain('top-left');
    expect(text).toContain('top-right');
    expect(text).toContain('bottom-left');
    expect(text).toContain('bottom-right');
    expect(text).toContain('hides it');
    const config = JSON.parse(readFileSync('deck.config.json', 'utf8'));
    expect(config.slideNumber).toEqual({ visible: true, position: 'bottom-left' });
    for (const file of ['README.md', 'SKILL.md']) {
      const document = flat(readFileSync(file, 'utf8'));
      for (const word of ['slideNumber', 'top-left', 'top-right', 'bottom-left', 'bottom-right', '"visible": false']) expect(document, `${file} documents ${word}`).toContain(word);
    }
  });

  test('the Markdown the table teaches does what it says', async ({ page }) => {
    await authorMarkdown(page, `<!-- .slide: id="idea" class="layout-split" -->
## A claim

<div class="layout-copy">

- Step one <!-- .element: class="fragment" -->

</div>

<div class="layout-visual">

\`\`\`js
const a = 1;
\`\`\`
<!-- .element: data-caption="a.js" -->

</div>

Notes:
Public text.

--

<!-- .slide: id="below" -->
## Below

---

<!-- .slide: id="after" -->
## After
`);
    await ready(page, '?mode=present#/idea');
    expect(await renderedIds(page)).toEqual(['intro', 'idea', 'below', 'after']);
    await expect(page.locator('#idea')).toHaveClass(/layout-split/);
    await expect(page.locator('#idea .fragment')).toHaveCount(1);
    await expect(page.locator('#idea aside.notes')).toHaveText('Public text.');
    await expect(page.locator('#idea aside.notes')).toBeHidden();
    await expect(page.locator('#idea .code-panel figcaption')).toContainText('a.js');
    await expect(page.locator('#idea .code-panel .copy-code')).toHaveCount(1);
    expect(await page.locator('#below').evaluate((node) => node.parentElement?.classList.contains('stack'))).toBe(true);
    expect(await page.locator('#after').evaluate((node) => node.parentElement?.classList.contains('stack'))).toBe(false);
  });

  test('the teaching patterns the guide lists are the live examples it links to', async ({ page }) => {
    await ready(page);
    const rows = await page.locator('#guide-teach ul.feature-list > li').evaluateAll((items) => items.map((item) => ({
      href: item.querySelector('a')?.getAttribute('href'), code: item.querySelector('code')?.textContent,
    })));
    expect(rows).toEqual([
      { href: '#/apphost-example', code: '[1|3-5|7]' }, { href: '#/apphost-csharp', code: 'data-pkg-cyan' },
      { href: '#/compare-code', code: 'layout-split' }, { href: '#/run-and-reveal', code: 'data-terminal' },
    ]);
    const text = await shown(page, 'guide-teach');
    for (const attribute of ['data-pkg', 'data-add', 'data-apis', 'data-lines']) expect(text).toContain(attribute);
    expect((await page.locator('#apphost-example pre').first().evaluate((pre) => [...pre.attributes].map((attribute) => attribute.name)))).toEqual(
      expect.arrayContaining(['data-pkg-cyan', 'data-add-cyan', 'data-apis-cyan', 'data-lines-cyan']));
    await expect(page.locator('#apphost-example .code-line.is-focused').first()).toBeAttached();
    expect(await page.locator('#apphost-example .fragment').count()).toBeGreaterThan(0);
    await expect(page.locator('#apphost-csharp .code-legend')).toHaveCount(1);
    await expect(page.locator('#compare-code .layout-visual')).toHaveCount(2);
    await expect(page.locator('#run-and-reveal [data-terminal], #run-and-reveal .terminal-panel')).not.toHaveCount(0);
  });

  test('the terminal focus syntax the guide shows is what the starter slide uses, and the docs agree', async ({ page }) => {
    await ready(page);
    const text = await shown(page, 'guide-teach');
    expect(text).toContain('data-terminal-focus="true"');
    expect(text).toContain('terminal-support');
    const notes = flat((await page.locator('#guide-teach aside.notes').textContent()) ?? '');
    for (const claim of ['Reading mode and print keep every line', 'reduced motion shows the finished layout at once', 'a focus value other than true stops the load']) {
      expect(notes, claim).toContain(claim);
    }
    await expect(page.locator('#run-and-reveal')).toHaveAttribute('data-terminal-focus', 'true');
    await expect(page.locator('#run-and-reveal .terminal-support')).toHaveCount(1);
    for (const file of ['README.md', 'SKILL.md']) {
      const document = flat(readFileSync(file, 'utf8'));
      expect(document, file).toContain('data-terminal-focus="true"');
      expect(document, file).toContain('terminal-support');
    }
  });

  test('the disclosure behavior the guide gives is what the deck does, and the docs agree', async ({ page }) => {
    await ready(page);
    expect(flat(await shown(page, 'guide-markdown'))).toContain('A native <details> is a dialog while presenting and inline when reading.');
    const notes = flat((await page.locator('#guide-markdown aside.notes').textContent()) ?? '');
    for (const claim of ['opens that content in one dialog', 'the slide never grows or moves', 'Escape or Close returns to the summary',
      'Reading mode expands it inline, print includes it', 'without script it is a plain details element']) {
      expect(notes, claim).toContain(claim);
    }
    for (const file of ['README.md', 'SKILL.md']) {
      const document = flat(readFileSync(file, 'utf8'));
      for (const word of ['<details>', '<summary>', 'one modal dialog', 'Escape or Close', 'print']) expect(document, `${file} documents ${word}`).toContain(word);
    }
  });

  test('the step list the guide shows is real Reveal syntax', async ({ page }) => {
    await authorMarkdown(page, `<!-- .slide: id="steps" -->
## Steps

\`\`\`typescript [1|3-5|7]
one;
two;
three;
four;
five;
six;
seven;
\`\`\`
`);
    await ready(page, '?mode=present#/steps');
    const focused = () => page.locator('#steps .code-line.is-focused').evaluateAll((lines) => lines.map((line) => (line as HTMLElement).dataset.line).join(','));
    await expect.poll(focused).toBe('1');
    await page.keyboard.press('Space');
    await expect.poll(focused).toBe('3,4,5');
    await page.keyboard.press('Space');
    await expect.poll(focused).toBe('7');
  });

  test('every link in the guide goes somewhere real', async ({ page }) => {
    await ready(page);
    const ids = await renderedIds(page);
    const links = await page.locator(guide.map((id) => `#${id} a[href]`).join(', ')).evaluateAll((anchors) => anchors.map((anchor) => (anchor as HTMLAnchorElement).getAttribute('href')!));
    expect(links.length).toBeGreaterThan(5);
    for (const href of links) {
      if (href.startsWith('#/')) expect(ids, href).toContain(href.slice(2).split('/')[0]);
      else expect(href, href).toMatch(/^https:\/\/(github\.com\/IEvangelist\/aspire-deck-template|revealjs\.com\/)/);
    }
    expect(links).toEqual(expect.arrayContaining([`${repository}#readme`, `${repository}/blob/main/SKILL.md`, 'https://revealjs.com/markdown/']));
  });

  test('publishing and sharing name the real settings and keep the two previews apart', async ({ page }) => {
    await ready(page);
    const text = await shown(page, 'guide-publish');
    expect(text).toContain('Settings > Social preview > Edit > Upload an image');
    expect(text).toContain('Settings > Pages > Source');
    expect(text).toContain('GitHub Actions');
    expect(text).toContain('Automatic');
    expect(text).toContain('Manual, once');
    expect(text).toMatch(/1280\s*×\s*640/);
    expect(text).toContain('under 1 MB');
    const readme = flat(readFileSync('README.md', 'utf8'));
    expect(readme).toContain('Social preview > Edit > Upload an image');
    expect(readme).toContain('Settings > Pages > Build and deployment > Source');
    expect(flat(await page.locator('#guide-publish aside.notes').textContent() ?? '')).toContain('Committing the file does not set it');
    expect(existsSync('.github/workflows/pages.yml')).toBe(true);
    expect(existsSync('.github/social-preview.png')).toBe(true);
  });

  test('notes are described as public, and the guide stays neutral and speaker-free', async ({ page }) => {
    await ready(page);
    expect(await shown(page, 'guide-markdown')).toContain('public on the site');
    expect(flat((await page.locator('#guide-present aside.notes').textContent()) ?? '')).toContain('public, not confidential');
    expect(await shown(page, 'guide-present')).toContain('Notes are public');
    const everything = (await Promise.all(guide.map((id) => shown(page, id)))).join(' ');
    expect(everything).not.toMatch(/David|Pine|davidpine|Microsoft/i);
    await expect(page.locator('#intro h1')).toHaveText('Your Aspire talk');
  });
});

test.describe('the guide slides read well in every mode', starter, () => {
  for (const theme of ['light', 'dark']) {
    test(`presenting at projector size in ${theme}: windows hold their lines and nothing overflows`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await ready(page, `?mode=present&theme=${theme}`);
      for (const id of guide) {
        await jump(page, id);
        const state = await page.locator(`#${id}`).evaluate((slide) => ({
          scrolls: [...slide.querySelectorAll('pre')].some((pre) => pre.scrollHeight > pre.clientHeight + 1 || pre.scrollWidth > pre.clientWidth + 1),
          wrapped: [...slide.querySelectorAll('pre .code-line')].some((line) => line.getBoundingClientRect().height > parseFloat(getComputedStyle(line).lineHeight) * 1.4 * (parseFloat(document.documentElement.style.getPropertyValue('--slide-scale')) || 1)),
          page: document.documentElement.scrollWidth > innerWidth,
        }));
        expect(state, `${id} ${theme}`).toEqual({ scrolls: false, wrapped: false, page: false });
      }
    });

    test(`axe finds nothing on the guide slides in ${theme}`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width: 1280, height: 720 });
      await ready(page, `?mode=present&theme=${theme}`);
      for (const id of guide) {
        await jump(page, id);
        const results = await new AxeBuilder({ page }).include(`#${id}`).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        expect(results.violations.map((violation) => `${id}: ${violation.id}`), id).toEqual([]);
      }
    });
  }

  test('reading mode on a phone shows every line, with no step highlight and no overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await ready(page, '?mode=read&theme=light');
    for (const id of guide) {
      await page.evaluate((slide) => document.getElementById(slide)!.scrollIntoView(), id);
      const state = await page.locator(`#${id}`).evaluate((slide) => ({
        focused: slide.querySelectorAll('.code-line.is-focused').length,
        clipped: [...slide.querySelectorAll('pre')].some((pre) => pre.scrollHeight > pre.clientHeight + 1 || pre.scrollWidth > pre.clientWidth + 1),
        overflow: document.documentElement.scrollWidth > innerWidth,
      }));
      expect(state, id).toEqual({ focused: 0, clipped: false, overflow: false });
    }
    expect((await code(page, 'guide-config')).split('\n').filter(Boolean)).toHaveLength(8);
    expect((await code(page, 'guide-settings')).split('\n').filter(Boolean)).toHaveLength(8);
  });

  test('a narrow presentation window keeps the guide readable without shrinking the code', async ({ page }) => {
    await page.setViewportSize({ width: 617, height: 800 });
    await ready(page, '?mode=present&theme=dark');
    for (const id of guide) {
      await jump(page, id);
      const state = await page.locator(`#${id}`).evaluate((slide) => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        smallest: Math.min(24, ...[...slide.querySelectorAll('pre')].map((pre) => parseFloat(getComputedStyle(pre).fontSize))),
      }));
      expect(state.overflow, id).toBe(false);
      expect(state.smallest, id).toBeGreaterThanOrEqual(16);
    }
  });

  test('print gives every slide its own page and shows every line without the notes', async ({ page }) => {
    await ready(page, '?print-pdf&theme=light');
    const total = original.length + guide.length;
    await page.waitForSelector('.pdf-page', { state: 'attached' });
    await expect(page.locator('.pdf-page')).toHaveCount(total);
    await page.emulateMedia({ media: 'print' });
    for (const id of guide) {
      const state = await page.locator(`#${id}`).evaluate((slide) => ({
        clipped: [...slide.querySelectorAll('pre')].some((pre) => pre.scrollHeight > pre.clientHeight + 1),
        notes: [...slide.querySelectorAll('aside.notes')].some((notes) => getComputedStyle(notes).display !== 'none'),
        counter: getComputedStyle(document.getElementById('slide-position')!).display,
      }));
      expect(state, id).toEqual({ clipped: false, notes: false, counter: 'none' });
    }
  });
});
