import { expect, test, type Page } from '@playwright/test';
import { jump, ready, renderedIds, settleMotion } from './helpers';

type Exposure = { boxes: string[]; arrows: string[] };
// Native fragments on slides that are not diagrams: bullet reveals, stepped code lines, and the terminal output.
const plainFragments: Record<string, number> = { 'reveal-the-story': 3, 'apphost-example': 4, 'run-and-reveal': 1 };
const states: Record<string, Exposure[]> = {
  'rich-architecture': [
    { boxes: ['model'], arrows: [] },
    { boxes: ['model'], arrows: ['declare'] },
    { boxes: ['model', 'api'], arrows: ['declare'] },
    { boxes: ['model', 'api'], arrows: ['declare', 'read'] },
    { boxes: ['model', 'api', 'cache'], arrows: ['declare', 'read'] },
    { boxes: ['model', 'api', 'cache'], arrows: ['declare', 'read', 'result'] },
    { boxes: ['model', 'api', 'cache', 'web'], arrows: ['declare', 'read', 'result'] },
    { boxes: ['model', 'api', 'cache', 'web'], arrows: ['declare', 'read', 'result', 'request'] },
  ],
  'model-to-observation': [
    { boxes: ['Model'], arrows: [] },
    { boxes: ['Model'], arrows: ['arrow-1'] },
    { boxes: ['Model', 'Resources'], arrows: ['arrow-1'] },
    { boxes: ['Model', 'Resources'], arrows: ['arrow-1', 'arrow-2'] },
    { boxes: ['Model', 'Resources', 'Observation'], arrows: ['arrow-1', 'arrow-2'] },
  ],
  'animate-a-model': [
    { boxes: ['Frontend'], arrows: [] },
    { boxes: ['Frontend'], arrows: ['example-web-api'] },
    { boxes: ['Frontend', 'API'], arrows: ['example-web-api'] },
  ],
  'animate-add-cache': [
    { boxes: ['Frontend', 'API'], arrows: ['example-web-api'] },
    { boxes: ['Frontend', 'API'], arrows: ['example-web-api', 'example-api-cache'] },
    { boxes: ['Frontend', 'API', 'Cache'], arrows: ['example-web-api', 'example-api-cache'] },
  ],
};

async function exposure(page: Page, id: string): Promise<Exposure> {
  return page.locator(`#${id}`).evaluate((slide) => {
    const visible = (node: Element) => {
      const rect = node.getBoundingClientRect();
      if (!rect.width || !rect.height) return false;
      for (let item: Element | null = node; item && item !== slide.parentElement; item = item.parentElement) {
        const style = getComputedStyle(item);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) < 0.99) return false;
      }
      return true;
    };
    const svg = slide.querySelector('svg.architecture-svg');
    const scope = svg && visible(svg) ? svg : slide.querySelector('.architecture-mobile') ?? slide;
    const boxes = [...scope.querySelectorAll<HTMLElement | SVGElement>('.graph-node, [data-mobile-node], .diagram-node')].filter(visible)
      .map((node) => node.dataset.node ?? node.dataset.mobileNode ?? node.querySelector('h3')!.textContent!.trim());
    const arrows = [...scope.querySelectorAll<HTMLElement | SVGElement>('.graph-edge, [data-mobile-edge], .diagram-connector')].map((node, index) => ({
      node, name: node.dataset.edge ?? node.dataset.mobileEdge ?? node.dataset.id ?? `arrow-${index + 1}`,
    })).filter(({ node }) => visible(node)).map(({ name }) => name);
    return { boxes, arrows };
  });
}

async function stepFits(page: Page, id: string) {
  const errors = await page.locator(`#${id}`).evaluate((slide) => {
    const errors: string[] = [];
    for (const node of slide.querySelectorAll('.current-fragment')) {
      const bounds = node.getBoundingClientRect();
      if (!bounds.width || !bounds.height || getComputedStyle(node).visibility === 'hidden') continue;
      const region = node.closest('.architecture-mobile');
      const scroller = region && getComputedStyle(region).overflowY === 'auto' ? region : document.getElementById('slide-viewport')!;
      const frame = scroller.getBoundingClientRect();
      if (bounds.top < frame.top - 1 || bounds.top >= frame.bottom || bounds.left < frame.left - 1 || bounds.right > frame.right + 1) {
        errors.push(`${node.getAttribute('data-stage') ?? node.className}: revealed step outside its actual viewport`);
      }
      if (bounds.height <= frame.height - 48 && bounds.bottom > frame.bottom + 1) errors.push('revealed step clipped below viewport');
    }
    return errors;
  });
  expect(errors).toEqual([]);
}

