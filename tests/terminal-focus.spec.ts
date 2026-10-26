import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Frame, type Page } from '@playwright/test';
import { assetRequest, authorDeck, authorMarkdown, captureClipboard, expectCopied, jump, openSpeakerView, ready, settleMotion } from './helpers';
import { starter } from './starter';

// Terminal focus is opt-in per slide: `data-terminal-focus="true"` gives a recorded terminal the whole slide once its output is
// revealed. Every test here authors its own deck, so none depends on the slides a deck happens to ship.
const fence = '```';
const command = 'tool list --verbose';
const long = Array.from({ length: 60 }, (_, index) => `line ${String(index + 1).padStart(2, '0')} of the complete output`).join('\n');
const short = ['web      http://localhost:8000', 'api      http://localhost:8001', 'cache    redis://localhost:6379'].join('\n');
const next = '<!-- .slide: id="after" -->\n## After\n\nThe next slide.\n';

// A slide with a recorded terminal. `focus` is the authored data-terminal-focus value, or null for a slide that leaves it out.
// The support line is marked on every slide, to show that the marker alone changes nothing.
function terminalSlide(id: string, { focus = 'true', output = long }: { focus?: string | null; output?: string } = {}) {
  return [
    `<!-- .slide: id="${id}" data-kicker="Terminal"${focus === null ? '' : ` data-terminal-focus="${focus}"`} -->`,
    '## Run it, then **reveal** the result',
    '',
    `${fence}bash`,
    command,
    fence,
    '<!-- .element: data-terminal="Recorded example" data-caption="Terminal" -->',
    '',
    `${fence}text`,
    output,
    fence,
    '',
    'Recorded on 2026-10-23. Read the [capture notes](https://example.com/capture) for the source.',
    '<!-- .element: class="source-line terminal-support" -->',
    '',
  ].join('\n');
}

const deck = (...slides: string[]) => [...slides, next].join('\n---\n\n');
const focusDeck = deck(terminalSlide('focus'), terminalSlide('plain', { focus: null }));

async function open(page: Page, markdown: string, id: string, path = '?mode=present') {
  await authorMarkdown(page, markdown);
  await ready(page, path);
  await jump(page, id);
}

type Rect = { top: number; bottom: number; left: number; right: number; width: number; height: number };

const rect = (page: Page, selector: string): Promise<Rect> => page.locator(selector).first().evaluate((node) => {
  const { top, bottom, left, right, width, height } = node.getBoundingClientRect();
  return { top, bottom, left, right, width, height };
});

const intersects = (a: Rect, b: Rect) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;

// How much of an element is really on screen: its box, cut down by every ancestor that clips its overflow.
const shown = (page: Page, selector: string) => page.locator(selector).first().evaluate((node) => {
  const box = node.getBoundingClientRect();
  let top = box.top;
  let bottom = box.bottom;
  for (let parent = node.parentElement; parent; parent = parent.parentElement) {
    if (getComputedStyle(parent).overflowY === 'visible') continue;
    const clip = parent.getBoundingClientRect();
    top = Math.max(top, clip.top);
    bottom = Math.min(bottom, clip.bottom);
  }
  return Math.max(0, bottom - top);
});

async function layout(page: Page, id: string) {
  return {
    heading: await rect(page, `#${id} h2`),
    kicker: await rect(page, `#${id} .slide-kicker`),
    panel: await rect(page, `#${id} .terminal-panel`),
    header: await rect(page, `#${id} .terminal-panel figcaption`),
    line: await rect(page, `#${id} .terminal-command-line`),
    copy: await rect(page, `#${id} .terminal-panel .copy-code`),
    support: await rect(page, `#${id} .terminal-support`),
  };
}

function expectSame(actual: Record<string, Rect>, expected: Record<string, Rect>) {
  for (const name of Object.keys(expected)) {
    for (const side of ['top', 'bottom', 'left', 'right', 'height'] as const) {
      expect(Math.abs(actual[name][side] - expected[name][side]), `${name}.${side}`).toBeLessThanOrEqual(0.5);
    }
  }
}

