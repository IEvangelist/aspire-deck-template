import { expect, test, type Page } from '@playwright/test';
import { authorDiagrams, authorMarkdown, jump, ready, renderedIds, settleMotion } from './helpers';
import { starter } from './starter';

const designed = `<!-- .slide: id="designed" data-kicker="Plan" -->
## Make a **plan**

1. **First.** Write the claim.
2. **Second.** Add the evidence.
3. **Third.** Leave a next step.

<div class="card-row">
  <div class="card"><span data-icon="rocket"></span><h3>Card title</h3><p>Short supporting text</p></div>
</div>

---

<!-- .slide: id="plain" -->
## Plain slide

A paragraph without a kicker.

<div data-diagram="architecture" data-caption="Custom window title"></div>`;

test('kickers, accented headings and the Steps rail come from native Markdown alone', async ({ page }) => {
  await authorDiagrams(page);
  await authorMarkdown(page, designed);
  await ready(page);
  await jump(page, 'designed');
  await expect(page.locator('#designed .slide-kicker')).toHaveText('Plan');
  await expect(page.locator('#plain .slide-kicker')).toHaveCount(0);
  const heading = await page.locator('#designed h2').evaluate((h2) => {
    const strong = h2.querySelector('strong')!;
    return { weight: getComputedStyle(strong).fontWeight, headingWeight: getComputedStyle(h2).fontWeight, color: getComputedStyle(strong).color, ink: getComputedStyle(h2).color };
  });
  expect(heading.weight).toBe(heading.headingWeight);
  expect(heading.color).not.toBe(heading.ink);
  const steps = await page.locator('#designed ol > li').evaluateAll((items) => items.map((item) => {
    const marker = getComputedStyle(item, '::before');
    return { content: marker.content, width: marker.width, radius: marker.borderRadius, increment: getComputedStyle(item).counterIncrement, title: getComputedStyle(item.querySelector('strong')!).display };
  }));
  expect(steps.map((step) => step.content)).toEqual(['counter(step)', 'counter(step)', 'counter(step)']);
  expect(steps.every((step) => step.width === '56px' && step.radius === '50%' && step.title === 'block' && step.increment === 'step 1')).toBe(true);
  expect(await page.locator('#designed ol').evaluate((list) => getComputedStyle(list).counterReset)).toBe('step 0');
  const card = await page.locator('#designed .card').evaluate((node) => ({
    radius: getComputedStyle(node).borderRadius,
    icon: getComputedStyle(node.querySelector('[data-icon]')!).width,
    svg: getComputedStyle(node.querySelector('svg')!).width,
  }));
  expect(card).toEqual({ radius: '16px', icon: '64px', svg: '32px' });
});

test('component lists keep their own layout and are not turned into Steps', starter, async ({ page }) => {
  await ready(page);
  await jump(page, 'model-to-observation');
  const flow = await page.locator('#model-to-observation ol > li').first().evaluate((item) => getComputedStyle(item, '::before').content);
  expect(['none', 'normal']).toContain(flow);
});

test('code and diagram share one window chrome with a custom title', async ({ page }) => {
  await authorDiagrams(page);
  await authorMarkdown(page, designed.replace('1. **First.**', '```bash\nnpm test\n```\n\n1. **First.**'));
  await ready(page);
  await jump(page, 'designed');
  const dots = await page.locator('#designed .code-panel figcaption').evaluate((caption) => {
    const dotsStyle = getComputedStyle(caption, '::before');
    return { width: dotsStyle.width, height: dotsStyle.height, circles: (dotsStyle.backgroundImage.match(/radial-gradient/g) ?? []).length };
  });
  expect(dots).toEqual({ width: '44px', height: '10px', circles: 3 });
  await jump(page, 'plain');
  await expect(page.locator('#plain .window-title')).toHaveText('Custom window title');
  await expect(page.locator('#plain .window-dots')).toBeVisible();
  const chrome = await page.locator('#plain .window-chrome').getAttribute('aria-hidden');
  expect(chrome).toBe('true');
});

