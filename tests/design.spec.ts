import { expect, test } from '@playwright/test';
import { authorMarkdown, jump, ready, renderedIds } from './helpers';

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

test('component lists keep their own layout and are not turned into Steps', async ({ page }) => {
  await ready(page);
  await jump(page, 'model-to-observation');
  const flow = await page.locator('#model-to-observation ol > li').first().evaluate((item) => getComputedStyle(item, '::before').content);
  expect(['none', 'normal']).toContain(flow);
});

test('code and diagram share one window chrome with a custom title', async ({ page }) => {
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

test('overview shows every slide as a framed thumbnail with the current one marked', async ({ page }) => {
  await ready(page);
  await jump(page, 'make-it-yours');
  await page.keyboard.press('Escape');
  await expect(page.locator('#presentation')).toHaveClass(/overview/);
  const sections = await page.locator('.slides > section').evaluateAll((nodes) => nodes.map((node) => ({
    id: node.id, display: getComputedStyle(node).display, present: node.classList.contains('present'), ring: getComputedStyle(node).boxShadow,
  })));
  expect(sections.length).toBeGreaterThan(10);
  expect(sections.every((section) => section.display !== 'none')).toBe(true);
  const current = sections.find((section) => section.present)!;
  expect(current.id).toBe('make-it-yours');
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