const focused = (page: Page, id = 'focus') => expect(page.locator(`#${id}`)).toHaveClass(/is-terminal-focused/);
const notFocused = (page: Page, id = 'focus') => expect(page.locator(`#${id}`)).not.toHaveClass(/is-terminal-focused/);

async function reveal(page: Page, id = 'focus') {
  await page.keyboard.press('Space');
  await expect(page.locator(`#${id} .terminal-response`)).toHaveClass(/visible/);
  await settleMotion(page);
}

async function accessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]);
}

// A real selection and a real Ctrl+C, as an audience member would copy it.
async function copiedBySelection(page: Page, selector: string) {
  await page.evaluate((target) => {
    const range = document.createRange();
    range.selectNodeContents(document.querySelector(target)!);
    const selection = getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
  }, selector);
  await page.evaluate(() => navigator.clipboard.writeText('sentinel'));
  await page.keyboard.press('Control+C');
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).not.toBe('sentinel');
  return (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n');
}

test.describe('a slide that leaves terminal focus out', () => {
  test('keeps its heading, support copy and capped output, even with a marked support line', async ({ page }) => {
    await open(page, focusDeck, 'plain');
    const before = await layout(page, 'plain');
    await reveal(page, 'plain');
    await notFocused(page, 'plain');
    const after = await layout(page, 'plain');
    // Nothing above or below the terminal moves or disappears: the heading, the kicker and the support line all stay.
    expect(after.heading).toEqual(before.heading);
    expect(after.kicker).toEqual(before.kicker);
    expect(after.panel.top).toBe(before.panel.top);
    expect(await shown(page, '#plain h2')).toBeGreaterThan(40);
    await expect(page.locator('#plain .terminal-support')).toBeVisible();
    await expect(page.locator('#plain .terminal-support')).not.toHaveAttribute('inert', /.*/);
    expect(await page.locator('#plain .terminal-output').evaluate((pre) => pre.clientHeight)).toBeLessThanOrEqual(300);
  });
});