test('the aspire.dev hero grid appears only behind the title slide and never prints', async ({ page }) => {
  await ready(page);
  const grid = () => page.locator('#presentation').evaluate((root) => {
    const style = getComputedStyle(root, '::after');
    return { opacity: Number(style.opacity), image: style.backgroundImage, size: style.backgroundSize, display: style.display };
  });
  await expect(page.locator('html')).toHaveAttribute('data-intro', 'true');
  await expect.poll(async () => (await grid()).opacity).toBe(1);
  const intro = await grid();
  expect(intro.size).toBe('72px 72px, 72px 72px');
  expect((intro.image.match(/linear-gradient/g) ?? []).length).toBe(2);
  await page.locator('#start-presentation').click();
  await expect(page.locator('html')).toHaveAttribute('data-intro', 'false');
  await expect.poll(async () => (await grid()).opacity).toBe(0);
  await jump(page, (await renderedIds(page))[0]);
  await expect.poll(async () => (await grid()).opacity).toBe(1);
  await page.emulateMedia({ media: 'print' });
  expect((await grid()).display).toBe('none');
});

test('the menu keeps its heading and controls visible while only the slide list scrolls', async ({ page }) => {
  for (const [width, height] of [[1280, 560], [1280, 720], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await ready(page);
    await page.locator('#menu-toggle').click();
    const metrics = await page.locator('#deck-menu').evaluate((dialog) => {
      const box = dialog.getBoundingClientRect();
      const list = dialog.querySelector('.menu-slides')!;
      const controls = [...dialog.querySelectorAll('.menu-controls > *')].map((control) => control.getBoundingClientRect());
      return {
        dialogScrolls: dialog.scrollHeight > dialog.clientHeight + 1,
        listScrolls: list.scrollHeight > list.clientHeight + 1,
        controlsInside: controls.every((rect) => rect.top >= box.top && rect.bottom <= box.bottom && rect.height >= 43.5),
        columns: getComputedStyle(dialog.querySelector('.menu-controls')!).gridTemplateColumns.split(' ').length,
        fits: box.top >= 0 && box.bottom <= innerHeight,
      };
    });
    expect(metrics, `${width}x${height}`).toMatchObject({ dialogScrolls: false, listScrolls: true, controlsInside: true, fits: true });
    if (width === 390) expect(metrics.columns).toBe(1);
    await expect(page.locator('#menu-summary')).toHaveText(`${(await renderedIds(page)).length} slides`);
    await page.keyboard.press('Escape');
  }
});

// Every top-level slide in the overview, with the one that is showing.
async function overviewSections(page: Page, target: string) {
  await jump(page, target);
  await page.keyboard.press('Escape');
  await expect(page.locator('#presentation')).toHaveClass(/overview/);
  const sections = await page.locator('.slides > section').evaluateAll((nodes) => nodes.map((node) => ({
    id: node.id, display: getComputedStyle(node).display, present: node.classList.contains('present'), ring: getComputedStyle(node).boxShadow,
  })));
  return { sections, current: sections.find((section) => section.present)! };
}

test('overview shows every slide as a framed thumbnail with the current one marked', starter, async ({ page }) => {
  await ready(page);
  const { sections, current } = await overviewSections(page, 'make-it-yours');
  expect(sections.length).toBeGreaterThan(10);
  expect(sections.every((section) => section.display !== 'none')).toBe(true);
  expect(current.id).toBe('make-it-yours');
  expect(sections.filter((section) => section.ring === current.ring)).toHaveLength(1);
});

test('overview shows every slide as a framed thumbnail with the current one marked in an authored deck', async ({ page }) => {
  await authorMarkdown(page, ['one', 'two', 'three', 'four'].map((id) => `<!-- .slide: id="${id}" -->\n## Slide ${id}\n`).join('\n---\n\n'));
  await ready(page);
  const { sections, current } = await overviewSections(page, 'three');
  expect(sections.map((section) => section.id)).toEqual(['intro', 'one', 'two', 'three', 'four']);
  expect(sections.every((section) => section.display !== 'none')).toBe(true);
  expect(current.id).toBe('three');
  expect(sections.filter((section) => section.ring === current.ring)).toHaveLength(1);
});

test('a Markdown blockquote becomes a contained quote panel at every width', async ({ page }) => {
  await authorMarkdown(page, '<!-- .slide: id="quote" -->\n## A quote\n\n> Good slides leave room for the speaker.\n\nA closing line.');
  for (const [width, height] of [[1280, 720], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await ready(page);
    await jump(page, 'quote');
    const quote = await page.locator('#quote blockquote').evaluate((node) => {
      const box = node.getBoundingClientRect();
      const slide = node.closest('section')!.getBoundingClientRect();
      const mark = getComputedStyle(node, '::before');
      return { inside: box.left >= slide.left && box.right <= slide.right + 1, radius: getComputedStyle(node).borderRadius, mark: mark.content, markColor: mark.color, bg: getComputedStyle(node).backgroundColor };
    });
    expect(quote, `${width}px`).toMatchObject({ inside: true, radius: '16px', mark: '"“"' });
    expect(quote.bg).not.toBe('rgba(0, 0, 0, 0)');
  }
});

test('every slide prints on exactly one page, including centered statements and window chrome', async ({ page }) => {
  await ready(page, '?print-pdf&theme=light');
  await page.locator('.pdf-page').first().waitFor({ state: 'attached' });
  const expected = await page.locator('#slide-list a').count();
  await expect.poll(() => page.locator('.pdf-page').count()).toBe(expected);
  const heights = await page.locator('.pdf-page').evaluateAll((pages) => pages.map((node) => Math.round(node.getBoundingClientRect().height)));
  expect(new Set(heights).size, `page heights ${heights.join(', ')}`).toBe(1);
});

test('a print load never prepares the deck before Reveal has built its pages, load after load', async ({ browser }) => {
  test.setTimeout(120_000);
  // Reveal moves every slide into a .pdf-page a few animation frames after initialize() resolves, and until then the deck
  // holds only part of its slides. A boot that takes just long enough is caught in that one-frame window, which busy
  // machines hit often, so this loads the print view 40 times, four at a time, each in a fresh browser context.
  const { baseURL } = test.info().project.use;
  const deck = '<!-- .slide: id="graph" -->\n## A model\n<div data-diagram="architecture"></div>\n\n---\n<!-- .slide: id="after" -->\n## After\n';
  const failures: string[] = [];
  let next = 0;
  const load = async (attempt: number) => {
    const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 900 } });
    try {
      const page = await context.newPage();
      await authorDiagrams(page);
      await authorMarkdown(page, deck);
      await page.goto('?print-pdf&theme=light');
      const state = await (await page.waitForFunction(() => document.documentElement.dataset.deckReady, null, { timeout: 10_000 })).jsonValue();
      const pages = await page.locator('.pdf-page').count();
      if (state !== 'true' || pages !== 3) failures.push(`load ${attempt}: deck ${state}, ${pages} pages`);
    } finally {
      await context.close();
    }
  };
  await Promise.all(Array.from({ length: 4 }, async () => { while (next < 40) await load(++next); }));
  expect(failures).toEqual([]);
});

