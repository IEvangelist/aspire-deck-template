import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Frame, type Page } from '@playwright/test';
import { assetRequest, authorMarkdown, captureClipboard, expectCopied, openSpeakerView, ready, settleMotion } from './helpers';

// A slide's native <details> must never reflow a slide that is being presented: expanding it inline can grow the slide far past the
// screen and leave the presenter stranded. While presenting, its summary opens the content in one modal dialog instead, and the
// slide, the address and every scroll position stay exactly as they were. Reading keeps the native inline details, print includes the
// content, and a deck without script keeps the plain element. Every test authors its own slides, so none depends on what a deck ships.
const fence = '```';
const code = 'aspire logs api --follow';
const entries = (count: number) => Array.from({ length: count }, (_, index) =>
  `- Entry ${index + 1}: a long line that explains what happened at this point in the history of the project, long enough to wrap`).join('\n');
const history = [entries(70), '', `${fence}bash`, code, fence, '', '[A useful link](https://example.com/history)', ''].join('\n');

function detailsSlide(id: string, { open = false, summary = 'Show the full history', body = history }: { open?: boolean; summary?: string; body?: string } = {}) {
  return [
    `<!-- .slide: id="${id}" data-kicker="History" -->`,
    '## The history',
    '',
    'A short paragraph above the disclosure.',
    '',
    `<details${open ? ' open' : ''}>`,
    `<summary>${summary}</summary>`,
    '',
    body,
    '</details>',
    '',
    'A short paragraph below the disclosure.',
    '',
  ].join('\n');
}

const after = '<!-- .slide: id="after" -->\n## After\n\nThe next slide.\n';
const third = '<!-- .slide: id="third" -->\n## Third\n\nThe last slide.\n';
const deck = (...slides: string[]) => slides.join('\n---\n\n');
const standard = deck(detailsSlide('history'), after, third);

// The longest things a disclosure can hold: an unbreakable word and link, a code line wider than any screen, other scripts and emoji,
// and a nested disclosure.
const extreme = [
  'A word with no break opportunity: ' + 'W'.repeat(140),
  '',
  `[${'A link label that keeps going '.repeat(5)}](https://example.com/${'a-very-long-path-segment/'.repeat(8)})`,
  '',
  `${fence}text`,
  'const sentence = "' + 'a code line that is much wider than the dialog and has to scroll inside its own window '.repeat(4) + '";',
  fence,
  '<!-- .element: data-wrap="false" -->',
  '',
  'Emoji 🎉🚀🧪 and right to left مرحبا بالعالم and 日本語のテキストを折り返す。',
  '',
  entries(40),
  '',
  '<details>',
  '<summary>A nested disclosure</summary>',
  '',
  'Nested content that opens inside the dialog.',
  '</details>',
  '',
].join('\n');
const extremeDeck = deck(detailsSlide('extreme', { summary: 'Show <code>everything</code> at once', body: extreme }), after);

async function open(page: Page, markdown = standard, path = '?mode=present#/history') {
  await authorMarkdown(page, markdown);
  await ready(page, path);
  await settleMotion(page);
}

// Everything a disclosure must leave alone: the address, the mode, the current slide, every scroll position from the summary up to
// the page, and the box of each part of the stage, counter and message.
function snapshot(page: Page, id = 'history') {
  return page.evaluate((slide) => {
    const round = (value: number) => Math.round(value * 100) / 100;
    const box = (selector: string) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const { left, top, width, height } = node.getBoundingClientRect();
      return [left, top, width, height].map(round);
    };
    const scrolls: string[] = [];
    for (let node: Element | null = document.querySelector(`#${slide} summary`); node; node = node.parentElement) {
      scrolls.push(`${node.localName}${node.id ? `#${node.id}` : ''}: ${node.scrollTop},${node.scrollLeft}`);
    }
    const state = document.documentElement.dataset;
    return {
      url: location.href,
      mode: [state.reading, state.compact, state.theme, state.receiver],
      present: [...document.querySelectorAll('.slides section.present')].map((node) => node.id),
      scroll: [scrollX, scrollY, ...scrolls],
      boxes: ['.slides', `#${slide}`, `#${slide} .slide-content`, `#${slide} h2`, `#${slide} details`, `#${slide} summary`, '#slide-position', '#deck-status'].map(box),
      counter: document.getElementById('slide-position')?.textContent,
      status: document.getElementById('deck-status')?.textContent,
    };
  }, id);
}

