import { expect, test, type Page } from '@playwright/test';
import { authorDeck, authorMarkdown, jump, ready, settleMotion } from './helpers';

// A slide's <details> opens in a modal dialog while presenting (details.spec.ts). The dialog must leave everything under it exactly
// where it was, including when a scrollbar takes room.
//
// Headless Chromium hides scrollbars unless asked not to, and a hidden scrollbar takes no room, so this file starts the browser with
// them showing. A slide taller than a narrow window scrolls inside the stage's scroller, and that scrollbar takes a gutter; a page can
// scroll too. A modal that locked scrolling by hiding a scrollbar would widen what is beneath it and slide it sideways. So the painted
// page, the toolbar, the stage, the slide, the counter and the message are all compared before, while the dialog is open, and after it
// closes, with every scroll position. While a page is locked Chromium reports a wider documentElement.clientWidth although its gutter
// is still painted, so the painted width is measured instead of that.
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

const fence = '```';
const entries = (count: number) => Array.from({ length: count }, (_, index) =>
  `- Entry ${index + 1}: a long line that explains what happened at this point in the history of the project, long enough to wrap`).join('\n');
const filler = Array.from({ length: 40 }, (_, index) => `- Context ${index + 1}: a line of supporting context that makes this slide taller than the screen`).join('\n');
const tall = [
  '<!-- .slide: id="tall" data-kicker="Tall" -->', '## A tall slide', '', `${fence}bash`, 'aspire start', fence, '', filler, '', '<details>',
  '<summary>Show the full history</summary>', '', entries(70), '', '[A useful link](https://example.com/history)', '</details>', '', 'The end of the slide.', '',
].join('\n');
const after = '<!-- .slide: id="after" -->\n## After\n\nThe next slide.\n';
const deck = [tall, after].join('\n---\n\n');

const dialog = (page: Page) => page.locator('#slide-details');
const region = (page: Page) => dialog(page).locator('[role="region"]').first();
const summary = (page: Page) => page.locator('#tall .slide-content > details > summary');
const htmlOverflow = (page: Page) => page.evaluate(() => getComputedStyle(document.documentElement).overflow);
const pageGutter = (page: Page) => page.evaluate(() => innerWidth - document.documentElement.clientWidth);

function geometry(page: Page) {
  return page.evaluate(() => {
    const box = (selector: string) => {
      const { left, top, width, height } = document.querySelector(selector)!.getBoundingClientRect();
      return [left, top, width, height].map((value) => Math.round(value * 100) / 100);
    };
    const viewport = document.getElementById('slide-viewport')!;
    const painted = document.documentElement.getBoundingClientRect().width;
    return {
      painted: ['html', 'body'].map(box),
      horizontal: document.documentElement.scrollWidth - Math.round(painted),
      gutter: viewport.offsetWidth - viewport.clientWidth,
      scroll: [scrollX, scrollY, viewport.scrollTop, viewport.scrollLeft],
      boxes: ['#toolbar', '#presentation', '#slide-viewport', '.slides', '#tall', '#tall h2', '#tall .slide-content > details > summary', '#slide-position', '#deck-status'].map(box),
      status: document.getElementById('deck-status')!.textContent,
    };
  });
}

// A message on screen, so the counter and the message are measured together.
async function copied(page: Page) {
  await page.locator('#tall .copy-code').first().click();
  await expect(page.locator('#deck-status')).toHaveText('bash code copied.');
}

// Push at everything behind the dialog: the wheel beside it and past the end of its own scroll, and the scrolling keys inside it.
async function pushAtTheBackground(page: Page, height: number) {
  const gap = await dialog(page).evaluate((node) => node.getBoundingClientRect().left / 2);
  await page.mouse.move(gap, height / 2);
  for (let wheel = 0; wheel < 4; wheel++) await page.mouse.wheel(0, 700);
  const box = (await dialog(page).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let wheel = 0; wheel < 14; wheel++) await page.mouse.wheel(0, 900);
  await expect.poll(() => region(page).evaluate((node) => node.scrollTop + node.clientHeight >= node.scrollHeight - 1)).toBe(true);
  await region(page).focus();
  for (const key of ['PageUp', 'Home', 'End', 'ArrowDown', 'Space']) await page.keyboard.press(key);
}

