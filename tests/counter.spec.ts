import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { parseDeckConfig, slideNumberPositions, type SlideNumberPosition } from '../src/config';
import { assetRequest, authorMarkdown, contrastOf, exampleMarkdown, expectContrast, jump, ready, renderedIds } from './helpers';

const minimal = { title: 'A talk', presenter: { name: 'A presenter' } };

test.describe('slideNumber in deck.config.json', () => {
  test('omitting it shows the counter at the bottom left', () => {
    expect(parseDeckConfig(minimal).slideNumber).toEqual({ visible: true, position: 'bottom-left' });
    expect(parseDeckConfig({ ...minimal, slideNumber: {} }).slideNumber).toEqual({ visible: true, position: 'bottom-left' });
  });

  test('each field is optional and the other keeps its default', () => {
    expect(parseDeckConfig({ ...minimal, slideNumber: { visible: false } }).slideNumber).toEqual({ visible: false, position: 'bottom-left' });
    expect(parseDeckConfig({ ...minimal, slideNumber: { position: 'top-right' } }).slideNumber).toEqual({ visible: true, position: 'top-right' });
  });

  test('exactly four corners are supported', () => {
    expect([...slideNumberPositions]).toEqual(['top-left', 'top-right', 'bottom-left', 'bottom-right']);
    for (const position of slideNumberPositions) {
      expect(parseDeckConfig({ ...minimal, slideNumber: { visible: true, position } }).slideNumber).toEqual({ visible: true, position });
    }
  });

  const invalid: [string, unknown, string][] = [
    ['visible as a string', { visible: 'false' }, 'deck.config.json: slideNumber.visible must be true or false.'],
    ['visible as a number', { visible: 1 }, 'deck.config.json: slideNumber.visible must be true or false.'],
    ['visible as null', { visible: null }, 'deck.config.json: slideNumber.visible must be true or false.'],
    ['a position that is not a corner', { position: 'center' }, 'deck.config.json: slideNumber.position must be one of top-left, top-right, bottom-left, bottom-right.'],
    ['a position in the wrong case', { position: 'Bottom-Left' }, 'deck.config.json: slideNumber.position must be one of'],
    ['an empty position', { position: '' }, 'deck.config.json: slideNumber.position must be one of'],
    ['a position that is not a string', { position: 3 }, 'deck.config.json: slideNumber.position must be one of'],
    ['an unknown field', { color: 'red' }, 'deck.config.json: slideNumber.color is not a supported field.'],
    ['a misspelled field', { visble: false }, 'deck.config.json: slideNumber.visble is not a supported field.'],
    ['a boolean instead of an object', true, 'deck.config.json: slideNumber must be an object.'],
    ['an array instead of an object', [], 'deck.config.json: slideNumber must be an object.'],
    ['null instead of an object', null, 'deck.config.json: slideNumber must be an object.'],
  ];
  for (const [name, slideNumber, message] of invalid) {
    test(`${name} fails with the file and field named`, () => {
      expect(() => parseDeckConfig({ ...minimal, slideNumber })).toThrow(message);
    });
  }
});

// Serves the real starter config with only slideNumber replaced (or removed, to prove the default).
async function configured(page: Page, slideNumber?: unknown) {
  await page.route(assetRequest('deck.config.json'), async (route) => {
    const response = await route.fetch();
    const config = JSON.parse(await response.text());
    if (slideNumber === undefined) delete config.slideNumber;
    else config.slideNumber = slideNumber;
    await route.fulfill({ response, contentType: 'application/json', body: JSON.stringify(config) });
  });
}

const frames = (page: Page) => page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));

interface Badge {
  text: string;
  label: string | null;
  position: string | null;
  left: number; top: number; right: number; bottom: number; width: number; height: number;
  viewport: { width: number; height: number };
  toolbarBottom: number;
  background: string; color: string; shadow: string; border: string; font: string; pointer: string; display: string; layout: string;
  inToolbar: boolean; overflow: boolean;
}