// How far each connector's centre is from the middle of the gap it bridges (or, when the cards stack, from the
// card's centre line and the gap above it). Reveal's auto-animate rewrites `transform` on matched elements, so this
// is measured after a real keyboard-driven transition rather than on a fresh load.
async function connectorOffsets(page: Page, id: string) {
  return page.locator(`#${id}`).evaluate((slide) => [...slide.querySelectorAll<HTMLElement>('.diagram-connector')].map((connector) => {
    const item = connector.closest('li')!;
    const card = item.querySelector('.diagram-node')!.getBoundingClientRect();
    const before = item.previousElementSibling!.querySelector('.diagram-node')!.getBoundingClientRect();
    const box = connector.getBoundingClientRect();
    const stacked = card.top >= before.bottom - 1;
    const target = stacked
      ? { x: card.left + card.width / 2, y: (before.bottom + card.top) / 2 }
      : { x: (before.right + card.left) / 2, y: card.top + card.height / 2 };
    return {
      id: connector.dataset.id ?? '', stacked,
      dx: box.left + box.width / 2 - target.x, dy: box.top + box.height / 2 - target.y,
      glyph: getComputedStyle(connector.querySelector('svg')!).rotate,
    };
  }));
}

const worstOffset = (offsets: { dx: number; dy: number }[]) => Math.max(0, ...offsets.flatMap((offset) => [Math.abs(offset.dx), Math.abs(offset.dy)]));