const dialogOf = (page: Page) => page.locator('#slide-details');
const summaryOf = (page: Page, id = 'history') => page.locator(`#${id} .slide-content > details > summary`);
const closeOf = (page: Page) => dialogOf(page).getByRole('button', { name: /close/i });
// The dialog's own scroll region. Code windows inside it are regions too, so this is the first one.
const regionOf = (page: Page) => dialogOf(page).locator('[role="region"]').first();
const wrapperHome = (page: Page, id = 'history') => page.locator(`#${id} > .slide-content > details`).evaluate((details) => ({
  summaries: details.querySelectorAll(':scope > summary').length,
  others: [...details.children].filter((child) => child.localName !== 'summary').length,
  open: (details as HTMLDetailsElement).open,
}));

test.describe('a presentation with a slide that has details', () => {
  test('activating the summary opens a modal dialog and changes nothing else', async ({ page }) => {
    await open(page);
    const before = await snapshot(page);
    await expect(dialogOf(page)).toBeHidden();
    await summaryOf(page).click();
    await expect(dialogOf(page)).toBeVisible();
    expect(await dialogOf(page).evaluate((node) => node.matches(':modal'))).toBe(true);
    // The disclosure itself stays closed, so the slide keeps exactly the room it had.
    expect((await wrapperHome(page)).open).toBe(false);
    expect(await snapshot(page)).toEqual(before);
    await expect(dialogOf(page).getByRole('link', { name: 'A useful link' })).toBeVisible();
    await expect(dialogOf(page).locator('pre')).toBeVisible();
    await expect(dialogOf(page).getByText('Entry 70:')).toBeAttached();
    await expect(dialogOf(page)).toContainText('Show the full history');
    await page.keyboard.press('Escape');
    await expect(dialogOf(page)).toBeHidden();
    expect(await snapshot(page)).toEqual(before);
    await expect(summaryOf(page)).toBeFocused();
  });

  test('repeated pointer, keyboard and Escape or Close activation leaves no trace', async ({ page }) => {
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') problems.push(message.text()); });
    await open(page);
    const before = await snapshot(page);
    const markup = await page.locator('#history details').innerHTML();
    for (let round = 1; round <= 12; round++) {
      const how = (['pointer', 'Enter', 'Space'] as const)[round % 3];
      if (how === 'pointer') await summaryOf(page).click();
      else {
        await summaryOf(page).focus();
        await page.keyboard.press(how);
      }
      await expect(dialogOf(page), `round ${round}: ${how} opens it`).toBeVisible();
      if (round % 2) await page.keyboard.press('Escape');
      else await closeOf(page).click();
      await expect(dialogOf(page), `round ${round}: it closes`).toBeHidden();
      await expect(summaryOf(page), `round ${round}: focus returns to the summary`).toBeFocused();
      expect(await snapshot(page), `round ${round}`).toEqual(before);
    }
    expect(await page.locator('#history details').innerHTML()).toBe(markup);
    expect(problems).toEqual([]);
  });

  test('activating twice at once still opens one dialog', async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      const summary = document.querySelector<HTMLElement>('#history summary')!;
      summary.click();
      summary.click();
      summary.click();
    });
    await expect(dialogOf(page)).toBeVisible();
    await expect(page.locator('dialog[open]:not(#deck-menu)')).toHaveCount(1);
    expect(await page.evaluate(() => document.querySelectorAll('#slide-details').length)).toBe(1);
    await page.keyboard.press('Escape');
    await expect(dialogOf(page)).toBeHidden();
    expect(await wrapperHome(page)).toEqual({ summaries: 1, others: 1, open: false });
  });

  test('the summary names the dialog it opens and the dialog is named by it', async ({ page }) => {
    await open(page);
    const summary = summaryOf(page);
    await expect(summary).toHaveAttribute('aria-haspopup', 'dialog');
    await expect(summary).toHaveAttribute('aria-expanded', 'false');
    await summary.click();
    await expect(dialogOf(page)).toBeVisible();
    await expect(summary).toHaveAttribute('aria-expanded', 'true');
    const id = await summary.getAttribute('id');
    expect(id).toBeTruthy();
    await expect(dialogOf(page)).toHaveAttribute('aria-labelledby', id!);
    await expect(dialogOf(page)).toHaveAccessibleName('Show the full history');
    const close = await closeOf(page).boundingBox();
    expect(close!.width).toBeGreaterThanOrEqual(43.5);
    expect(close!.height).toBeGreaterThanOrEqual(43.5);
    await page.keyboard.press('Escape');
    await expect(summary).toHaveAttribute('aria-expanded', 'false');
    // The summary is a real tap target at the stage's scale, not only at full size.
    expect((await summary.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
  });

  test('the content moves to the dialog and back as the same nodes, with their listeners', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await captureClipboard(page);
    await open(page);
    // All of the disclosure's content sits in one wrapper, and the wrapper is what moves.
    expect(await wrapperHome(page)).toEqual({ summaries: 1, others: 1, open: false });
    await page.evaluate(() => {
      const details = document.querySelector('#history details')!;
      const held = (window as unknown as { held: Record<string, Element | null>; clicks: number });
      held.held = { wrapper: details.lastElementChild, link: details.querySelector('a'), code: details.querySelector('pre'), list: details.querySelector('ul') };
      held.clicks = 0;
      details.querySelector('a')!.addEventListener('click', (event) => { event.preventDefault(); held.clicks++; });
    });
    const where = () => page.evaluate(() => {
      const held = (window as unknown as { held: Record<string, Element> }).held;
      const dialog = document.getElementById('slide-details');
      const details = document.querySelector('#history details')!;
      return {
        inDialog: Object.values(held).every((node) => dialog?.contains(node) ?? false),
        inDetails: Object.values(held).every((node) => details.contains(node)),
        wrapperIsLast: details.lastElementChild === held.wrapper,
        sameLink: details.querySelector('a') === held.link || dialog?.querySelector('a') === held.link,
        clicks: (window as unknown as { clicks: number }).clicks,
      };
    });
    expect(await where()).toMatchObject({ inDetails: true, inDialog: false, wrapperIsLast: true });
    for (const round of [1, 2]) {
      await summaryOf(page).click();
      await expect(dialogOf(page)).toBeVisible();
      expect(await where()).toMatchObject({ inDialog: true, inDetails: false, sameLink: true });
      await dialogOf(page).getByRole('link', { name: 'A useful link' }).click();
      expect((await where()).clicks, `link listener, round ${round}`).toBe(round);
      // The code window built for the slide still copies exactly what it shows.
      await dialogOf(page).locator('.copy-code').click();
      await expectCopied(page, code);
      await page.keyboard.press('Escape');
      await expect(dialogOf(page)).toBeHidden();
      expect(await where()).toMatchObject({ inDetails: true, inDialog: false, wrapperIsLast: true, sameLink: true });
    }
  });

  test('focus stays within the dialog, never reaches the page behind it, and returns to the summary', async ({ page }) => {
    await open(page);
    await summaryOf(page).click();
    await expect(dialogOf(page)).toBeVisible();
    // A modal dialog hides the page behind it from the keyboard. After its last control focus may pass to the browser itself (the
    // document then reports the body) and comes back to its first one, but it never lands on the slide, the toolbar or the summary.
    const place = () => page.evaluate(() => {
      const focused = document.activeElement;
      if (focused?.closest('#slide-details')) return 'dialog';
      return focused === document.body ? 'browser' : `${focused?.localName}#${focused?.id}`;
    });
    expect(await place()).toBe('dialog');
    for (const key of ['Tab', 'Shift+Tab']) {
      const seen = new Set<string>();
      for (let press = 1; press <= 12; press++) {
        await page.keyboard.press(key);
        seen.add(await place());
      }
      expect([...seen].sort(), key).toEqual(['browser', 'dialog']);
    }
    await closeOf(page).focus();
    await page.keyboard.press('Enter');
    await expect(dialogOf(page)).toBeHidden();
    await expect(summaryOf(page)).toBeFocused();
  });

  test('the deck keys do nothing while the dialog is open, and Escape only closes it', async ({ page }) => {
    let popups = 0;
    page.on('popup', () => { popups++; });
    await open(page);
    await summaryOf(page).click();
    await expect(dialogOf(page)).toBeVisible();
    const during = await snapshot(page);
    for (const key of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'Space', 'PageDown', 'End', 'r', 't', 's', 'Home']) {
      await page.keyboard.press(key);
      await expect(dialogOf(page), key).toBeVisible();
    }
    await page.waitForTimeout(300);
    expect(await snapshot(page)).toEqual(during);
    expect(popups).toBe(0);
    await page.keyboard.press('Escape');
    await expect(dialogOf(page)).toBeHidden();
    await expect(page.locator('main.reveal')).not.toHaveClass(/overview/);
    expect((await snapshot(page)).present).toEqual(['history']);
  });

  test('Next and Back work after the dialog closes, from the summary or from the toolbar', async ({ page }) => {
    await open(page);
    for (const close of ['Escape', 'Close']) {
      await summaryOf(page).click();
      await expect(dialogOf(page)).toBeVisible();
      if (close === 'Escape') await page.keyboard.press('Escape');
      else await closeOf(page).click();
      await expect(dialogOf(page)).toBeHidden();
      // The summary has focus again, and it must not keep the arrow keys from the deck.
      await expect(summaryOf(page)).toBeFocused();
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('#after')).toBeVisible();
      await expect(page).toHaveURL(/#\/after$/);
      await page.keyboard.press('ArrowLeft');
      await expect(page.locator('#history')).toBeVisible();
      await expect(page).toHaveURL(/#\/history$/);
    }
    await summaryOf(page).click();
    await page.keyboard.press('Escape');
    await page.locator('#next').click();
    await expect(page.locator('#after')).toBeVisible();
    await page.locator('#previous').click();
    await expect(page.locator('#history')).toBeVisible();
    await expect(page.locator('#next')).toBeEnabled();
  });

  test('a slide change, the address and the history close the dialog and put the content back', async ({ page }) => {
    await open(page, standard, '?mode=present#/after');
    await page.keyboard.press('ArrowLeft');
    await expect(page).toHaveURL(/#\/history$/);
    const closed = async (id: string) => {
      await expect(dialogOf(page)).toBeHidden();
      await expect(page.locator(`#${id}`)).toBeVisible();
      expect(await wrapperHome(page)).toEqual({ summaries: 1, others: 1, open: false });
      // Focus lands on the presentation, not on a summary the audience can no longer see.
      expect(await page.evaluate(() => document.activeElement?.id)).toBe('presentation');
    };
    await summaryOf(page).click();
    await expect(dialogOf(page)).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/#\/after$/);
    await closed('after');
    await page.goForward();
    await expect(page.locator('#history')).toBeVisible();
    await summaryOf(page).click();
    await expect(dialogOf(page)).toBeVisible();
    await page.evaluate(() => { location.hash = '#/third'; });
    await closed('third');
    await page.evaluate(() => { location.hash = '#/history'; });
    await expect(page.locator('#history')).toBeVisible();
    await summaryOf(page).click();
    await expect(dialogOf(page)).toBeVisible();
    await page.evaluate(() => document.getElementById('next')!.click());
    await closed('after');
  });

  test('switching to reading mode or opening the overview closes the dialog and restores the content', async ({ page }) => {
    await open(page);
    await summaryOf(page).click();
    await expect(dialogOf(page)).toBeVisible();
    await page.evaluate(() => document.getElementById('overview')!.click());
    await expect(dialogOf(page)).toBeHidden();
    await expect(page.locator('main.reveal')).toHaveClass(/overview/);
    expect(await wrapperHome(page)).toEqual({ summaries: 1, others: 1, open: false });
    await page.keyboard.press('Escape');
    await expect(page.locator('main.reveal')).not.toHaveClass(/overview/);

    await summaryOf(page).click();
    await expect(dialogOf(page)).toBeVisible();
    await page.evaluate(() => document.getElementById('read-mode')!.click());
    await expect(page.locator('html')).toHaveAttribute('data-reading', 'true');
    await expect(dialogOf(page)).toBeHidden();
    expect(await wrapperHome(page)).toEqual({ summaries: 1, others: 1, open: false });
    await expect(summaryOf(page)).not.toHaveAttribute('aria-haspopup', /.*/);
    await summaryOf(page).click();
    expect((await wrapperHome(page)).open).toBe(true);
    await expect(page.locator('#history details a')).toBeVisible();
    // And back to presenting: the disclosure folds up again and the dialog takes over.
    await page.evaluate(() => document.getElementById('read-mode')!.click());
    await expect(page.locator('html')).toHaveAttribute('data-reading', 'false');
    expect((await wrapperHome(page)).open).toBe(false);
    await summaryOf(page).click();
    await expect(dialogOf(page)).toBeVisible();
  });

  test('leaving the page closes the dialog and puts the content back', async ({ page }) => {
    await open(page);
    await summaryOf(page).click();
    await expect(dialogOf(page)).toBeVisible();
    await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
    await expect(dialogOf(page)).toBeHidden();
    expect(await wrapperHome(page)).toEqual({ summaries: 1, others: 1, open: false });
  });

  test('a disclosure written open still folds up while presenting', async ({ page }) => {
    await open(page, deck(detailsSlide('opened', { open: true }), after), '?mode=present#/opened');
    expect((await wrapperHome(page, 'opened')).open).toBe(false);
    await summaryOf(page, 'opened').click();
    await expect(dialogOf(page)).toBeVisible();
  });

  test('every disclosure on a slide opens its own content, and one without a summary gets a default', async ({ page }) => {
    const slide = [
      '<!-- .slide: id="several" -->',
      '## Several',
      '',
      '<details>',
      '<summary>First disclosure</summary>',
      '',
      'Content of the first.',
      '</details>',
      '',
      '<details>',
      '',
      'Content with no summary of its own.',
      '</details>',
      '',
      'Notes:',
      '<details open>',
      '<summary>Kept as written</summary>',
      '',
      'Presenter-only text.',
      '</details>',
      '',
    ].join('\n');
    await open(page, deck(slide, after), '?mode=present#/several');
    const summaries = page.locator('#several .slide-content > details > summary');
    await expect(summaries).toHaveText(['First disclosure', 'Details']);
    const ids = await summaries.evaluateAll((nodes) => nodes.map((node) => node.id));
    expect(new Set(ids).size).toBe(2);
    for (const [index, expected] of ['Content of the first.', 'Content with no summary of its own.'].entries()) {
      await summaries.nth(index).click();
      await expect(dialogOf(page)).toBeVisible();
      await expect(dialogOf(page)).toContainText(expected);
      await expect(dialogOf(page)).toHaveAccessibleName(index === 0 ? 'First disclosure' : 'Details');
      await page.keyboard.press('Escape');
      await expect(dialogOf(page)).toBeHidden();
      await expect(summaries.nth(index)).toBeFocused();
    }
    // A disclosure in the presenter notes is not part of the slide, so it is left exactly as written.
    expect(await page.locator('#several aside.notes details').evaluate((node) => ({
      open: (node as HTMLDetailsElement).open, wrapped: node.querySelector('.details-body') !== null, expanded: node.querySelector('summary')?.hasAttribute('aria-expanded'),
    }))).toEqual({ open: true, wrapped: false, expanded: false });
  });

  test('a nested disclosure opens inside the dialog and never opens a second dialog', async ({ page }) => {
    await open(page, extremeDeck, '?mode=present#/extreme');
    await summaryOf(page, 'extreme').click();
    await expect(dialogOf(page)).toBeVisible();
    const nested = dialogOf(page).locator('details summary');
    await expect(nested).toBeVisible();
    await expect(nested).not.toHaveAttribute('aria-haspopup', /.*/);
    await nested.scrollIntoViewIfNeeded();
    await nested.click();
    await expect(dialogOf(page).getByText('Nested content that opens inside the dialog.')).toBeVisible();
    await expect(page.locator('dialog[open]:not(#deck-menu)')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(dialogOf(page)).toBeHidden();
  });

  test('the overview never opens a dialog or expands a disclosure', async ({ page }) => {
    await open(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('main.reveal')).toHaveClass(/overview/);
    await page.evaluate(() => document.querySelector<HTMLElement>('#history summary')!.click());
    await page.waitForTimeout(200);
    await expect(dialogOf(page)).toBeHidden();
    expect((await wrapperHome(page)).open).toBe(false);
  });

  for (const reducedMotion of ['reduce', 'no-preference'] as const) {
    test(`opens and closes at once with the ${reducedMotion} motion setting`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion });
      await open(page);
      await summaryOf(page).click();
      await expect(dialogOf(page)).toBeVisible();
      expect(await dialogOf(page).evaluate((node) => node.getAnimations({ subtree: true }).length)).toBe(0);
      expect(await dialogOf(page).evaluate((node) => parseFloat(getComputedStyle(node).transitionDuration))).toBeLessThan(0.001);
      await page.keyboard.press('Escape');
      await expect(dialogOf(page)).toBeHidden();
    });
  }
});

