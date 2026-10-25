import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { authorDiagrams, authorMarkdown, captureClipboard, expectCopied, jump, ready, renderedIds } from './helpers';
import { starter } from './starter';

const comparison = `<!-- .slide: id="compare" class="layout-comparison" -->
## Compare like with like

<div class="comparison-columns">
  <div class="comparison-panel"><h3>First approach</h3><p>A concise explanation.</p><a href="#/intro">First link</a></div>
  <div class="comparison-panel"><h3>Second approach</h3><p>A comparable explanation.</p><a href="#/intro">Second link</a></div>
</div>`;

test('native Markdown alone opts into all three presets and dynamic navigation', async ({ page }) => {
  await authorMarkdown(page, `<!-- .slide: id="claim" class="layout-statement" -->
## One <em class="accent">clear</em> idea

One supporting thought.
<!-- .element: class="layout-support" -->

---
<!-- .slide: id="evidence" class="layout-split" -->
## Evidence beside the claim

<div class="layout-copy"><h3>The claim</h3><p>A useful explanation.</p></div>
<figure class="layout-visual"><img src="brand/aspire-icon-256.svg" alt="Official Aspire mark"><figcaption class="layout-caption">A visible caption.</figcaption></figure>

---
${comparison}`);
  await ready(page);
  expect(await renderedIds(page)).toEqual(['intro', 'claim', 'evidence', 'compare']);
  await jump(page, 'claim');
  await expect(page.locator('#claim h2')).toHaveCSS('font-size', '78px');
  await expect(page.locator('#claim .layout-support')).toHaveCSS('font-size', '32px');
  await jump(page, 'evidence');
  const boxes = await page.locator('#evidence').evaluate((slide) => {
    const copy = slide.querySelector('.layout-copy')!.getBoundingClientRect();
    const visual = slide.querySelector('.layout-visual')!.getBoundingClientRect();
    const image = slide.querySelector('img')!.getBoundingClientRect();
    return { sideBySide: copy.right < visual.left, imageShare: image.width / visual.width, aspect: image.width / image.height };
  });
  expect(boxes.sideBySide).toBe(true);
  expect(boxes.imageShare).toBeGreaterThan(0.5);
  expect(boxes.aspect).toBeCloseTo(1);
  await jump(page, 'compare');
  await expect(page.locator('#slide-position')).toHaveText('4 / 4');
});

test('comparison stacks in source and focus order on narrow screens', async ({ page }) => {
  await authorMarkdown(page, comparison);
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await page.locator('#start-presentation').click();
  const panels = await page.locator('#compare .comparison-panel').evaluateAll((nodes) => nodes.map((node) => ({
    top: node.getBoundingClientRect().top, left: node.getBoundingClientRect().left, text: node.querySelector('h3')!.textContent,
  })));
  expect(panels[1].top).toBeGreaterThan(panels[0].top);
  expect(panels[1].left).toBeCloseTo(panels[0].left);
  expect(panels.map((panel) => panel.text)).toEqual(['First approach', 'Second approach']);
  await page.locator('#compare a').first().focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('#compare a').last()).toBeFocused();
});

test('centered statement code remains left-aligned and copy-exact', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await captureClipboard(page);
  await authorMarkdown(page, '<!-- .slide: id="code-claim" class="layout-statement align-center" -->\n## A code claim\n\n```python\nprint("literal source")\n```');
  await ready(page);
  await page.locator('#start-presentation').click();
  const code = page.locator('#code-claim pre code');
  await expect(code).toHaveCSS('text-align', 'left');
  const source = await code.textContent();
  await page.locator('#code-claim .copy-code').click();
  await expectCopied(page, source);
});

for (const width of [1280, 1440]) {
  test(`split graph uses actual container fallback and reachable content at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await authorDiagrams(page);
    await authorMarkdown(page, '<!-- .slide: id="column-graph" class="layout-split" -->\n## A model beside context\n<div class="layout-copy"><p>A short explanation.</p></div>\n<div class="layout-visual" data-diagram="architecture"></div>');
    await ready(page);
    await page.locator('#start-presentation').click();
    const visual = page.locator('#column-graph .layout-visual');
    expect((await visual.boundingBox())!.width).toBeLessThan(800);
    await expect(visual.locator('.architecture-svg')).not.toBeVisible();
    const fallback = visual.locator('.architecture-mobile');
    await expect(fallback).toBeVisible();
    await expect(fallback.locator('[data-mobile-node]')).toHaveCount(4);
    await expect(fallback.locator('[data-mobile-edge]')).toHaveCount(4);
    await expect(fallback.locator('.graph-node-list p').first()).toHaveCSS('font-size', '20px');
    expect(await fallback.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
    await fallback.focus();
    await page.keyboard.press('PageDown');
    await expect.poll(() => fallback.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
    await expect(page.locator('#slide-position')).toHaveText('2 / 2');
    await page.locator('#presentation').focus();
    await page.keyboard.press('r');
    await expect(fallback).toHaveCSS('max-height', 'none');
    await page.goto('?print-pdf');
    await expect(page.locator('html')).toHaveAttribute('data-deck-ready', 'true');
    await page.locator('.pdf-page').first().waitFor({ state: 'attached' });
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('#column-graph .architecture-mobile')).toHaveCSS('max-height', 'none');
    expect(await page.locator('#column-graph .architecture-mobile').evaluate((node) => node.scrollHeight <= node.clientHeight + 1)).toBe(true);
  });
}

test('starter presets preserve source contrast and visible controls in both themes', starter, async ({ page }) => {
  await ready(page);
  for (const theme of ['light', 'dark']) {
    if (await page.locator('html').getAttribute('data-theme') !== theme) await page.keyboard.press('t');
    for (const id of ['statement-layout', 'split-layout', 'comparison-layout']) {
      await jump(page, id);
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(result.violations).toEqual([]);
      await expect(page.locator('#toolbar')).toHaveCSS('height', '56px');
    }
  }
});