test.describe('terminal focus in a presentation', () => {
  test('revealing the output lifts the terminal into the title space and gives it the slide', async ({ page }) => {
    await open(page, focusDeck, 'focus');
    const before = await layout(page, 'focus');
    await notFocused(page);
    expect(await shown(page, '#focus h2')).toBeGreaterThan(40);
    expect(await shown(page, '#focus .slide-kicker')).toBeGreaterThan(10);
    await expect(page.locator('#focus .terminal-support')).toBeVisible();
    await expect(page.locator('#focus .terminal-output')).toBeHidden();

    await page.keyboard.press('Space');
    await expect(page.locator('#focus .terminal-response')).toHaveClass(/visible/);
    await focused(page);
    await settleMotion(page);

    expect(await shown(page, '#focus h2')).toBe(0);
    expect(await shown(page, '#focus .slide-kicker')).toBe(0);
    // The heading is hidden, not removed: it is still the slide's heading for assistive technology and the menu.
    await expect(page.locator('#focus h2')).toHaveText('Run it, then reveal the result');
    await expect(page.locator('#focus .terminal-support')).toBeHidden();
    await expect(page.locator('#focus .terminal-support')).toHaveAttribute('inert', '');
    const after = await layout(page, 'focus');
    expect(before.panel.top - after.panel.top).toBeGreaterThan(before.heading.height + before.kicker.height - 1);
    // The chrome is the same window: header, command and Copy keep their size and stay on screen.
    expect(Math.abs(after.header.height - before.header.height)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(after.line.height - before.line.height)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(after.copy.width - before.copy.width)).toBeLessThanOrEqual(0.5);
    await expect(page.locator('#focus .terminal-panel .copy-code')).toBeVisible();
    expect(after.panel.top).toBeGreaterThan(56);
    expect(after.panel.bottom).toBeLessThanOrEqual(900);

    // The output takes the room the heading and the support line gave up, instead of the 300px cap.
    const output = page.locator('#focus .terminal-output');
    expect(await output.evaluate((pre) => pre.clientHeight)).toBeGreaterThan(420);
    expect(await output.evaluate((pre) => pre.scrollHeight - pre.clientHeight)).toBeGreaterThan(500);
    await expect(output).toHaveAttribute('role', 'region');
    expect(Math.abs(after.panel.bottom - (await rect(page, '#focus .terminal-output')).bottom)).toBeLessThanOrEqual(2);
  });

  test('a short output keeps its natural height instead of stretching an empty window', async ({ page }) => {
    await open(page, deck(terminalSlide('focus', { output: short })), 'focus');
    await reveal(page);
    await focused(page);
    const output = page.locator('#focus .terminal-output');
    expect(await output.evaluate((pre) => pre.scrollHeight <= pre.clientHeight + 1)).toBe(true);
    expect(await output.evaluate((pre) => pre.clientHeight)).toBeLessThan(200);
    expect(await output.locator('code').textContent()).toBe(short);
  });

  test('Back restores the exact composition and focusability', async ({ page }) => {
    await open(page, focusDeck, 'focus');
    const before = await layout(page, 'focus');
    await reveal(page);
    await focused(page);
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#focus .terminal-response')).not.toHaveClass(/visible/);
    await notFocused(page);
    await settleMotion(page);
    expectSame(await layout(page, 'focus'), before);
    expect(await shown(page, '#focus h2')).toBeGreaterThan(40);
    await expect(page.locator('#focus .terminal-support')).toBeVisible();
    await expect(page.locator('#focus .terminal-support')).not.toHaveAttribute('inert', /.*/);
    await page.locator('#focus .terminal-support a').focus();
    await expect(page.locator('#focus .terminal-support a')).toBeFocused();
    await expect(page.locator('#focus .terminal-output')).toBeHidden();
  });

  test('the support link leaves the Tab order while the output is focused and returns on Back', async ({ page }) => {
    await open(page, focusDeck, 'focus');
    const stops = async () => {
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      const seen: string[] = [];
      for (let press = 0; press < 40; press++) {
        await page.keyboard.press('Tab');
        seen.push(await page.evaluate(() => {
          const active = document.activeElement;
          return `${active?.closest('.terminal-support') ? 'support' : active?.closest('.terminal-output') ? 'output' : active?.localName ?? 'none'}`;
        }));
      }
      return seen;
    };
    expect(await stops()).toContain('support');
    await page.locator('#presentation').focus();
    await reveal(page);
    const focusedStops = await stops();
    expect(focusedStops).not.toContain('support');
    expect(focusedStops).toContain('output');
    await page.locator('#presentation').focus();
    await page.keyboard.press('ArrowLeft');
    await notFocused(page);
    expect(await stops()).toContain('support');
  });

  test('a link that has focus when the layout collapses hands focus back to the presentation', async ({ page }) => {
    await open(page, focusDeck, 'focus');
    await page.locator('#focus .terminal-support a').focus();
    await expect(page.locator('#focus .terminal-support a')).toBeFocused();
    await page.evaluate(() => { location.hash = '#/focus/0'; });
    await focused(page);
    await expect(page.locator('#focus .terminal-support a')).not.toBeFocused();
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('presentation');
  });

  test('the long output scrolls on its own while the header and command stay put', async ({ page }) => {
    await open(page, focusDeck, 'focus');
    await reveal(page);
    await focused(page);
    const output = page.locator('#focus .terminal-output');
    const fixed = await layout(page, 'focus');
    await output.hover();
    await page.mouse.wheel(0, 240);
    await expect.poll(() => output.evaluate((pre) => pre.scrollTop)).toBeGreaterThan(100);
    await output.focus();
    const scrolled = await output.evaluate((pre) => pre.scrollTop);
    await page.keyboard.press('PageDown');
    await expect.poll(() => output.evaluate((pre) => pre.scrollTop)).toBeGreaterThan(scrolled);
    // The keys scrolled the output; they did not advance the deck.
    await expect(page.locator('#focus')).toHaveClass(/present/);
    await output.evaluate((pre) => { pre.scrollTop = pre.scrollHeight; });
    const last = await output.evaluate((pre) => {
      const lines = pre.querySelectorAll<HTMLElement>('.code-line');
      const end = lines[lines.length - 1];
      return end.offsetTop + end.offsetHeight <= pre.scrollTop + pre.clientHeight && end.textContent;
    });
    expect(last).toBe('line 60 of the complete output');
    const still = await layout(page, 'focus');
    expectSame({ header: still.header, line: still.line, panel: still.panel }, { header: fixed.header, line: fixed.line, panel: fixed.panel });
    expect(await page.evaluate(() => document.getElementById('slide-viewport')!.scrollTop + document.scrollingElement!.scrollTop)).toBe(0);
  });

  test('Copy takes the command and a selection takes the complete output, exactly', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await captureClipboard(page);
    await open(page, focusDeck, 'focus');
    await reveal(page);
    await focused(page);
    await page.locator('#focus .copy-code').click();
    await expectCopied(page, command);
    await expect(page.locator('#deck-status')).toHaveText('Terminal command copied.');
    expect(await copiedBySelection(page, '#focus .terminal-output code')).toBe(long);
  });

  test('deep links, reload, Back and Forward land on the same layout as stepping does', async ({ page }) => {
    await authorMarkdown(page, focusDeck);
    await ready(page, '?mode=present#/focus/0');
    await focused(page);
    await settleMotion(page);
    expect(await shown(page, '#focus h2')).toBe(0);
    const stepped = await layout(page, 'focus');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-deck-ready', 'true');
    await focused(page);
    await settleMotion(page);
    expectSame(await layout(page, 'focus'), stepped);

    await page.evaluate(() => { location.hash = '#/focus'; });
    await notFocused(page);
    await settleMotion(page);
    expect(await shown(page, '#focus h2')).toBeGreaterThan(40);
    await page.goBack();
    await focused(page);
    await settleMotion(page);
    expect(await shown(page, '#focus h2')).toBe(0);
    await page.goForward();
    await notFocused(page);
    await page.keyboard.press('Space');
    await focused(page);
    expect(new URL(page.url()).hash).toBe('#/focus/0');
  });

  test('moving to the next slide and back keeps the layout consistent with the output', async ({ page }) => {
    await open(page, focusDeck, 'focus');
    await reveal(page);
    await page.keyboard.press('Space');
    await expect(page.locator('#plain')).toHaveClass(/present/);
    await settleMotion(page);
    await notFocused(page, 'plain');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#focus')).toHaveClass(/present/);
    await settleMotion(page);
    await focused(page);
    await expect(page.locator('#focus .terminal-response')).toHaveClass(/visible/);
  });

  test('a restrained transition runs in one motion and respects the existing duration', async ({ page }) => {
    await open(page, focusDeck, 'focus');
    await settleMotion(page);
    await page.keyboard.press('Space');
    await focused(page);
    const motion = await page.locator('#focus').evaluate(async (slide) => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      // What the layout animates is inside the slide. The slide's own fade belongs to the deck's slide transition, not to this layout.
      return slide.getAnimations({ subtree: true })
        .filter((animation): animation is CSSTransition => animation instanceof CSSTransition && (animation.effect as KeyframeEffect).target !== slide)
        .map((transition) => ({
          target: ((transition.effect as KeyframeEffect).target as Element).className,
          property: transition.transitionProperty,
          duration: Number(transition.effect!.getComputedTiming().duration),
        }));
    });
    expect(motion.map((transition) => transition.target)).toEqual(expect.arrayContaining(['terminal-lead', 'terminal-lead-body']));
    for (const transition of motion) {
      expect(transition.duration, `${transition.target} ${transition.property}`).toBeGreaterThanOrEqual(100);
      expect(transition.duration, `${transition.target} ${transition.property}`).toBeLessThanOrEqual(400);
    }
    await settleMotion(page);
    expect(await shown(page, '#focus h2')).toBe(0);
  });
});