test.describe('reading mode', () => {
  test('keeps the native inline details, with the mouse and with the keyboard', async ({ page }) => {
    await open(page, standard, '?mode=read#/history');
    const before = await snapshot(page);
    await expect(summaryOf(page)).not.toHaveAttribute('aria-haspopup', /.*/);
    await summaryOf(page).click();
    expect((await wrapperHome(page)).open).toBe(true);
    await expect(page.locator('#history details a')).toBeVisible();
    await expect(dialogOf(page)).toBeHidden();
    expect((await snapshot(page)).mode).toEqual(before.mode);
    expect(new URL(page.url()).searchParams.get('mode')).toBe('read');
    await summaryOf(page).click();
    expect((await wrapperHome(page)).open).toBe(false);
    // Space and Enter belong to the summary, not to the next slide.
    await summaryOf(page).focus();
    await page.keyboard.press('Space');
    expect((await wrapperHome(page)).open).toBe(true);
    await page.keyboard.press('Enter');
    expect((await wrapperHome(page)).open).toBe(false);
    await expect(page.locator('#history')).toBeInViewport();
  });

  test('keeps a disclosure that is written open', async ({ page }) => {
    await open(page, deck(detailsSlide('opened', { open: true }), after), '?mode=read#/opened');
    expect((await wrapperHome(page, 'opened')).open).toBe(true);
    await expect(page.locator('#opened details a')).toBeVisible();
  });
});

