import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { authorMarkdown, captureClipboard, contrastOf, expectContrast, expectCopied, jump, ready, renderedIds, settleMotion } from './helpers';

const fence = '```';
const source = [
  'const cache = await builder.addRedis("cache")',
  '  .withEnvironment("MODE", "dev")',
  '  .withRedisCommander();',
  '',
  'await builder.addViteApp("web", "./web")',
  '  .withReference(cache);',
].join('\n');
const packages = 'data-pkg-pink="Aspire.Hosting.Redis" data-add-pink="redis" data-apis-pink="addRedis withRedisCommander" data-lines-pink="1-3" ' +
  'data-pkg-cyan="Aspire.Hosting.JavaScript" data-apis-cyan="addViteApp" data-lines-cyan="5-6"';
const after = '\n---\n<!-- .slide: id="after" -->\n## After\n\nThe next slide.\n';

function slide(attributes = packages, info = 'typescript', code = source, id = 'pkg') {
  return `<!-- .slide: id="${id}" -->\n## Packages\n\n${fence}${info}\n${code}\n${fence}\n<!-- .element: data-caption="apphost.mts" -->\n<!-- .element: ${attributes} -->\n${after}`;
}

const lines = (page: Page, id = 'pkg') => page.locator(`#${id} pre code > .code-line`).evaluateAll((nodes) => nodes.map((node) => {
  const line = node as HTMLElement;
  return {
    n: Number(line.dataset.line), rail: line.dataset.rail ?? '', start: line.classList.contains('rail-start'), end: line.classList.contains('rail-end'),
    focus: line.classList.contains('is-focused'),
    radii: ['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft'].map((corner) => parseFloat(getComputedStyle(line)[`border${corner}Radius` as 'borderTopLeftRadius'])),
  };
}));