for (const [width, height] of [[783, 800], [390, 844], [320, 568]]) {
  test.describe(`a slide with a visible scrollbar at ${width}x${height}`, () => {
    test('the stage and the slide keep their exact box while the dialog is open', async ({ page, context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.setViewportSize({ width, height });
      await authorMarkdown(page, deck);
      await ready(page, '?mode=present#/tall');
      await settleMotion(page);
      await copied(page);
      await summary(page).scrollIntoViewIfNeeded();
      const before = await geometry(page);
      expect(before.gutter, 'the slide scrolls, so its scrollbar takes a gutter').toBeGreaterThan(0);
      expect(before.scroll[2], 'the slide is scrolled down to its summary').toBeGreaterThan(100);
      expect(before.horizontal).toBeLessThanOrEqual(0);
      expect(before.painted[1][2], 'the page itself does not scroll, so no gutter is reserved on it').toBe(width);

      await summary(page).click();
      await expect(dialog(page)).toBeVisible();
      expect(await geometry(page)).toEqual(before);
      // Still nothing reserved or locked on the page while the dialog is open.
      expect(await htmlOverflow(page)).toBe('visible');
      await pushAtTheBackground(page, height);
      expect(await geometry(page)).toEqual(before);

      await page.keyboard.press('Escape');
      await expect(dialog(page)).toBeHidden();
      expect(await geometry(page)).toEqual(before);
      await expect(summary(page)).toBeFocused();
    });

    test('a page that scrolls keeps its gutter and its place, with the counter in every corner', async ({ page, context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.setViewportSize({ width, height });
      for (const position of ['top-left', 'top-right', 'bottom-left', 'bottom-right']) {
        await authorDeck(page, { slideNumber: { position } }, deck);
        await ready(page, '?mode=present');
        await jump(page, 'tall');
        await settleMotion(page);
        await copied(page);
        await summary(page).scrollIntoViewIfNeeded();
        // The deck's own page does not scroll, so give it 80px that does, and start it 20px down.
        await page.evaluate(() => {
          document.body.style.minHeight = 'calc(100dvh + 80px)';
          scrollTo(0, 20);
        });
        const before = await geometry(page);
        expect(await pageGutter(page), `${position}: the page scrolls, so its scrollbar takes a gutter`).toBeGreaterThan(0);
        expect(before.gutter, position).toBeGreaterThan(0);
        expect(before.scroll.slice(0, 2), position).toEqual([0, 20]);
        expect(before.horizontal, position).toBeLessThanOrEqual(0);
        expect(await htmlOverflow(page), position).toBe('visible');

        await summary(page).click();
        await expect(dialog(page), position).toBeVisible();
        // The page stops scrolling and keeps its gutter, so nothing under the dialog moves, not even the counter in a right-hand corner.
        expect(await htmlOverflow(page), position).toBe('hidden');
        expect(await geometry(page), position).toEqual(before);
        await pushAtTheBackground(page, height);
        expect(await geometry(page), position).toEqual(before);

        await page.keyboard.press('Escape');
        await expect(dialog(page), position).toBeHidden();
        expect(await geometry(page), position).toEqual(before);
        expect(await htmlOverflow(page), position).toBe('visible');
        await expect(summary(page), position).toBeFocused();
      }
    });

    test('printing while the dialog is open unlocks the page again', async ({ page }) => {
      await page.setViewportSize({ width, height });
      await authorMarkdown(page, deck);
      await ready(page, '?mode=present#/tall');
      await page.evaluate(() => { document.body.style.minHeight = 'calc(100dvh + 80px)'; });
      await summary(page).scrollIntoViewIfNeeded();
      await summary(page).click();
      await expect(dialog(page)).toBeVisible();
      expect(await htmlOverflow(page)).toBe('hidden');
      await page.emulateMedia({ media: 'print' });
      await expect(dialog(page)).toBeHidden();
      expect(await htmlOverflow(page)).toBe('visible');
      await page.emulateMedia({ media: 'screen' });
      expect(await htmlOverflow(page)).toBe('visible');
    });

    // The gutter is only ever held while the dialog is open. Everywhere else the page keeps the width and the insets it had, which is
    // what a gutter reserved for good would have changed: a counter inset by the room it took, and reading text pushed past a narrow edge.
    test('a deck with the dialog closed, presenting or reading, reserves nothing and keeps its insets', async ({ page }) => {
      await page.setViewportSize({ width, height });
      for (const mode of ['present', 'read']) {
        for (const position of ['top-left', 'top-right', 'bottom-left', 'bottom-right']) {
          const label = `${mode}, ${position}`;
          await authorDeck(page, { slideNumber: { position } }, deck);
          await ready(page, `?mode=${mode}`);
          await jump(page, 'tall');
          await settleMotion(page);
          const state = await page.evaluate(() => {
            const badge = document.getElementById('slide-position')!.getBoundingClientRect();
            const viewport = document.getElementById('slide-viewport')!;
            const limit = viewport.getBoundingClientRect().left + viewport.clientWidth;
            const text = [...document.querySelectorAll('#tall p, #tall li, #tall h2, #tall summary, #tall a')].map((node) => node.getBoundingClientRect().right);
            return {
              body: document.body.getBoundingClientRect().width,
              overflow: getComputedStyle(document.documentElement).overflow,
              locked: document.documentElement.hasAttribute('data-details-lock'),
              page: innerWidth - document.documentElement.clientWidth,
              side: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--badge-side')),
              left: badge.left,
              right: innerWidth - badge.right,
              horizontal: document.documentElement.scrollWidth - innerWidth,
              fits: Math.max(...text) <= limit + 0.5,
            };
          });
          expect(state.body, `${label}: the page keeps its whole width`).toBe(width);
          expect(state.page, `${label}: and reserves no gutter`).toBe(0);
          expect(state.overflow, label).toBe('visible');
          expect(state.locked, label).toBe(false);
          expect(state.horizontal, label).toBeLessThanOrEqual(0);
          expect(state.fits, `${label}: the text stays inside the stage`).toBe(true);
          expect(position.endsWith('right') ? state.right : state.left, `${label}: the counter keeps its inset`).toBeCloseTo(state.side, 0);
        }
      }
    });
  });
}