test.describe('print', () => {
  test('the print view opens every disclosure before it lays the pages out', async ({ page }) => {
    await authorMarkdown(page, deck(detailsSlide('history'), detailsSlide('opened', { open: true }), after));
    await ready(page, '?print-pdf&theme=light');
    await page.locator('.pdf-page').first().waitFor({ state: 'attached' });
    await page.emulateMedia({ media: 'print' });
    for (const id of ['history', 'opened']) {
      expect((await wrapperHome(page, id)).open, id).toBe(true);
      await expect(page.locator(`#${id} details a`), id).toBeVisible();
      await expect(page.locator(`#${id} details pre`), id).toBeVisible();
    }
    // Nothing the disclosure holds is cut off by the page it was laid out on.
    const cut = await page.evaluate(() => [...document.querySelectorAll('details li:last-of-type, details a')].filter((node) => {
      const sheet = node.closest('.pdf-page');
      return !sheet || node.getBoundingClientRect().bottom > sheet.getBoundingClientRect().bottom + 1;
    }).length);
    expect(cut).toBe(0);
  });

  test('printing a presentation includes the content and puts the slide back afterwards', async ({ page }) => {
    await open(page);
    await expect(page.locator('#history details a')).toBeHidden();
    const before = await snapshot(page);
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('#history details a')).toBeVisible();
    await expect(page.locator('#history details pre')).toBeVisible();
    await page.emulateMedia({ media: 'screen' });
    await expect(page.locator('#history details a')).toBeHidden();
    expect(await snapshot(page)).toEqual(before);
    await summaryOf(page).click();
    await expect(dialogOf(page)).toBeVisible();
  });

  test('printing while the dialog is open closes it and includes the content', async ({ page }) => {
    await open(page);
    await summaryOf(page).click();
    await expect(dialogOf(page)).toBeVisible();
    await page.emulateMedia({ media: 'print' });
    await expect(dialogOf(page)).toBeHidden();
    await expect(page.locator('#history details a')).toBeVisible();
    await page.emulateMedia({ media: 'screen' });
    await expect(page.locator('#history details a')).toBeHidden();
    expect(await wrapperHome(page)).toEqual({ summaries: 1, others: 1, open: false });
  });
});