test.describe('package and API annotation', () => {
  test('colors only the owned APIs and rails the grouped lines, leaving core calls neutral', async ({ page }) => {
    await authorMarkdown(page, slide());
    await ready(page);
    await jump(page, 'pkg');
    const tokens = await page.locator('#pkg .pkg-api').evaluateAll((nodes) => nodes.map((node) => `${(node as HTMLElement).dataset.pkg}:${node.textContent}`));
    expect(tokens).toEqual(['pink:addRedis', 'pink:withRedisCommander', 'cyan:addViteApp']);
    const rails = (await lines(page)).map(({ n, rail, start, end }) => ({ n, rail, start, end }));
    expect(rails).toEqual([
      { n: 1, rail: 'pink', start: true, end: false },
      { n: 2, rail: 'pink', start: false, end: false },
      { n: 3, rail: 'pink', start: false, end: true },
      { n: 4, rail: '', start: false, end: false },
      { n: 5, rail: 'cyan', start: true, end: false },
      { n: 6, rail: 'cyan', start: false, end: true },
    ]);
    // Neutral calls keep the ordinary syntax colors and are not package tokens.
    expect(await page.locator('#pkg .pkg-api', { hasText: 'withEnvironment' }).count()).toBe(0);
    expect(await page.locator('#pkg .pkg-api', { hasText: 'withReference' }).count()).toBe(0);
    const legend = await page.locator('#pkg .code-legend li').evaluateAll((nodes) => nodes.map((node) => `${(node as HTMLElement).dataset.pkg}|${node.textContent?.replace(/\s+/g, ' ').trim()}`));
    expect(legend).toEqual(['pink|Aspire.Hosting.Redis aspire add redis', 'cyan|Aspire.Hosting.JavaScript']);
    await expect(page.locator('#pkg .code-legend')).toHaveAccessibleName('Integration packages used in this code');
    // The legend sits inside the code window between its caption and its scrolling body.
    expect(await page.locator('#pkg .code-panel > *').evaluateAll((nodes) => nodes.map((node) => node.localName))).toEqual(['figcaption', 'ul', 'pre']);
    await expect(page.locator('#pkg .code-panel > ul')).toHaveClass('code-legend');
  });

  test('a legend can show only the package or only the aspire add name', async ({ page }) => {
    await authorMarkdown(page, slide('data-pkg-pink="Aspire.Hosting.Redis" data-apis-pink="addRedis withRedisCommander" data-add-teal="go" data-apis-teal="addViteApp"'));
    await ready(page);
    await jump(page, 'pkg');
    const legend = await page.locator('#pkg .code-legend li').evaluateAll((nodes) => nodes.map((node) => node.textContent?.replace(/\s+/g, ' ').trim()));
    expect(legend).toEqual(['Aspire.Hosting.Redis', 'aspire add go']);
  });

  test('without data-lines each rail follows the lines that use the package', async ({ page }) => {
    await authorMarkdown(page, slide('data-pkg-pink="Aspire.Hosting.Redis" data-apis-pink="addRedis" data-pkg-cyan="Aspire.Hosting.JavaScript" data-apis-cyan="addViteApp"'));
    await ready(page);
    await jump(page, 'pkg');
    expect((await lines(page)).filter((line) => line.rail).map(({ n, rail, start, end }) => `${n}${rail[0]}${start ? '^' : ''}${end ? '$' : ''}`)).toEqual(['1p^$', '5c^$']);
  });

  test('names inside strings and comments are never colored', async ({ page }) => {
    const code = ['// addRedis is the call', 'const text = "addRedis";', 'await builder.addRedis("cache");'].join('\n');
    await authorMarkdown(page, slide('data-pkg-pink="Aspire.Hosting.Redis" data-apis-pink="addRedis"', 'typescript', code));
    await ready(page);
    await jump(page, 'pkg');
    expect(await page.locator('#pkg .pkg-api').count()).toBe(1);
    expect((await lines(page)).map((line) => line.rail)).toEqual(['', '', 'pink']);
  });

  test('legend, rails and colors never change the text, the selection or Copy', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await captureClipboard(page);
    await authorMarkdown(page, slide());
    await ready(page);
    await jump(page, 'pkg');
    expect(await page.locator('#pkg pre code').textContent()).toBe(source);
    await page.locator('#pkg .copy-code').click();
    await expectCopied(page, source);
    await page.evaluate(() => {
      const range = document.createRange();
      range.selectNodeContents(document.querySelector('#pkg pre code')!);
      const selection = getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
    });
    await page.evaluate(() => navigator.clipboard.writeText('sentinel'));
    await page.keyboard.press('Control+C');
    await expect.poll(async () => (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n')).toBe(source);
  });

  test('stepped focus, numbers and package annotation work together', async ({ page }) => {
    await authorMarkdown(page, slide(packages, 'typescript [1-3|5-6|2]'));
    await ready(page);
    await jump(page, 'pkg');
    expect(await page.locator('#pkg pre code').textContent()).toBe(source);
    expect((await lines(page)).filter((line) => line.focus).map((line) => line.n)).toEqual([1, 2, 3]);
    expect((await lines(page)).filter((line) => line.rail).length).toBe(5);
    await page.keyboard.press('Space');
    await expect.poll(async () => (await lines(page)).filter((line) => line.focus).map((line) => line.n)).toEqual([5, 6]);
    await expect(page.locator('#pkg .pkg-api')).toHaveCount(3);
    expect((await lines(page)).filter((line) => line.rail).length).toBe(5);
    await page.keyboard.press('ArrowLeft');
    await expect.poll(async () => (await lines(page)).filter((line) => line.focus).map((line) => line.n)).toEqual([1, 2, 3]);
  });

  const failures: [string, string, string][] = [
    ['an unknown accent', 'data-pkg-orange="X" data-apis-orange="addRedis"', '"orange" is not a package accent'],
    ['an API owned twice', 'data-pkg-pink="A" data-apis-pink="addRedis" data-pkg-cyan="B" data-apis-cyan="addRedis"', 'addRedis is owned by both pink and cyan'],
    ['an API that is not in the code', 'data-pkg-pink="A" data-apis-pink="addPostgres"', 'addPostgres (data-apis-pink) does not appear as code'],
    ['lines outside the block', 'data-pkg-pink="A" data-apis-pink="addRedis" data-lines-pink="1-9"', 'outside this 6-line code block'],
    ['an API outside its lines', 'data-pkg-pink="A" data-apis-pink="addRedis withRedisCommander" data-lines-pink="1-2"', 'withRedisCommander is used on line 3, outside data-lines-pink'],
    ['a line shared by two packages', 'data-pkg-pink="A" data-apis-pink="addRedis" data-lines-pink="1-3" data-pkg-cyan="B" data-apis-cyan="addViteApp" data-lines-cyan="3-6"', 'line 3 belongs to both pink and cyan'],
    ['no APIs', 'data-pkg-pink="A"', 'data-apis-pink is required'],
    ['neither a package nor an add name', 'data-apis-pink="addRedis"', 'give data-pkg-pink'],
    ['a full aspire add command', 'data-add-pink="aspire add redis" data-apis-pink="addRedis"', 'only what follows "aspire add"'],
    ['a step list in data-lines', 'data-pkg-pink="A" data-apis-pink="addRedis" data-lines-pink="1|3"', 'takes commas and hyphens'],
    ['an API that is not an identifier', 'data-pkg-pink="A" data-apis-pink="add-redis"', '"add-redis" in data-apis-pink is not an identifier'],
  ];
  for (const [name, attributes, message] of failures) {
    test(`${name} fails visibly and names its slide and block`, async ({ page }) => {
      await authorMarkdown(page, slide(attributes));
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('data-deck-ready', 'error');
      await expect(page.locator('#failure-detail')).toContainText('slide "pkg"');
      await expect(page.locator('#failure-detail')).toContainText('apphost.mts');
      await expect(page.locator('#failure-detail')).toContainText(message);
    });
  }

  test('a narrow window keeps the legend inside the window and the rails beside their lines', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authorMarkdown(page, slide());
    await ready(page, '?mode=read');
    const fit = await page.locator('#pkg').evaluate((node) => {
      const panel = node.querySelector('.code-panel')!.getBoundingClientRect();
      const legend = node.querySelector('.code-legend')!.getBoundingClientRect();
      const pre = node.querySelector('pre')!;
      const first = node.querySelector('.code-line[data-rail]')!;
      const rail = getComputedStyle(first, '::after');
      return {
        legendInside: legend.left >= panel.left - 0.5 && legend.right <= panel.right + 0.5,
        railWidth: rail.width, railLeft: parseFloat(rail.left), padding: parseFloat(getComputedStyle(pre).paddingLeft),
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    expect(fit.legendInside).toBe(true);
    expect(fit.railWidth).toBe('4px');
    // The rail sits in the code body's own padding, not outside the window.
    expect(Math.abs(fit.railLeft)).toBeLessThan(fit.padding);
    expect(fit.overflow).toBe(false);
  });
});

test.describe('contiguous highlight bands round only their ends', () => {
  const code = ['one();', 'two();', 'three();', 'four();', 'five();', 'six();'].join('\n');
  const radii = async (page: Page) => (await lines(page, 'bands')).map((line) => (line.focus ? line.radii.map((radius) => radius > 0 ? 'r' : '0').join('') : '-'));

  test('first and last lines carry the outer corners; the lines between are square; isolated lines are fully rounded', async ({ page }) => {
    await authorMarkdown(page, `<!-- .slide: id="bands" -->\n## Bands\n\n${fence}typescript [1-3|2|1,3|5-6]\n${code}\n${fence}\n${after}`);
    await ready(page);
    await jump(page, 'bands');
    // Corners are listed top-left, top-right, bottom-right, bottom-left.
    expect(await radii(page)).toEqual(['rr00', '0000', '00rr', '-', '-', '-']);
    await page.keyboard.press('Space');
    await expect.poll(() => radii(page)).toEqual(['-', 'rrrr', '-', '-', '-', '-']);
    await page.keyboard.press('Space');
    await expect.poll(() => radii(page)).toEqual(['rrrr', '-', 'rrrr', '-', '-', '-']);
    await page.keyboard.press('Space');
    await expect.poll(() => radii(page)).toEqual(['-', '-', '-', '-', 'rr00', '00rr']);
  });

  test('the joins between lines of one band leave no seam', async ({ page }) => {
    await authorMarkdown(page, `<!-- .slide: id="bands" -->\n## Bands\n\n${fence}typescript [1-4]\n${code}\n${fence}\n${after}`);
    await ready(page);
    await jump(page, 'bands');
    const seams = await page.locator('#bands .code-line.is-focused').evaluateAll((nodes) => nodes.slice(1).map((node, index) => node.getBoundingClientRect().top - nodes[index].getBoundingClientRect().bottom));
    expect(seams).toHaveLength(3);
    for (const seam of seams) expect(Math.abs(seam)).toBeLessThanOrEqual(0.5);
    const colors = await page.locator('#bands .code-line.is-focused').evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).backgroundColor));
    expect(new Set(colors).size).toBe(1);
  });

  test('the starter walkthrough joins its two-line step into one band', async ({ page }) => {
    await ready(page);
    await jump(page, 'apphost-example');
    await page.keyboard.press('Space');
    await page.keyboard.press('Space');
    await expect.poll(async () => (await lines(page, 'apphost-example')).filter((line) => line.focus).map((line) => line.n)).toEqual([4, 5]);
    const bands = (await lines(page, 'apphost-example')).filter((line) => line.focus).map((line) => line.radii.map((radius) => radius > 0 ? 'r' : '0').join(''));
    expect(bands).toEqual(['rr00', '00rr']);
  });
});