function badgeOf(page: Page): Promise<Badge> {
  return page.evaluate(() => {
    const badge = document.getElementById('slide-position')!;
    const rect = badge.getBoundingClientRect();
    const style = getComputedStyle(badge);
    const width = document.documentElement.clientWidth;
    const height = document.documentElement.clientHeight;
    return {
      text: badge.textContent ?? '', label: badge.getAttribute('aria-label'), position: badge.getAttribute('data-position'),
      left: rect.left, top: rect.top, right: width - rect.right, bottom: height - rect.bottom, width: rect.width, height: rect.height,
      viewport: { width, height },
      toolbarBottom: document.getElementById('toolbar')!.getBoundingClientRect().bottom,
      background: style.backgroundColor, color: style.color, shadow: style.boxShadow, border: `${style.borderTopWidth} ${style.borderTopStyle} ${style.borderTopColor}`,
      font: style.fontFamily, pointer: style.pointerEvents, display: style.display, layout: style.position,
      inToolbar: document.getElementById('toolbar')!.contains(badge),
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
}

const sides = (width: number) => (width <= 600 ? 12 : 20);

test.describe('the counter is a fixed corner badge', () => {
  test('without slideNumber it is visible at the bottom left', async ({ page }) => {
    await configured(page);
    await ready(page);
    const ids = await renderedIds(page);
    const badge = await badgeOf(page);
    expect(badge).toMatchObject({ text: `1 / ${ids.length}`, position: 'bottom-left', layout: 'fixed', inToolbar: false });
    await expect(page.locator('#slide-position')).toBeVisible();
    expect(badge.left).toBeCloseTo(20, 0);
    expect(badge.bottom).toBeCloseTo(14, 0);
  });

  test('the config the deck ships with decides the corner and visibility', async ({ page }) => {
    await ready(page);
    const { slideNumber } = parseDeckConfig(JSON.parse(readFileSync('deck.config.json', 'utf8')));
    await expect(page.locator('#slide-position')).toHaveAttribute('data-position', slideNumber.position);
    if (slideNumber.visible) await expect(page.locator('#slide-position')).toBeVisible();
    else await expect(page.locator('#slide-position')).toBeHidden();
  });

  for (const position of slideNumberPositions) {
    for (const mode of ['present', 'read'] as const) {
      for (const theme of ['light', 'dark'] as const) {
        test(`${position} stays in the viewport, opaque and readable: ${mode}, ${theme}`, async ({ page }) => {
          await configured(page, { visible: true, position });
          await ready(page, `?mode=${mode}&theme=${theme}`);
          for (const [width, height] of [[1440, 900], [1280, 720], [390, 844], [320, 480]]) {
            await page.setViewportSize({ width, height });
            await frames(page);
            const badge = await badgeOf(page);
            const where = `${position} ${mode} ${theme} ${width}x${height}`;
            expect(badge.position, where).toBe(position);
            expect(badge.left, `${where}: left`).toBeGreaterThanOrEqual(0);
            expect(badge.top, `${where}: top`).toBeGreaterThanOrEqual(0);
            expect(badge.right, `${where}: right`).toBeGreaterThanOrEqual(0);
            expect(badge.bottom, `${where}: bottom`).toBeGreaterThanOrEqual(0);
            expect(badge.overflow, `${where}: page overflow`).toBe(false);
            const side = sides(width);
            if (position.endsWith('left')) expect(badge.left, `${where}: left inset`).toBeCloseTo(side, 0);
            else expect(badge.right, `${where}: right inset`).toBeCloseTo(side, 0);
            if (position.startsWith('top')) {
              expect(badge.top - badge.toolbarBottom, `${where}: gap below the toolbar`).toBeCloseTo(14, 0);
            } else {
              expect(badge.bottom, `${where}: bottom inset`).toBeCloseTo(14, 0);
            }
            expect(badge.height, where).toBeCloseTo(width <= 600 ? 28 : 32, 0);
            expect(badge.layout).toBe('fixed');
            expect(badge.pointer).toBe('none');
            expect(badge.font).toContain('Fira Code');
            expect(badge.shadow, `${where}: offset soft shadow`).not.toBe('none');
            expect(badge.shadow).toMatch(/(?:^|\s)-?\d+px [1-9]\d*px \d+px/);
            // Solid surface-strong, never glass.
            expect(badge.background, where).toBe(theme === 'dark' ? 'rgb(32, 30, 49)' : 'rgb(255, 255, 255)');
            expect(badge.color, where).toBe(theme === 'dark' ? 'rgb(247, 245, 255)' : 'rgb(31, 30, 51)');
            expectContrast(await contrastOf(page, '#slide-position'), 4.5, 1, `${where}: badge text`);
          }
        });
      }
    }
  }

  test('visible false hides it completely and returns nothing to announce', async ({ page }) => {
    await configured(page, { visible: false, position: 'top-right' });
    await ready(page);
    await expect(page.locator('#slide-position')).toBeHidden();
    await expect(page.locator('#slide-position')).toHaveAttribute('hidden', '');
    expect((await badgeOf(page)).display).toBe('none');
    // Hidden elements leave the accessibility tree, so nothing announces the position either.
    await expect(page.getByRole('status', { name: /^Slide \d+ of \d+$/ })).toHaveCount(0);
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#slide-position')).toBeHidden();
    // The toolbar controls are untouched.
    for (const id of ['previous', 'next', 'menu-toggle']) await expect(page.locator(`#${id}`)).toBeVisible();
  });

  test('it is outside the toolbar, which keeps Previous, Next and Menu grouped', async ({ page }) => {
    await ready(page);
    const structure = await page.evaluate(() => {
      const toolbar = document.getElementById('toolbar')!;
      const nav = toolbar.querySelector('nav')!;
      const badge = document.getElementById('slide-position')!;
      return {
        inToolbar: toolbar.contains(badge),
        inNav: nav.contains(badge),
        navIds: [...nav.children].map((child) => child.id),
        toolbarTags: [...toolbar.children].map((child) => child.tagName.toLowerCase()),
        previousNextAdjacent: document.getElementById('previous')!.nextElementSibling === document.getElementById('next'),
        outputs: toolbar.querySelectorAll('output').length,
        parent: badge.parentElement?.tagName.toLowerCase(),
      };
    });
    expect(structure).toEqual({
      inToolbar: false, inNav: false, navIds: ['previous', 'next', 'menu-toggle'], toolbarTags: ['a', 'span', 'nav'],
      previousNextAdjacent: true, outputs: 0, parent: 'body',
    });
  });

  for (const [width, height] of [[1280, 720], [390, 844]]) {
    test(`the toolbar controls stay at the right edge without the counter: ${width}x${height}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await ready(page, '?mode=present');
      const bounds = await page.evaluate(() => {
        const toolbar = document.getElementById('toolbar')!.getBoundingClientRect();
        const nav = document.querySelector('#toolbar nav')!.getBoundingClientRect();
        const brand = document.querySelector('#toolbar .brand-link')!.getBoundingClientRect();
        return { navRight: toolbar.right - nav.right, brandLeft: brand.left - toolbar.left, height: toolbar.height };
      });
      expect(bounds.height).toBe(56);
      expect(bounds.navRight).toBeLessThanOrEqual(width <= 600 ? 12.5 : 16.5);
    });
  }

  test('it never takes a click or a focus stop', async ({ page }) => {
    await ready(page);
    expect(await page.evaluate(() => {
      const badge = document.getElementById('slide-position')!;
      const rect = badge.getBoundingClientRect();
      return { passesClicksThrough: document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2) !== badge, tabIndex: badge.tabIndex, interactive: badge.querySelectorAll('a, button, input, [tabindex]').length };
    })).toEqual({ passesClicksThrough: true, tabIndex: -1, interactive: 0 });
    const visited = new Set<string>();
    for (let step = 0; step < 14; step++) {
      await page.keyboard.press('Tab');
      visited.add(await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName || ''));
    }
    expect(visited.has('slide-position')).toBe(false);
  });

  test('it keeps its status semantics and updates the text and label on every slide', async ({ page }) => {
    await authorMarkdown(page, `<!-- .slide: id="one" -->
## One

---

<!-- .slide: id="two" -->
## Two

\`\`\`typescript [1|2|3]
a;
b;
c;
\`\`\`

---

<!-- .slide: id="three" -->
## Three
`);
    await ready(page);
    const ids = await renderedIds(page);
    expect(ids).toEqual(['intro', 'one', 'two', 'three']);
    const badge = page.locator('#slide-position');
    await expect(badge).toHaveAttribute('aria-live', 'polite');
    await expect(badge).toHaveAttribute('aria-atomic', 'true');
    await expect(page.getByRole('status', { name: 'Slide 1 of 4' })).toBeVisible();
    await page.keyboard.press('Space');
    await expect(badge).toHaveText('2 / 4');
    await expect(badge).toHaveAttribute('aria-label', 'Slide 2 of 4');
    await jump(page, 'two');
    await expect(badge).toHaveText('3 / 4');
    // The two code steps on this slide are fragments: the slide count does not change.
    for (let step = 0; step < 2; step++) {
      await page.keyboard.press('Space');
      await expect(badge).toHaveText('3 / 4');
    }
    await page.keyboard.press('Space');
    await expect(badge).toHaveText('4 / 4');
    await expect(badge).toHaveAttribute('aria-label', 'Slide 4 of 4');
  });

  test('Back and Forward move the counter with the slide', async ({ page }) => {
    await ready(page);
    const ids = await renderedIds(page);
    const badge = page.locator('#slide-position');
    await page.keyboard.press('Space');
    await page.keyboard.press('Space');
    await expect(badge).toHaveText(`3 / ${ids.length}`);
    await page.goBack();
    await expect(badge).toHaveText(`2 / ${ids.length}`);
    await expect(badge).toHaveAttribute('aria-label', `Slide 2 of ${ids.length}`);
    await page.goForward();
    await expect(badge).toHaveText(`3 / ${ids.length}`);
  });

  test('added slides and vertical slides change the counts', async ({ page }) => {
    await authorMarkdown(page, `<!-- .slide: id="top" -->
## Top

--

<!-- .slide: id="under" -->
## Under

---

<!-- .slide: id="side" -->
## Side
`);
    await configured(page);
    await ready(page);
    const badge = page.locator('#slide-position');
    await expect(badge).toHaveText('1 / 4');
    await page.keyboard.press('ArrowRight');
    await expect(badge).toHaveText('2 / 4');
    await page.keyboard.press('ArrowDown');
    await expect(badge).toHaveText('3 / 4');
    await expect(badge).toHaveAttribute('aria-label', 'Slide 3 of 4');
    await page.keyboard.press('ArrowRight');
    await expect(badge).toHaveText('4 / 4');
  });

  test('more slides in slides.md raise the total', async ({ page }) => {
    await authorMarkdown(page, `${exampleMarkdown}\n---\n## Another idea\n\n---\n## One more\n`);
    await configured(page);
    await ready(page);
    await expect(page.locator('#slide-position')).toHaveText('1 / 6');
  });

  test('reading mode shows it and follows the slide in view', async ({ page }) => {
    await ready(page, '?mode=read');
    const ids = await renderedIds(page);
    const target = ids[Math.min(3, ids.length - 1)];
    await expect(page.locator('#slide-position')).toBeVisible();
    await page.evaluate((id) => document.getElementById(id)!.scrollIntoView(), target);
    await expect.poll(() => page.locator('#slide-position').textContent()).toBe(`${ids.indexOf(target) + 1} / ${ids.length}`);
  });

  test('it animates nothing', async ({ page }) => {
    await ready(page);
    await page.keyboard.press('Space');
    expect(await page.evaluate(() => {
      const badge = document.getElementById('slide-position')!;
      const style = getComputedStyle(badge);
      return { running: badge.getAnimations().length, transition: style.transitionDuration, animation: style.animationName };
    })).toEqual({ running: 0, transition: '0s', animation: 'none' });
  });
});

test.describe('copy and error messages never collide with the counter', () => {
  async function announce(page: Page) {
    await page.keyboard.press('r');
    await expect(page.locator('#deck-status')).toContainText('Reading mode');
  }

  async function overlap(page: Page) {
    return page.evaluate(() => {
      const status = document.getElementById('deck-status')!.getBoundingClientRect();
      const badge = document.getElementById('slide-position')!;
      const b = badge.getBoundingClientRect();
      const shown = getComputedStyle(badge).display !== 'none';
      const clientWidth = document.documentElement.clientWidth;
      const clientHeight = document.documentElement.clientHeight;
      return {
        collides: shown && !(status.right <= b.left || status.left >= b.right || status.bottom <= b.top || status.top >= b.bottom),
        statusBottom: clientHeight - status.bottom, statusLeft: status.left, statusRight: status.right,
        gap: b.top - status.bottom, badgeLeft: b.left, clientWidth,
      };
    });
  }

  for (const [width, height] of [[1440, 900], [1280, 720], [390, 844], [320, 480]]) {
    test(`a visible bottom-left badge sits under the message: ${width}x${height}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await configured(page, { visible: true, position: 'bottom-left' });
      await ready(page);
      await announce(page);
      const found = await overlap(page);
      expect(found.collides).toBe(false);
      // The message stacks directly above the badge, 8px clear, on the same left edge.
      expect(found.gap).toBeCloseTo(8, 0);
      expect(found.statusLeft).toBeCloseTo(found.badgeLeft, 0);
      expect(found.statusBottom).toBeGreaterThan(14 + (width <= 600 ? 28 : 32));
    });

    for (const position of ['bottom-right', 'top-left', 'top-right'] as SlideNumberPosition[]) {
      test(`${position} leaves the message at its normal place without overlap: ${width}x${height}`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        await configured(page, { visible: true, position });
        await ready(page);
        await announce(page);
        const found = await overlap(page);
        expect(found.collides).toBe(false);
        expect(found.statusBottom).toBeCloseTo(14, 0);
        expect(found.statusLeft).toBeCloseTo(sides(width), 0);
      });
    }

    test(`a hidden badge returns the message to its normal place: ${width}x${height}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await configured(page, { visible: false, position: 'bottom-left' });
      await ready(page);
      await announce(page);
      const found = await overlap(page);
      expect(found.collides).toBe(false);
      expect(found.statusBottom).toBeCloseTo(14, 0);
      expect(found.statusLeft).toBeCloseTo(sides(width), 0);
    });
  }

  test('a long message beside a bottom-right badge wraps instead of running under it', async ({ page }) => {
    await page.setViewportSize({ width: 620, height: 800 });
    await configured(page, { visible: true, position: 'bottom-right' });
    await ready(page, '?mode=present');
    await announce(page);
    const found = await overlap(page);
    expect(found.collides).toBe(false);
    expect(found.statusRight).toBeLessThan(found.badgeLeft);
  });
});

test.describe('where the counter is never shown', () => {
  for (const position of slideNumberPositions) {
    test(`speaker-view previews hide a ${position} counter`, async ({ page }) => {
      await configured(page, { visible: true, position });
      await ready(page, '?receiver&progress=false&history=false&transition=none');
      await expect(page.locator('html')).toHaveAttribute('data-receiver', 'true');
      await expect(page.locator('#slide-position')).toBeHidden();
      expect((await badgeOf(page)).display).toBe('none');
    });
  }

  test('printing hides it, and so does the print layout on screen', async ({ page }) => {
    await ready(page);
    await expect(page.locator('#slide-position')).toBeVisible();
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('#slide-position')).toBeHidden();
    await page.emulateMedia({ media: 'screen' });
    await ready(page, '?print-pdf');
    await expect(page.locator('html')).toHaveAttribute('data-print', 'true');
    await expect(page.locator('#slide-position')).toBeHidden();
  });

  test('a deck that failed to load shows no counter', async ({ page }) => {
    await configured(page, { visible: true, position: 'bottom-left', color: 'red' });
    await page.goto('?mode=present');
    await expect(page.locator('html')).toHaveAttribute('data-deck-ready', 'error');
    await expect(page.locator('#failure-detail')).toHaveText('deck.config.json: slideNumber.color is not a supported field.');
    await expect(page.locator('#slide-position')).toBeHidden();
  });
});

test.describe('an invalid slideNumber stops the load and names the field', () => {
  const cases: [string, unknown, string][] = [
    ['visible that is not a boolean', { visible: 'yes' }, 'deck.config.json: slideNumber.visible must be true or false.'],
    ['a position that is not a corner', { position: 'middle' }, 'deck.config.json: slideNumber.position must be one of top-left, top-right, bottom-left, bottom-right.'],
    ['an unknown field', { background: '#fff' }, 'deck.config.json: slideNumber.background is not a supported field.'],
    ['a value that is not an object', 'bottom-left', 'deck.config.json: slideNumber must be an object.'],
  ];
  for (const [name, slideNumber, message] of cases) {
    test(`${name}`, async ({ page }) => {
      await configured(page, slideNumber);
      await page.goto('?mode=present');
      await expect(page.locator('html')).toHaveAttribute('data-deck-ready', 'error');
      await expect(page.locator('#failure-detail')).toHaveText(message);
      await expect(page.locator('#failure')).toBeVisible();
    });
  }
});