test.describe('without script', () => {
  test.use({ javaScriptEnabled: false });
  test('the page explains itself and never shows an empty dialog', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('noscript')).toBeVisible();
    await expect(page.locator('#slide-details')).toBeHidden();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
  });
});

test.describe('the speaker view', () => {
  test('a preview never opens a dialog or expands a disclosure', async ({ page }) => {
    await authorMarkdown(page, standard);
    await page.setViewportSize({ width: 640, height: 360 });
    await page.goto('?receiver&progress=false&history=false&transition=none#/1/0');
    await expect(page.locator('html')).toHaveAttribute('data-deck-ready', 'true');
    await expect(page.locator('html')).toHaveAttribute('data-receiver', 'true');
    await page.evaluate(() => document.querySelector<HTMLElement>('#history summary')!.click());
    await page.waitForTimeout(200);
    await expect(dialogOf(page)).toBeHidden();
    expect((await wrapperHome(page)).open).toBe(false);
    expect(new URL(page.url()).hash).toBe('#/1/0');
  });

  test.describe('the real speaker view', () => {
    test.setTimeout(90_000);
    const stateOf = (frame: Frame) => frame.evaluate(() => ({
      present: [...document.querySelectorAll('.slides section.present')].pop()?.id ?? '',
      open: document.querySelector<HTMLDetailsElement>('#history details')?.open ?? null,
      dialog: document.querySelector<HTMLDialogElement>('#slide-details')?.open ?? false,
    }));

    test('the overlay never moves the audience or the previews, and a preview ignores a click', async ({ page }) => {
      await page.context().route(assetRequest('slides.md'), (route) => route.fulfill({ contentType: 'text/markdown', body: standard }));
      await ready(page, '?mode=present#/history');
      const { current, upcoming } = await openSpeakerView(page);
      await expect.poll(() => stateOf(current)).toEqual({ present: 'history', open: false, dialog: false });
      await page.bringToFront();
      await page.evaluate(() => {
        const log: string[] = [];
        (window as unknown as { audienceLog: string[] }).audienceLog = log;
        for (const node of document.querySelectorAll('.slides section')) {
          new MutationObserver(() => log.push(`${node.id}: ${node.className} at ${location.hash}`)).observe(node, { attributes: true, attributeFilter: ['class'] });
        }
        addEventListener('hashchange', () => log.push(`hash ${location.hash}`));
        // The speaker view's own heartbeat is not state; any other message to the audience would be.
        addEventListener('message', (event) => {
          if (!String(event.data).includes('"heartbeat"')) log.push(`message ${String(event.data).slice(0, 60)}`);
        });
      });
      for (let round = 1; round <= 3; round++) {
        await summaryOf(page).click();
        await expect(dialogOf(page)).toBeVisible();
        await page.waitForTimeout(400);
        await page.keyboard.press('Escape');
        await expect(dialogOf(page)).toBeHidden();
        await page.waitForTimeout(400);
      }
      await current.evaluate(() => document.querySelector<HTMLElement>('#history summary')?.click());
      await upcoming.evaluate(() => document.querySelector<HTMLElement>('#history summary')?.click());
      await page.waitForTimeout(800);
      expect(await stateOf(current)).toEqual({ present: 'history', open: false, dialog: false });
      expect((await stateOf(upcoming)).open).not.toBe(true);
      expect(await page.evaluate(() => (window as unknown as { audienceLog: string[] }).audienceLog)).toEqual([]);
      expect(new URL(page.url()).hash).toBe('#/history');
    });

    test('moving the audience on from the speaker view closes the dialog and puts the content back', async ({ page }) => {
      await page.context().route(assetRequest('slides.md'), (route) => route.fulfill({ contentType: 'text/markdown', body: standard }));
      await ready(page, '?mode=present#/history');
      const { view } = await openSpeakerView(page);
      await page.bringToFront();
      await summaryOf(page).click();
      await expect(dialogOf(page)).toBeVisible();
      await view.bringToFront();
      await view.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => undefined);
      await view.keyboard.press('ArrowRight');
      await expect(page).toHaveURL(/#\/after$/, { timeout: 8000 });
      await expect(dialogOf(page)).toBeHidden();
      expect(await wrapperHome(page)).toEqual({ summaries: 1, others: 1, open: false });
    });
  });
});