test('flow connectors are bare accent arrows, with no circle, ring or badge', starter, async ({ page }) => {
  await ready(page);
  for (const id of ['model-to-observation', 'animate-add-cache']) {
    await jump(page, id);
    const chrome = await page.locator(`#${id} .diagram-connector`).evaluateAll((connectors) => connectors.map((connector) => {
      const style = getComputedStyle(connector);
      return {
        radius: style.borderTopLeftRadius, shadow: style.boxShadow, background: style.backgroundColor, border: style.borderTopWidth,
        outline: style.outlineStyle, glyph: getComputedStyle(connector.querySelector('svg')!).width, color: style.color,
        accent: getComputedStyle(document.querySelector('.slide-kicker')!).color,
      };
    }));
    expect(chrome.length, id).toBeGreaterThan(0);
    for (const connector of chrome) {
      expect(connector, id).toMatchObject({ radius: '0px', shadow: 'none', background: 'rgba(0, 0, 0, 0)', border: '0px', outline: 'none', glyph: '32px' });
      expect(connector.color, 'the arrow keeps the accent colour').toBe(connector.accent);
    }
  }
});

for (const [width, height] of [[1280, 720], [1920, 1080]]) {
  test(`flow arrows stay centred in the gap after a real auto-animate transition at ${width}px`, starter, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await ready(page);
    await jump(page, 'animate-a-model');
    for (let step = 0; step < 3; step++) {
      await page.keyboard.press('Space');
      await settleMotion(page);
    }
    await expect(page.locator('#animate-add-cache')).toHaveClass(/present/);
    await expect.poll(async () => worstOffset(await connectorOffsets(page, 'animate-add-cache')), { message: 'the carried-over arrow must be re-centred once the move ends' }).toBeLessThanOrEqual(1);
    for (let step = 0; step < 2; step++) {
      await page.keyboard.press('Space');
      await settleMotion(page);
    }
    await expect.poll(async () => (await connectorOffsets(page, 'animate-add-cache')).length).toBe(2);
    await expect.poll(async () => worstOffset(await connectorOffsets(page, 'animate-add-cache'))).toBeLessThanOrEqual(1);
  });
}

test('flow arrows stay centred and point down when the cards stack on a phone', starter, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await jump(page, 'animate-a-model');
  for (let step = 0; step < 3; step++) {
    await page.locator('#next').click();
    await settleMotion(page);
  }
  await expect(page.locator('#animate-add-cache')).toHaveClass(/present/);
  for (let step = 0; step < 2; step++) {
    await page.locator('#next').click();
    await settleMotion(page);
  }
  await expect.poll(async () => (await connectorOffsets(page, 'animate-add-cache')).length).toBe(2);
  await expect.poll(async () => worstOffset(await connectorOffsets(page, 'animate-add-cache'))).toBeLessThanOrEqual(1);
  const stacked = await connectorOffsets(page, 'animate-add-cache');
  expect(stacked.every((offset) => offset.stacked && offset.glyph === '90deg')).toBe(true);
});

test('reading mode shows every flow arrow, centred', starter, async ({ page }) => {
  await ready(page, '?mode=read');
  for (const id of ['model-to-observation', 'animate-a-model', 'animate-add-cache']) {
    const offsets = await connectorOffsets(page, id);
    expect(offsets.length, id).toBeGreaterThan(0);
    expect(worstOffset(offsets), id).toBeLessThanOrEqual(1);
    const hidden = await page.locator(`#${id} .diagram-connector`).evaluateAll((nodes) => nodes.filter((node) => getComputedStyle(node).opacity !== '1').length);
    expect(hidden, `${id}: reading mode must not wait for a reveal`).toBe(0);
  }
});