test.describe('the on-theme accents are readable in every theme and in print', () => {
  const dataAccent = `<!-- .slide: id="accent" data-kicker="Chapter" data-accent="ACCENT" -->\n## A **chapter** word\n\n<div class="card-row"><div class="card" data-accent="ACCENT"><span data-icon="rocket"></span><h3>A card</h3><p>Some text.</p></div></div>\n${after}`;

  for (const theme of ['light', 'dark']) {
    for (const accent of ['cyan', 'pink', 'teal']) {
      test(`${accent} kicker, heading word and card tint meet AA text contrast in ${theme}`, async ({ page }) => {
        await authorMarkdown(page, dataAccent.replaceAll('ACCENT', accent));
        await ready(page, `?mode=present&theme=${theme}`);
        await jump(page, 'accent');
        const colors = await page.locator('#accent').evaluate((node) => {
          const read = (selector: string) => getComputedStyle(node.querySelector(selector)!).color;
          return { kicker: read('.slide-kicker'), word: read('h2 strong'), icon: read('.card > [data-icon]') };
        });
        expect(colors.kicker).toBe(colors.word);
        expect(colors.icon).toBe(colors.word);
        // The card tint is translucent, so each color is measured against what is really painted behind it.
        expectContrast(await contrastOf(page, '#accent .slide-kicker'), 4.5, 1, 'kicker on the page');
        expectContrast(await contrastOf(page, '#accent h2 strong'), 4.5, 1, 'accent word on the page');
        expectContrast(await contrastOf(page, '#accent .card > [data-icon]'), 4.5, 1, 'card icon on the tinted card');
        const results = await new AxeBuilder({ page }).include('#accent').withRules(['color-contrast']).analyze();
        expect(results.violations).toEqual([]);
      });
    }
  }

  test('without data-accent a slide keeps the Aspire purple', async ({ page }) => {
    await authorMarkdown(page, '<!-- .slide: id="plain" data-kicker="Chapter" -->\n## A **plain** slide\n\nText.');
    await ready(page, '?mode=present&theme=dark');
    await jump(page, 'plain');
    expect(await page.locator('#plain .slide-kicker').evaluate((node) => getComputedStyle(node).color)).toBe('rgb(173, 146, 255)');
  });

  // The code window stays dark in both themes, so the same bright package colors must read on it in light and dark, in
  // the projector layout and in reading mode, whether the line is inside the focus band or outside it.
  const colors = 'data-pkg-purple="P" data-apis-purple="one" data-pkg-cyan="C" data-apis-cyan="two" data-pkg-pink="K" data-add-pink="redis" data-apis-pink="three" data-pkg-teal="T" data-apis-teal="four"';
  const block = (id: string, steps: string) => `<!-- .slide: id="${id}" -->\n## ${id}\n\n${fence}typescript ${steps}\none();\ntwo();\nthree();\nfour();\n${fence}\n<!-- .element: ${colors} -->\n`;
  // A single step is permanent emphasis, so the band stays in every mode; a stepped list shows only its current step and
  // goes neutral in reading and print. Both put package colors on a band and on plain code.
  const twoBlocks = `${block('all', '[1-4]')}\n---\n${block('partial', '[1|2-3]')}${after}`;

  async function expectReadablePackages(page: Page, focusedLines: Record<string, number>) {
    for (const [id, focused] of Object.entries(focusedLines)) {
      await expect(page.locator(`#${id} .code-line.is-focused`), `${id}: focused lines`).toHaveCount(focused);
      expectContrast(await contrastOf(page, `#${id} .pkg-api`), 4.5, 4, `${id}: API names`);
      expectContrast(await contrastOf(page, `#${id} .legend-package, #${id} .legend-add`), 4.5, 5, `${id}: legend text`);
      expectContrast(await contrastOf(page, `#${id} .legend-swatch`, { fill: true }), 3, 4, `${id}: legend swatches`);
      expectContrast(await contrastOf(page, `#${id} .code-line[data-rail]`, { fill: true, pseudo: '::after' }), 3, 4, `${id}: rails`);
      expectContrast(await contrastOf(page, `#${id} .code-line`), 4.5, 4, `${id}: the code itself`);
    }
  }

  for (const [mode, theme] of [['present', 'light'], ['present', 'dark'], ['read', 'light'], ['read', 'dark']] as const) {
    test(`every package color meets AA contrast on the code, the legend and the focus band in ${mode} ${theme}`, async ({ page }) => {
      await page.setViewportSize(mode === 'present' ? { width: 1280, height: 720 } : { width: 1280, height: 900 });
      await authorMarkdown(page, twoBlocks);
      await ready(page, `?mode=${mode}&theme=${theme}`);
      if (mode === 'present') {
        await jump(page, 'all');
        await expectReadablePackages(page, { all: 4 });
        await jump(page, 'partial');
        await expectReadablePackages(page, { partial: 1 });
      } else {
        // Reading mode keeps a permanent band and shows a stepped list as complete, neutral code.
        await expectReadablePackages(page, { all: 4, partial: 0 });
      }
      for (const id of ['all', 'partial']) {
        const results = await new AxeBuilder({ page }).include(`#${id}`).withRules(['color-contrast']).analyze();
        expect(results.violations, id).toEqual([]);
      }
    });
  }

  test('print uses the darker package colors on the light code surface, measured against the real paper', async ({ page }) => {
    await authorMarkdown(page, twoBlocks);
    await ready(page, '?print-pdf&theme=dark');
    await page.locator('.pdf-page').first().waitFor({ state: 'attached' });
    await page.emulateMedia({ media: 'print' });
    // Switching media restyles the live page, and a code line eases its background, so measure the settled paint.
    await settleMotion(page);
    await expectReadablePackages(page, { all: 4, partial: 0 });
    const legend = await page.locator('#all .code-legend').evaluate((node) => getComputedStyle(node).display);
    expect(legend).not.toBe('none');
    // The printed surface is genuinely light, so the dark tones are the right ones.
    const [paper] = await contrastOf(page, '#all pre');
    expect(paper.ratio, 'the code text on the printed code surface').toBeGreaterThanOrEqual(7);
  });
});