test.describe('terminal focus is a presentation layout only', () => {
  test('reading mode keeps the heading and support copy, and switching modes restores the layout without a reload', async ({ page }) => {
    await authorMarkdown(page, focusDeck);
    await ready(page, '?mode=read');
    // Reading mode is one long page, so bring the slide into view before measuring what is on screen.
    await jump(page, 'focus');
    await expect(page.locator('#focus')).not.toHaveClass(/is-terminal-focused/);
    expect(await shown(page, '#focus h2')).toBeGreaterThan(30);
    await expect(page.locator('#focus .terminal-support')).toBeVisible();
    await expect(page.locator('#focus .terminal-support')).not.toHaveAttribute('inert', /.*/);
    const output = page.locator('#focus .terminal-output');
    await expect(output).toBeVisible();
    expect(await output.evaluate((pre) => pre.scrollHeight <= pre.clientHeight + 1)).toBe(true);
    expect(await output.locator('code').textContent()).toBe(long);

    await page.keyboard.press('r');
    await expect(page.locator('html')).toHaveAttribute('data-reading', 'false');
    await jump(page, 'focus');
    await notFocused(page);
    await reveal(page);
    await focused(page);
    expect(await shown(page, '#focus h2')).toBe(0);
    await page.keyboard.press('r');
    await expect(page.locator('html')).toHaveAttribute('data-reading', 'true');
    await notFocused(page);
    await settleMotion(page);
    expect(await shown(page, '#focus h2')).toBeGreaterThan(30);
    await expect(page.locator('#focus .terminal-support')).toBeVisible();
    await expect(page.locator('#focus .terminal-support')).not.toHaveAttribute('inert', /.*/);
  });

  test('print keeps the heading, the support copy and the complete output', async ({ page }) => {
    await authorMarkdown(page, focusDeck);
    await ready(page, '?print-pdf&theme=light');
    await page.locator('.pdf-page').first().waitFor({ state: 'attached' });
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.is-terminal-focused')).toHaveCount(0);
    expect(await shown(page, '#focus h2')).toBeGreaterThan(30);
    await expect(page.locator('#focus .terminal-support')).toBeVisible();
    const output = page.locator('#focus .terminal-output');
    await expect(output).toHaveCSS('max-height', 'none');
    expect(await output.evaluate((pre) => pre.scrollHeight <= pre.clientHeight + 1)).toBe(true);
    expect(await output.locator('code').textContent()).toBe(long);
  });

  test('reduced motion shows the focused layout at once, with no running animation, and follows the setting live', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, focusDeck, 'focus');
    await expect(page.locator('html')).toHaveAttribute('data-static', 'true');
    // Fragments are off, so the output is shown on arrival and the layout is focused from the first frame.
    await focused(page);
    expect(await shown(page, '#focus h2')).toBe(0);
    await expect(page.locator('#focus .terminal-support')).toBeHidden();
    expect(await page.locator('#focus').evaluate((slide) => slide.getAnimations({ subtree: true }).length)).toBe(0);

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(page.locator('html')).toHaveAttribute('data-static', 'false');
    await notFocused(page);
    await settleMotion(page);
    expect(await shown(page, '#focus h2')).toBeGreaterThan(40);
    await expect(page.locator('#focus .terminal-support')).toBeVisible();
    await expect(page.locator('#focus .terminal-output')).toBeHidden();
  });

  test('a speaker-view preview mirrors the fragment state at once', async ({ page }) => {
    await authorMarkdown(page, focusDeck);
    await page.setViewportSize({ width: 640, height: 360 });
    await page.goto('?receiver&progress=false&history=false&transition=none#/1/0');
    await expect(page.locator('html')).toHaveAttribute('data-deck-ready', 'true');
    await expect(page.locator('html')).toHaveAttribute('data-receiver', 'true');
    await notFocused(page);
    expect(await shown(page, '#focus h2')).toBeGreaterThan(10);
    // The speaker view positions its previews with Reveal's own setState message, so a preview is driven the same way here.
    const setState = (indexf: number) => page.evaluate((fragment) => {
      window.postMessage(JSON.stringify({ method: 'setState', args: [{ indexh: 1, indexv: 0, indexf: fragment, paused: false, overview: false }] }), '*');
    }, indexf);
    await setState(0);
    await focused(page);
    // No settling: the heading is already gone and the support copy already hidden.
    expect(await shown(page, '#focus h2')).toBe(0);
    await expect(page.locator('#focus .terminal-support')).toBeHidden();
    await expect(page.locator('#slide-position')).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await setState(-1);
    await notFocused(page);
    expect(await shown(page, '#focus h2')).toBeGreaterThan(10);
  });

  test.describe('the real speaker view', () => {
    test.setTimeout(90_000);
    const layoutOf = (frame: Frame) => frame.evaluate(() => {
      const slide = [...document.querySelectorAll('.slides section.present')].pop();
      return { id: slide?.id ?? '', focused: slide?.classList.contains('is-terminal-focused') ?? false };
    });

    test('the current preview follows the audience and the upcoming preview shows the focused step', async ({ page }) => {
      // The popup and its preview frames are other pages, so the fixture is routed for the whole browser context.
      await page.context().route(assetRequest('slides.md'), (route) => route.fulfill({ contentType: 'text/markdown', body: focusDeck }));
      await ready(page);
      await jump(page, 'focus');
      const { current, upcoming } = await openSpeakerView(page);
      await expect.poll(() => layoutOf(current)).toEqual({ id: 'focus', focused: false });
      await expect.poll(() => layoutOf(upcoming)).toEqual({ id: 'focus', focused: true });
      await page.bringToFront();
      await reveal(page);
      await expect.poll(() => layoutOf(current), { timeout: 8000 }).toEqual({ id: 'focus', focused: true });
      await page.keyboard.press('ArrowLeft');
      await expect.poll(() => layoutOf(current), { timeout: 8000 }).toEqual({ id: 'focus', focused: false });
    });

    test('opening the speaker view while the output is focused never moves the audience, not even for a frame', async ({ page }) => {
      await page.context().route(assetRequest('slides.md'), (route) => route.fulfill({ contentType: 'text/markdown', body: focusDeck }));
      await ready(page);
      await jump(page, 'focus');
      await reveal(page);
      await focused(page);
      // From here on, record every change of the audience's layout and address, however brief.
      await page.evaluate(() => {
        const log: string[] = [];
        (window as unknown as { audienceLog: string[] }).audienceLog = log;
        const slide = document.getElementById('focus')!;
        let layout = slide.classList.contains('is-terminal-focused');
        new MutationObserver(() => {
          const now = slide.classList.contains('is-terminal-focused');
          if (now !== layout) {
            layout = now;
            log.push(`${now ? 'focused' : 'standard'} at ${location.hash}`);
          }
        }).observe(slide, { attributes: true, attributeFilter: ['class'] });
        addEventListener('hashchange', () => log.push(`hash ${location.hash}`));
      });
      for (let attempt = 1; attempt <= 3; attempt++) {
        const { view, current, upcoming } = await openSpeakerView(page);
        await expect.poll(() => layoutOf(current), { message: `open ${attempt}: current preview` }).toEqual({ id: 'focus', focused: true });
        await expect.poll(() => layoutOf(upcoming), { message: `open ${attempt}: upcoming preview` }).toEqual({ id: 'plain', focused: false });
        // A late relay from either preview would have landed by now.
        await page.waitForTimeout(1500);
        await view.close();
        await page.bringToFront();
        await focused(page);
      }
      expect(await page.evaluate(() => (window as unknown as { audienceLog: string[] }).audienceLog)).toEqual([]);
      expect(new URL(page.url()).hash).toBe('#/focus/0');
    });
  });
});