for (const scene of [
  { name: 'desktop-light', width: 1280, height: 720, theme: 'light' },
  { name: 'desktop-dark', width: 1280, height: 720, theme: 'dark' },
  { name: 'narrow-dark', width: 617, height: 800, theme: 'dark' },
  { name: 'phone-present-light', width: 390, height: 844, theme: 'light' },
]) {
  test(`every slide and every forward/back exposure is correct in ${scene.name}`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: scene.width, height: scene.height });
    await ready(page, `?mode=present&theme=${scene.theme}`);
    const ids = await renderedIds(page);
    const counts: number[] = [];
    for (const [index, id] of ids.entries()) {
      await settleMotion(page);
      await expect(page.locator(`#${id}`)).toHaveClass(/present/);
      await expect(page.locator('#slide-position')).toHaveText(`${index + 1} / ${ids.length}`);
      const count = await page.locator(`#${id} .fragment`).evaluateAll((nodes) => new Set(nodes.map((node) => node.getAttribute('data-fragment-index'))).size);
      counts.push(count);
      const expected = states[id];
      if (expected) {
        expect(count).toBe(expected.length - 1);
        expect(await exposure(page, id), `${id} initial`).toEqual(expected[0]);
      } else {
        expect(count).toBe(plainFragments[id] ?? 0);
      }
      for (let step = 1; step <= count; step++) {
        await page.locator('#next').click();
        await settleMotion(page);
        if (expected) expect(await exposure(page, id), `${id} forward ${step}`).toEqual(expected[step]);
        await stepFits(page, id);
        if (scene.name === 'desktop-dark' && expected) await page.screenshot({ path: testInfo.outputPath(`${id}-step-${step}.png`) });
      }
      if (index < ids.length - 1) await page.locator('#next').click();
    }
    for (let index = ids.length - 1; index >= 0; index--) {
      const id = ids[index];
      const count = counts[index];
      const expected = states[id];
      await settleMotion(page);
      await expect(page.locator(`#${id}`)).toHaveClass(/present/);
      await expect(page.locator('#slide-position')).toHaveText(`${index + 1} / ${ids.length}`);
      if (expected) expect(await exposure(page, id), `${id} returned from next slide`).toEqual(expected.at(-1));
      for (let step = count - 1; step >= 0; step--) {
        await page.locator('#previous').click();
        await settleMotion(page);
        if (expected) expect(await exposure(page, id), `${id} backward ${step}`).toEqual(expected[step]);
        await stepFits(page, id);
      }
      if (expected) expect(await exposure(page, id)).toEqual(expected[0]);
      if (index > 0) await page.locator('#previous').click();
    }
  });
}

test('auto-animate keeps completed context but exposes the added arrow before its cache box', async ({ page }) => {
  await ready(page);
  await jump(page, 'animate-a-model');
  for (let index = 1; index < states['animate-a-model'].length; index++) {
    await page.keyboard.press('Space');
    await settleMotion(page);
    expect(await exposure(page, 'animate-a-model')).toEqual(states['animate-a-model'][index]);
  }
  await page.keyboard.press('Space');
  await expect(page.locator('#animate-add-cache')).toHaveClass(/present/);
  await expect(page.locator('#animate-add-cache')).toHaveAttribute('data-auto-animate', 'running');
  await settleMotion(page);
  expect(await exposure(page, 'animate-add-cache')).toEqual(states['animate-add-cache'][0]);
  await page.keyboard.press('Space');
  await settleMotion(page);
  expect(await exposure(page, 'animate-add-cache')).toEqual(states['animate-add-cache'][1]);
  await page.keyboard.press('Space');
  await settleMotion(page);
  expect(await exposure(page, 'animate-add-cache')).toEqual(states['animate-add-cache'][2]);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await settleMotion(page);
  await expect(page.locator('#animate-a-model')).toHaveClass(/present/);
  expect(await exposure(page, 'animate-a-model')).toEqual(states['animate-a-model'].at(-1));
});

test('rapid advance finishes the arrow before exposing its target and rapid rewind leaves no ghosts', async ({ page }) => {
  await ready(page);
  await jump(page, 'rich-architecture');
  await page.keyboard.press('Space');
  await page.keyboard.press('Space');
  await expect(page.locator('#rich-architecture .architecture-svg [data-node="api"]')).toBeVisible();
  await expect(page.locator('#rich-architecture .architecture-svg [data-edge="declare"] .edge-path')).toHaveCSS('stroke-dashoffset', '0px');
  await expect(page.locator('#rich-architecture .architecture-svg [data-edge="declare"] .arrow-head')).toHaveCSS('opacity', '1');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  expect(await exposure(page, 'rich-architecture')).toEqual(states['rich-architecture'][0]);
});