test.describe('the starter examples are accurate and labeled', () => {
  const apphost = [
    'import { createBuilder } from "./.aspire/modules/aspire.mjs";',
    '',
    'const builder = await createBuilder();',
    'const api = await builder.addNodeApp("api", "./api", "src/index.ts")',
    '  .withHttpEndpoint({ env: "PORT" });',
    'await builder.addViteApp("web", "./web").withReference(api).waitFor(api);',
    'await builder.build().run();',
  ].join('\n');
  const csharp = [
    'var builder = DistributedApplication.CreateBuilder(args);',
    '',
    'var cache = builder.AddRedis("cache").WithRedisCommander();',
    'var api = builder.AddGoApp("api", "./api").WithReference(cache);',
    'builder.AddViteApp("web", "./web").WithReference(api);',
    '',
    'builder.Build().Run();',
  ].join('\n');

  test('the TypeScript apphost.mts source is unchanged and cyan marks only Aspire.Hosting.JavaScript', async ({ page }) => {
    await ready(page);
    await jump(page, 'apphost-example');
    expect(await page.locator('#apphost-example pre code').textContent()).toBe(apphost);
    expect(await page.locator('#apphost-example .pkg-api').evaluateAll((nodes) => nodes.map((node) => node.textContent))).toEqual(['addNodeApp', 'addViteApp']);
    expect((await lines(page, 'apphost-example')).filter((line) => line.rail).map((line) => line.n)).toEqual([4, 5, 6]);
    await expect(page.locator('#apphost-example .code-legend')).toContainText('Aspire.Hosting.JavaScript');
    await expect(page.locator('#apphost-example .code-legend')).toContainText('aspire add javascript');
  });

  test('the C# top-level AppHost shows three packages, each with its own APIs', async ({ page }) => {
    await ready(page);
    expect((await renderedIds(page)).slice(4, 7)).toEqual(['apphost-example', 'apphost-csharp', 'go-workload']);
    await jump(page, 'apphost-csharp');
    expect(await page.locator('#apphost-csharp pre code').textContent()).toBe(csharp);
    await expect(page.locator('#apphost-csharp pre code')).toHaveAttribute('data-language', 'csharp');
    expect(await page.locator('#apphost-csharp .pkg-api').evaluateAll((nodes) => nodes.map((node) => `${(node as HTMLElement).dataset.pkg}:${node.textContent}`)))
      .toEqual(['pink:AddRedis', 'pink:WithRedisCommander', 'teal:AddGoApp', 'cyan:AddViteApp']);
    expect(await page.locator('#apphost-csharp .legend-package').allTextContents()).toEqual(['Aspire.Hosting.Redis', 'Aspire.Hosting.Go', 'Aspire.Hosting.JavaScript']);
    await expect(page.locator('#apphost-csharp .pkg-api', { hasText: 'WithReference' })).toHaveCount(0);
    await expect(page.locator('#apphost-csharp .code-panel figcaption')).toContainText('AppHost.cs');
  });

  test('Go is shown as a workload: main.go has no Aspire tint and only the AddGoApp wiring is teal', async ({ page }) => {
    await ready(page);
    await jump(page, 'go-workload');
    const [workload, wiring] = await page.locator('#go-workload .code-panel').all();
    await expect(workload.locator('figcaption')).toContainText('main.go');
    await expect(workload.locator('figcaption')).toContainText('Go workload');
    await expect(workload.locator('.code-legend, .pkg-api, [data-rail]')).toHaveCount(0);
    await expect(workload.locator('pre code')).toHaveAttribute('data-language', 'go');
    expect(await workload.locator('pre code').textContent()).toContain('os.Getenv("PORT")');
    await expect(wiring.locator('figcaption')).toContainText('AppHost.cs');
    await expect(wiring.locator('.legend-package')).toHaveText('Aspire.Hosting.Go');
    await expect(wiring.locator('.legend-add')).toHaveText('aspire add go');
    expect(await wiring.locator('.pkg-api').allTextContents()).toEqual(['AddGoApp']);
    expect(await wiring.locator('pre code').textContent()).toBe('builder.AddGoApp("api", "./api")\n    .WithHttpEndpoint(env: "PORT");');
    const text = await page.locator('#go-workload').evaluate((node) => (node as HTMLElement).innerText);
    expect(text).toContain('workload');
    expect(text).toContain('C# or TypeScript');
    expect(text).not.toMatch(/Go AppHost|Go SDK|apphost\.go/i);
  });

  test('the new slides keep the presenter cues, reachable in the speaker view', async ({ page }) => {
    await ready(page);
    for (const [id, cue] of [['apphost-example', 'cyan legend names the package'], ['apphost-csharp', 'read the legend first'], ['go-workload', 'Go is a workload']] as const) {
      const notes = await page.locator(`#${id} aside.notes`).evaluate((node) => (node as HTMLElement).textContent?.replace(/\s+/g, ' ') ?? '');
      expect(notes, id).toContain(cue);
      await expect(page.locator(`#${id} aside.notes`)).not.toBeVisible();
    }
  });

  test('the walkthrough still steps, rewinds and keeps its package colors at every step', async ({ page }) => {
    await ready(page);
    await jump(page, 'apphost-example');
    const state = () => page.locator('#apphost-example').evaluate((node) => ({
      focus: [...node.querySelectorAll('.code-line.is-focused')].map((line) => (line as HTMLElement).dataset.line).join(','),
      tokens: node.querySelectorAll('.pkg-api').length, rails: node.querySelectorAll('.code-line[data-rail]').length,
    }));
    for (const focus of ['1', '3', '4,5', '6', '7']) {
      expect(await state()).toEqual({ focus, tokens: 2, rails: 3 });
      if (focus !== '7') { await page.keyboard.press('Space'); await settleMotion(page); }
    }
    for (const focus of ['6', '4,5', '3', '1']) {
      await page.keyboard.press('ArrowLeft');
      await settleMotion(page);
      expect(await state()).toEqual({ focus, tokens: 2, rails: 3 });
    }
  });
});