test.describe('terminal focus and the fixed counter and messages', () => {
  const corners = ['bottom-left', 'bottom-right', 'top-left', 'top-right'] as const;
  for (const [width, height] of [[1440, 900], [1024, 768], [800, 600], [390, 844], [320, 568]]) {
    test(`the terminal clears the counter in every corner, and the copy message: ${width}x${height}`, async ({ page, context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.setViewportSize({ width, height });
      for (const slideNumber of [...corners.map((position) => ({ position })), { visible: false }]) {
        const label = JSON.stringify(slideNumber);
        await authorDeck(page, { slideNumber }, focusDeck);
        await ready(page, '?mode=present');
        await jump(page, 'focus');
        await reveal(page);
        await focused(page);
        await page.locator('#focus .copy-code').click();
        await expect(page.locator('#deck-status')).toHaveText('Terminal command copied.');
        const panel = await rect(page, '#focus .terminal-panel');
        const copy = await rect(page, '#focus .terminal-panel .copy-code');
        const status = await rect(page, '#deck-status');
        const badge = await page.locator('#slide-position').isVisible() ? await rect(page, '#slide-position') : null;
        expect(panel.left, label).toBeGreaterThanOrEqual(0);
        expect(panel.right, label).toBeLessThanOrEqual(width);
        expect(panel.top, label).toBeGreaterThanOrEqual(56);
        expect(panel.bottom, label).toBeLessThanOrEqual(height);
        expect(copy.height, label).toBeGreaterThanOrEqual(43.5);
        expect(intersects(panel, status), `${label}: the copy message stays off the terminal`).toBe(false);
        if (badge) {
          expect(intersects(panel, badge), `${label}: the counter stays off the terminal`).toBe(false);
          expect(intersects(status, badge), `${label}: the message stays off the counter`).toBe(false);
        } else {
          expect(slideNumber, label).toEqual({ visible: false });
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label).toBe(true);
      }
    });
  }
});

test.describe('terminal focus in a narrow presentation', () => {
  for (const [width, height] of [[390, 844], [320, 568]]) {
    test(`the terminal fills the screen without overflow or a scrolling page: ${width}x${height}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await open(page, focusDeck, 'focus');
      await expect(page.locator('html')).toHaveAttribute('data-compact', 'true');
      await expect(page.locator('html')).toHaveAttribute('data-reading', 'false');
      const before = await layout(page, 'focus');
      await reveal(page);
      await focused(page);
      expect(await shown(page, '#focus h2')).toBe(0);
      await expect(page.locator('#focus .terminal-support')).toBeHidden();
      const after = await layout(page, 'focus');
      expect(after.panel.top).toBeLessThan(before.panel.top - 40);
      expect(after.copy.height).toBeGreaterThanOrEqual(43.5);
      const output = page.locator('#focus .terminal-output');
      expect(await output.evaluate((pre) => pre.scrollHeight - pre.clientHeight)).toBeGreaterThan(200);
      expect(await output.evaluate((pre) => pre.clientHeight)).toBeGreaterThan(80);
      const fits = await page.evaluate(() => {
        const viewport = document.getElementById('slide-viewport')!;
        return { horizontal: document.documentElement.scrollWidth > innerWidth, vertical: viewport.scrollHeight > viewport.clientHeight + 1, scrolled: viewport.scrollTop };
      });
      expect(fits).toEqual({ horizontal: false, vertical: false, scrolled: 0 });
      await page.keyboard.press('ArrowLeft');
      await notFocused(page);
      await settleMotion(page);
      expect(await shown(page, '#focus h2')).toBeGreaterThan(20);
    });
  }
});

for (const theme of ['light', 'dark']) {
  test(`the focused terminal passes an accessibility scan in ${theme}`, async ({ page }) => {
    await authorMarkdown(page, focusDeck);
    await ready(page, `?mode=present&theme=${theme}`);
    await jump(page, 'focus');
    await accessible(page);
    await reveal(page);
    await focused(page);
    await accessible(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await settleMotion(page);
    await accessible(page);
  });
}

test.describe('a data-terminal-focus that cannot work fails the load and names the slide', () => {
  const inColumn = `<!-- .slide: id="focus" class="layout-split" data-terminal-focus="true" -->\n## Beside\n\n<div class="layout-visual">\n\n${fence}bash\n${command}\n${fence}\n<!-- .element: data-terminal="Recorded example" -->\n\n${fence}text\n${short}\n${fence}\n\n</div>\n`;
  const two = `${terminalSlide('focus').trimEnd()}\n\n${fence}bash\n${command}\n${fence}\n<!-- .element: data-terminal="Recorded example" -->\n\n${fence}text\n${short}\n${fence}\n`;
  for (const [name, markdown, message] of [
    ['is "false"', deck(terminalSlide('focus', { focus: 'false' })), 'data-terminal-focus must be "true"'],
    ['is empty', deck(terminalSlide('focus', { focus: '' })), 'data-terminal-focus must be "true"'],
    ['is "TRUE"', deck(terminalSlide('focus', { focus: 'TRUE' })), 'data-terminal-focus must be "true"'],
    ['is "yes"', deck(terminalSlide('focus', { focus: 'yes' })), 'data-terminal-focus must be "true"'],
    ['has no recorded terminal', deck('<!-- .slide: id="focus" data-terminal-focus="true" -->\n## Nothing to run\n\nJust a paragraph.\n'), 'needs a recorded terminal'],
    ['has two recorded terminals', deck(two), 'one recorded terminal per slide'],
    ['has its terminal in a layout column', deck(inColumn), 'directly on the slide'],
  ] as const) {
    test(`a slide whose terminal focus ${name}`, async ({ page }) => {
      await authorMarkdown(page, markdown);
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('data-deck-ready', 'error');
      await expect(page.locator('#failure-detail')).toContainText('slide "focus"');
      await expect(page.locator('#failure-detail')).toContainText(message);
    });
  }
});

test.describe('the starter terminal slide', () => {
  test('opts in, keeps its recorded capture, and hands the output the whole slide', starter, async ({ page }) => {
    await ready(page);
    await jump(page, 'run-and-reveal');
    const slide = page.locator('#run-and-reveal');
    await expect(slide).toHaveAttribute('data-terminal-focus', 'true');
    await expect(slide.locator('.terminal-support')).toHaveCount(1);
    await expect(slide.locator('.terminal-support')).toContainText('Recorded with Node 22 on 2026-10-23; the output is pasted exactly as printed. Advance once to reveal it.');
    await expect(slide).not.toHaveClass(/is-terminal-focused/);
    expect(await shown(page, '#run-and-reveal h2')).toBeGreaterThan(40);
    const before = await rect(page, '#run-and-reveal .terminal-panel');

    await reveal(page, 'run-and-reveal');
    await focused(page, 'run-and-reveal');
    expect(await shown(page, '#run-and-reveal h2')).toBe(0);
    await expect(slide.locator('.terminal-support')).toBeHidden();
    expect((await rect(page, '#run-and-reveal .terminal-panel')).top).toBeLessThan(before.top - 60);
    const output = slide.locator('.terminal-output');
    expect(await output.evaluate((pre) => pre.scrollHeight <= pre.clientHeight + 1)).toBe(true);
    expect(JSON.parse((await output.locator('code').textContent())!)).toEqual({ web: 8000, api: 8001, cache: 8002 });
    expect(await slide.locator('.terminal-command').textContent()).toBe('node -p "JSON.stringify({ web: 8000, api: 8001, cache: 8002 }, null, 2)"');

    await page.keyboard.press('ArrowLeft');
    await notFocused(page, 'run-and-reveal');
    await settleMotion(page);
    expect(await shown(page, '#run-and-reveal h2')).toBeGreaterThan(40);
    await expect(slide.locator('.terminal-support')).toBeVisible();
  });

  test('reading mode and print keep the starter heading and its provenance line', starter, async ({ page }) => {
    await ready(page, '?mode=read');
    // Reading mode is one long page, so bring the slide into view before measuring what is on screen.
    await jump(page, 'run-and-reveal');
    await expect(page.locator('#run-and-reveal')).not.toHaveClass(/is-terminal-focused/);
    expect(await shown(page, '#run-and-reveal h2')).toBeGreaterThan(30);
    await expect(page.locator('#run-and-reveal .terminal-support')).toBeVisible();
    await expect(page.locator('#run-and-reveal .terminal-output')).toBeVisible();
  });
});