test('solid arrows actually draw before their tip and caption, without exposing the destination', async ({ page }) => {
  await ready(page);
  await jump(page, 'rich-architecture');
  await page.locator('#next').click();
  const sample = await page.locator('#rich-architecture .architecture-svg [data-edge="declare"]').evaluate(async (edge) => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const path = edge.querySelector('.edge-path')!;
    const line = path.getAnimations().find((animation) => animation instanceof CSSTransition && animation.transitionProperty === 'stroke-dashoffset');
    if (!line) throw new Error('Expected a real stroke-dashoffset transition, not only a fragment class.');
    line.pause();
    line.currentTime = 225;
    for (const node of edge.querySelectorAll('.arrow-head, .edge-label')) {
      for (const animation of node.getAnimations()) {
        animation.pause();
        animation.currentTime = 225;
      }
    }
    return {
      dash: parseFloat(getComputedStyle(path).strokeDasharray),
      offset: parseFloat(getComputedStyle(path).strokeDashoffset),
      tip: getComputedStyle(edge.querySelector('.arrow-head')!).opacity,
      caption: getComputedStyle(edge.querySelector('.edge-label')!).opacity,
    };
  });
  expect(sample.dash).toBe(1);
  expect(sample.offset).toBeGreaterThan(0);
  expect(sample.offset).toBeLessThan(1);
  expect(sample.tip).toBe('0');
  expect(sample.caption).toBe('0');
  await expect(page.locator('#rich-architecture .architecture-svg [data-node="api"]')).not.toBeVisible();
});

test('named and numeric fragment deep links, reload and history restore exact exposure', async ({ page }) => {
  await ready(page, '?mode=present#/rich-architecture/2');
  await settleMotion(page);
  expect(await exposure(page, 'rich-architecture')).toEqual(states['rich-architecture'][3]);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-deck-ready', 'true');
  await settleMotion(page);
  expect(await exposure(page, 'rich-architecture')).toEqual(states['rich-architecture'][3]);
  await page.locator('#next').click();
  await settleMotion(page);
  expect(await exposure(page, 'rich-architecture')).toEqual(states['rich-architecture'][4]);
  await page.goBack();
  await settleMotion(page);
  expect(await exposure(page, 'rich-architecture')).toEqual(states['rich-architecture'][3]);
  // Reveal's numeric hash is positional (#/slide/vertical/fragment), so derive the index instead of hard-coding it.
  const position = (await renderedIds(page)).indexOf('rich-architecture');
  expect(position).toBeGreaterThan(0);
  await page.goto(`?mode=present#/${position}/0/0`);
  await expect(page.locator('html')).toHaveAttribute('data-deck-ready', 'true');
  await settleMotion(page);
  expect(await exposure(page, 'rich-architecture')).toEqual(states['rich-architecture'][1]);
  await page.evaluate(() => { location.hash = '/rich-architecture'; });
  await settleMotion(page);
  await expect.poll(() => exposure(page, 'rich-architecture')).toEqual(states['rich-architecture'][0]);
  await page.evaluate(() => { location.hash = '/rich-architecture/not-a-number'; });
  await expect(page.locator('#deck-status')).toContainText('Invalid fragment index');
  expect(await exposure(page, 'rich-architecture')).toEqual(states['rich-architecture'][0]);
});

for (const mode of ['read', 'reduced', 'print']) {
  test(`${mode} exposes every node, arrow and caption without waiting`, async ({ page }) => {
    if (mode === 'reduced') await page.emulateMedia({ reducedMotion: 'reduce' });
    if (mode === 'read') await page.setViewportSize({ width: 390, height: 844 });
    await ready(page, mode === 'print' ? '?print-pdf' : `?mode=${mode === 'read' ? 'read' : 'present'}`);
    if (mode === 'print') {
      await page.locator('.pdf-page').first().waitFor({ state: 'attached' });
      await page.emulateMedia({ media: 'print' });
    }
    for (const id of Object.keys(states)) {
      if (mode !== 'print') await jump(page, id);
      expect(await exposure(page, id)).toEqual(states[id].at(-1));
    }
    await expect(page.locator('#rich-architecture .edge-path').first()).toHaveCSS('stroke-dashoffset', '0px');
    await expect(page.locator('#rich-architecture .arrow-head').first()).toHaveCSS('opacity', '1');
  });
}