test.describe('the dialog with the longest content', () => {
  for (const [width, height] of [[1440, 900], [1280, 720], [617, 800], [390, 844], [320, 568]]) {
    test(`fits ${width}x${height} and scrolls inside itself`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await open(page, extremeDeck, '?mode=present#/extreme');
      await summaryOf(page, 'extreme').scrollIntoViewIfNeeded();
      const before = await snapshot(page, 'extreme');
      await summaryOf(page, 'extreme').click();
      await expect(dialogOf(page)).toBeVisible();
      expect(await snapshot(page, 'extreme')).toEqual(before);
      const fit = await dialogOf(page).evaluate((dialog) => {
        const { left, right, top, bottom } = dialog.getBoundingClientRect();
        const region = dialog.querySelector<HTMLElement>('[role="region"]')!;
        const pre = dialog.querySelector<HTMLElement>('pre')!;
        const close = dialog.querySelector('button')!.getBoundingClientRect();
        const reaches = (node: Element) => {
          const box = node.getBoundingClientRect();
          return box.left >= left - 0.5 && box.right <= right + 0.5;
        };
        return {
          left, right, top, bottom,
          page: document.documentElement.scrollWidth - innerWidth,
          regionAcross: region.scrollWidth - region.clientWidth,
          regionDown: region.scrollHeight - region.clientHeight,
          codeAcross: pre.scrollWidth - pre.clientWidth,
          codeFits: reaches(pre),
          textFits: [...dialog.querySelectorAll('p, li, a, summary, .details-title')].every(reaches),
          close: [close.width, close.height],
        };
      });
      expect(fit.left).toBeGreaterThanOrEqual(0);
      expect(fit.right).toBeLessThanOrEqual(width);
      expect(fit.top).toBeGreaterThanOrEqual(0);
      expect(fit.bottom).toBeLessThanOrEqual(height);
      expect(fit.page, 'the page gains no horizontal scroll').toBeLessThanOrEqual(0);
      expect(fit.regionAcross, 'the dialog never scrolls sideways').toBeLessThanOrEqual(1);
      expect(fit.regionDown, 'the dialog scrolls down inside itself').toBeGreaterThan(100);
      expect(fit.codeAcross, 'a wide code line scrolls inside its own window').toBeGreaterThan(0);
      expect(fit.codeFits).toBe(true);
      expect(fit.textFits, 'every line of text stays inside the dialog').toBe(true);
      expect(Math.min(...fit.close)).toBeGreaterThanOrEqual(43.5);
      // The counter and the message sit under the modal layer, so nothing of them can be painted over the content.
      const covered = await page.evaluate(() => {
        return ['slide-position', 'deck-status'].map((id) => {
          const node = document.getElementById(id)!;
          if (getComputedStyle(node).display === 'none') return true;
          const { left, top, width, height } = node.getBoundingClientRect();
          const old = node.style.pointerEvents;
          node.style.pointerEvents = 'auto';
          const hit = document.elementFromPoint(left + width / 2, top + height / 2);
          node.style.pointerEvents = old;
          return hit !== node;
        });
      });
      expect(covered).toEqual([true, true]);
      // The wheel scrolls the dialog, not the slide behind it.
      const box = (await dialogOf(page).boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      for (let wheel = 0; wheel < 4; wheel++) await page.mouse.wheel(0, 600);
      await expect.poll(() => regionOf(page).evaluate((region) => region.scrollTop)).toBeGreaterThan(100);
      expect(await snapshot(page, 'extreme')).toEqual(before);
      // The last line can be reached, and it is not under the edge of the dialog.
      await regionOf(page).evaluate((region) => { region.scrollTop = region.scrollHeight; });
      const last = await dialogOf(page).evaluate((dialog) => {
        const region = dialog.querySelector('[role="region"]')!.getBoundingClientRect();
        const item = dialog.querySelector('details')!.getBoundingClientRect();
        return item.bottom <= region.bottom + 1 && item.top >= region.top - 1;
      });
      expect(last).toBe(true);
      await page.keyboard.press('Escape');
      await expect(dialogOf(page)).toBeHidden();
      expect(await snapshot(page, 'extreme')).toEqual(before);
    });
  }
});

for (const theme of ['light', 'dark']) {
  test.describe(`${theme} theme`, () => {
    test('a presentation with a disclosure, closed and open, passes axe', async ({ page }) => {
      await open(page, extremeDeck, `?mode=present&theme=${theme}#/extreme`);
      const scan = async () => {
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        expect(results.violations).toEqual([]);
      };
      await scan();
      await summaryOf(page, 'extreme').click();
      await expect(dialogOf(page)).toBeVisible();
      await scan();
      await dialogOf(page).locator('details summary').click();
      await scan();
    });

    test('the reading mode passes axe with the disclosure open', async ({ page }) => {
      await open(page, extremeDeck, `?mode=read&theme=${theme}#/extreme`);
      await summaryOf(page, 'extreme').click();
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(results.violations).toEqual([]);
    });
  });
}
