import { expect, test, type Frame, type Page } from '@playwright/test';
import { authorMarkdown, jump, ready, renderedIds, settleMotion } from './helpers';
import { starter } from './starter';

// Everything here uses the real Reveal speaker view: a popup window with live current and upcoming previews.
async function openSpeakerView(page: Page, how: 'key' | 'menu' = 'key') {
  const popup = page.waitForEvent('popup');
  if (how === 'key') await page.keyboard.press('s');
  else {
    await page.locator('#menu-toggle').click();
    await page.locator('#notes').click();
  }
  const view = await popup;
  await view.waitForLoadState('load');
  await expect(view.locator('#connection-status')).toBeHidden({ timeout: 20_000 });
  const current = await previewFrame(view, '#current-slide iframe');
  const upcoming = await previewFrame(view, '#upcoming-slide iframe');
  return { view, current, upcoming };
}

async function previewFrame(view: Page, selector: string): Promise<Frame> {
  await expect(view.locator(selector)).toHaveCount(1, { timeout: 20_000 });
  // The popup sees a preview's finished document even when that preview navigates late or reloads. A navigating
  // iframe briefly has a document with no root element yet, so a slow origin must not make this wait throw.
  await view.waitForFunction((css) => document.querySelector<HTMLIFrameElement>(css)?.contentDocument?.documentElement?.dataset.deckReady === 'true', selector, { timeout: 30_000 });
  const frame = await (await view.locator(selector).elementHandle())!.contentFrame();
  if (!frame) throw new Error(`The ${selector} preview has no document.`);
  return frame;
}

const previewState = (frame: Frame) => frame.evaluate(() => {
  const present = [...document.querySelectorAll('.slides section.present')].pop();
  const viewport = document.getElementById('slide-viewport')!;
  const slides = document.querySelector('.slides') as HTMLElement;
  const transform = getComputedStyle(slides).transform;
  const scale = transform === 'none' ? 1 : Number(transform.slice(7, -1).split(',')[0]);
  return {
    id: present?.id ?? '',
    focus: present ? [...present.querySelectorAll('.code-line.is-focused')].map((line) => (line as HTMLElement).dataset.line).join(',') : '',
    width: innerWidth,
    receiver: document.documentElement.dataset.receiver,
    compact: document.documentElement.dataset.compact,
    reading: document.documentElement.dataset.reading,
    toolbarShown: getComputedStyle(document.getElementById('toolbar')!).display !== 'none',
    badgeShown: getComputedStyle(document.getElementById('slide-position')!).display !== 'none',
    overflow: getComputedStyle(viewport).overflowY,
    scale,
    horizontalScroll: document.documentElement.scrollWidth > innerWidth,
  };
});

const mainFocus = (page: Page, id: string) => page.locator(`#${id} .code-line.is-focused`).evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.line).join(','));
const notesText = (view: Page) => view.evaluate(() => (document.querySelector('.speaker-controls-notes .value') ?? document.querySelector('.speaker-controls-notes'))?.textContent?.replace(/\s+/g, ' ').trim() ?? '');

test.describe('the speaker view is usable while presenting', () => {
  test.setTimeout(90_000);

  test('S opens a connected speaker view whose previews follow Next and Back, whatever the deck', async ({ page }) => {
    await ready(page);
    const ids = await renderedIds(page);
    const { current, upcoming } = await openSpeakerView(page);
    for (const [name, frame] of [['current', current], ['upcoming', upcoming]] as const) {
      expect(await previewState(frame), name).toMatchObject({ receiver: 'true', compact: 'false', reading: 'false', toolbarShown: false, badgeShown: false });
    }
    await expect.poll(async () => (await previewState(current)).id).toBe(ids[0]);
    await expect.poll(async () => (await previewState(upcoming)).id).toBe(ids[1]);
    await page.bringToFront();
    await page.locator('#next').click();
    await settleMotion(page);
    const now = await page.locator('.slides section.present').last().getAttribute('id');
    expect(now).toBe(ids[1]);
    await expect.poll(async () => (await previewState(current)).id, { timeout: 8000 }).toBe(now);
    await page.locator('#previous').click();
    await settleMotion(page);
    await expect.poll(async () => (await previewState(current)).id, { timeout: 8000 }).toBe(ids[0]);
  });

  test('S opens one connected speaker view whose previews match the audience layout', starter, async ({ page }) => {
    await ready(page);
    await jump(page, 'apphost-example');
    const { view, current, upcoming } = await openSpeakerView(page);
    await expect(view.locator('#connection-status')).toBeHidden();
    for (const [name, frame] of [['current', current], ['upcoming', upcoming]] as const) {
      const state = await previewState(frame);
      // The previews are narrower than the phone breakpoint, so this is the case that used to fall into compact reading.
      expect(state.width, `${name} preview must be a narrow frame`).toBeLessThan(1000);
      expect(state, name).toMatchObject({ receiver: 'true', compact: 'false', reading: 'false', toolbarShown: false, badgeShown: false, overflow: 'hidden', horizontalScroll: false });
      expect(state.scale, `${name} preview scales the whole slide canvas`).toBeLessThan(1);
      expect(state.scale).toBeGreaterThan(0.2);
    }
    expect((await previewState(current)).id).toBe('apphost-example');
    // The URL flags that make these previews native survive boot: Reveal must not rewrite them away.
    for (const frame of [current, upcoming]) {
      const search = await frame.evaluate(() => location.search);
      expect(search).toContain('receiver');
      expect(search).toContain('history=false');
      expect(search).toContain('mode=present');
    }
    // The upcoming preview shows what Next will reveal: the next highlighted step on this slide.
    await expect.poll(async () => (await previewState(upcoming)).focus).toBe('3');
    // A second S focuses the same window instead of opening another.
    await page.bringToFront();
    await page.keyboard.press('s');
    await page.waitForTimeout(400);
    expect(page.context().pages().length).toBe(2);
  });

  test('notes, the clock and a running timer are shown for the current slide', starter, async ({ page }) => {
    await ready(page);
    await jump(page, 'apphost-example');
    const { view } = await openSpeakerView(page, 'menu');
    await expect.poll(() => notesText(view)).toContain('reference models an API');
    const timer = () => view.evaluate(() => document.querySelector('.timer')?.textContent?.replace(/\s+/g, '') ?? '');
    const seconds = (value: string) => value.split(':').map(Number).reduce((total, part) => total * 60 + part, 0);
    const first = await timer();
    expect(first).toMatch(/^\d\d:\d\d:\d\d$/);
    await expect.poll(async () => seconds(await timer()), { timeout: 6000 }).toBeGreaterThan(seconds(first));
    await expect(view.locator('.clock-value')).toHaveText(/\d+:\d\d\s?(AM|PM)/i);
    // Notes are for the presenter only: nothing from them is visible in the audience window.
    await expect(page.locator('#apphost-example aside.notes')).not.toBeVisible();
    expect(await page.locator('#presentation').evaluate((root) => (root as HTMLElement).innerText)).not.toContain('reference models an API');
  });

  test('Next, Back and every code step stay in sync, across the slide boundary and back again', starter, async ({ page }) => {
    await ready(page);
    await jump(page, 'apphost-example');
    const { view, current } = await openSpeakerView(page);
    const sync = async (label: string) => {
      const id = await page.locator('.slides section.present').last().getAttribute('id');
      await expect.poll(async () => (await previewState(current)).id, { message: `${label}: slide`, timeout: 8000 }).toBe(id);
      await expect.poll(async () => (await previewState(current)).focus, { message: `${label}: highlighted lines`, timeout: 8000 }).toBe(await mainFocus(page, id!));
      return id;
    };
    await page.bringToFront();
    await sync('start');
    const walked: string[] = [];
    for (const key of ['Space', 'Space', 'Space', 'Space']) {
      await page.keyboard.press(key);
      await settleMotion(page);
      await sync(`forward ${key}`);
      walked.push(await mainFocus(page, 'apphost-example'));
    }
    expect(walked).toEqual(['3', '4,5', '6', '7']);
    const before = await notesText(view);
    await page.keyboard.press('Space');
    await settleMotion(page);
    expect(await sync('after the last step')).toBe('apphost-csharp');
    await expect.poll(() => notesText(view)).not.toBe(before);
    await expect.poll(() => notesText(view)).toContain('read the legend first');
    await page.keyboard.press('Shift+Space');
    await settleMotion(page);
    expect(await sync('back into the stepped slide')).toBe('apphost-example');
    expect(await mainFocus(page, 'apphost-example')).toBe('7');
    for (const expected of ['6', '4,5', '3', '1']) {
      await page.keyboard.press('ArrowLeft');
      await settleMotion(page);
      await sync(`back to ${expected}`);
      expect(await mainFocus(page, 'apphost-example')).toBe(expected);
    }
    await page.locator('#next').click();
    await settleMotion(page);
    await sync('toolbar Next');
  });

  test('a reloaded preview is still a native preview and returns to the audience\'s step by itself', starter, async ({ page }) => {
    await ready(page);
    await jump(page, 'apphost-example');
    await page.keyboard.press('Space');
    await settleMotion(page);
    const { current, view } = await openSpeakerView(page);
    await expect.poll(async () => (await previewState(current)).focus).toBe('3');
    await current.evaluate(() => location.reload());
    const reloaded = await previewFrame(view, '#current-slide iframe');
    expect(await reloaded.evaluate(() => location.search)).toContain('receiver');
    expect(await previewState(reloaded)).toMatchObject({ receiver: 'true', compact: 'false', reading: 'false', toolbarShown: false, badgeShown: false });
    // The reloaded page opens on its URL's slide, so it needs no key press to catch up.
    await expect.poll(async () => (await previewState(reloaded)).focus, { timeout: 8000 }).toBe('3');
    await page.bringToFront();
    await page.keyboard.press('Space');
    await settleMotion(page);
    await expect.poll(async () => (await previewState(reloaded)).focus, { timeout: 8000 }).toBe('4,5');
    await expect.poll(async () => (await previewState(await previewFrame(view, '#upcoming-slide iframe'))).focus, { timeout: 8000 }).toBe('6');
  });

  test('previews that finish loading late still end on the audience\'s step and the one after it', starter, async ({ page }) => {
    test.setTimeout(120_000);
    // The speaker view sends the audience's position to its previews once, when the current preview starts. A preview that
    // is still loading then (a slow network, a busy machine) would otherwise stay on its opening step.
    await page.context().route((url) => url.searchParams.has('receiver') && url.searchParams.get('controls') === 'false', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await route.continue();
    });
    await ready(page);
    await jump(page, 'apphost-example');
    await page.keyboard.press('Space');
    await settleMotion(page);
    expect(await mainFocus(page, 'apphost-example')).toBe('3');
    const { current, upcoming } = await openSpeakerView(page);
    await expect.poll(async () => previewState(current), { timeout: 30_000 }).toMatchObject({ id: 'apphost-example', focus: '3' });
    await expect.poll(async () => previewState(upcoming), { timeout: 30_000 }).toMatchObject({ id: 'apphost-example', focus: '4,5' });
  });

  test('opening the speaker view mid-slide never moves the audience, and the previews show this step and the next', starter, async ({ page }) => {
    test.setTimeout(120_000);
    await ready(page);
    await jump(page, 'apphost-example');
    await page.keyboard.press('Space');
    await settleMotion(page);
    // The speaker view reports a preview's position back to the audience window a moment after the previews start. A stale
    // report used to send the audience back to the first line about one time in three, so open it several times.
    for (let attempt = 1; attempt <= 4; attempt++) {
      const { current, upcoming, view } = await openSpeakerView(page);
      await expect.poll(async () => previewState(current), { timeout: 15_000, message: `attempt ${attempt}` }).toMatchObject({ id: 'apphost-example', focus: '3' });
      await expect.poll(async () => previewState(upcoming), { timeout: 15_000, message: `attempt ${attempt}` }).toMatchObject({ id: 'apphost-example', focus: '4,5' });
      await page.waitForTimeout(1200);
      expect(await mainFocus(page, 'apphost-example'), `attempt ${attempt}: the audience stays on its step`).toBe('3');
      expect(new URL(page.url()).hash, `attempt ${attempt}: and keeps its address`).toBe('#/apphost-example/0');
      await view.close();
      await page.bringToFront();
      await page.waitForTimeout(300);
    }
  });

  test('keys pressed in the speaker window drive the audience view', starter, async ({ page }) => {
    await ready(page);
    await jump(page, 'apphost-example');
    const { view } = await openSpeakerView(page);
    await view.bringToFront();
    await view.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => undefined);
    await view.keyboard.press('ArrowRight');
    await expect.poll(() => mainFocus(page, 'apphost-example'), { timeout: 8000 }).toBe('3');
    await view.keyboard.press('ArrowLeft');
    await expect.poll(() => mainFocus(page, 'apphost-example'), { timeout: 8000 }).toBe('1');
  });

  test('a blocked pop-up is explained instead of failing silently', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => { window.open = () => null; });
    await ready(page);
    await page.keyboard.press('s');
    await expect(page.locator('#deck-status')).toContainText('blocked');
    await page.locator('#menu-toggle').click();
    await page.locator('#notes').click();
    await expect(page.locator('#deck-status')).toContainText('Allow pop-ups');
    expect(errors).toEqual([]);
  });
});

test.describe('slide motion is switched off in the speaker view previews', () => {
  test.setTimeout(90_000);

  test('both previews follow a chapter slide and the explicit in/out slide with no transition and no delay', starter, async ({ page }) => {
    await ready(page);
    await jump(page, 'write-in-markdown');
    const { current, upcoming } = await openSpeakerView(page);
    for (const frame of [current, upcoming]) {
      await frame.evaluate(() => {
        const log: string[] = ((window as unknown as { __motion: string[] }).__motion = []);
        document.addEventListener('transitionrun', (event) => {
          const target = event.target as HTMLElement;
          if (target.matches('.slides section, .backgrounds .slide-background')) log.push(`${target.id}:${(event as TransitionEvent).propertyName}`);
        }, true);
      });
    }
    const idle = (frame: Frame) => frame.evaluate(() => ({
      root: document.getElementById('presentation')!.className,
      properties: [...new Set([...document.querySelectorAll('.slides section, .backgrounds .slide-background')].map((node) => getComputedStyle(node).transitionProperty))],
      explicit: document.getElementById('transitions')?.getAttribute('data-transition'),
      chapter: document.getElementById('copyable-code')?.getAttribute('data-transition'),
      motion: (window as unknown as { __motion: string[] }).__motion.slice(),
    }));
    await page.bringToFront();
    const walk: [string, string, string][] = [['ArrowRight', 'copyable-code', 'apphost-example'], ['ArrowLeft', 'write-in-markdown', 'copyable-code']];
    for (const [key, now, next] of walk) {
      await page.keyboard.press(key);
      await expect.poll(async () => (await previewState(current)).id, { timeout: 8000 }).toBe(now);
      await expect.poll(async () => (await previewState(upcoming)).id, { timeout: 8000 }).toBe(next);
    }
    await jump(page, 'comparison-layout');
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => (await previewState(current)).id, { timeout: 8000 }).toBe('transitions');
    await expect.poll(async () => (await previewState(upcoming)).id, { timeout: 8000 }).toBe('guide-start');
    for (const [name, frame] of [['current', current], ['upcoming', upcoming]] as const) {
      const state = await idle(frame);
      expect(state.root, `${name} preview root`).toMatch(/\bnone\b/);
      expect(state.properties, `${name} preview runs no transition on any slide`).toEqual(['none']);
      expect(state.explicit, `${name} preview keeps the authored attribute`).toBe('slide-in fade-out');
      expect(state.chapter, `${name} preview keeps the chapter default`).toBe('slide');
      expect(state.motion, `${name} preview animated`).toEqual([]);
      const arrived = await frame.evaluate(() => {
        const slide = [...document.querySelectorAll('.slides section.present')].pop()!;
        return [slide.id, getComputedStyle(slide).opacity, getComputedStyle(slide).visibility];
      });
      expect(arrived[1], `${name} preview shows the slide fully on the next frame`).toBe('1');
      expect(arrived[2]).toBe('visible');
    }
    await page.keyboard.press('ArrowLeft');
    await expect.poll(async () => (await previewState(current)).id, { timeout: 8000 }).toBe('comparison-layout');
    await expect.poll(async () => (await previewState(upcoming)).id, { timeout: 8000 }).toBe('transitions');
  });
});

// Seven top-level slides, the sixth a vertical stack, so that the numeric address #/5/0 is real in any deck.
const receiverDeck = [
  ...['one', 'two', 'three', 'four'].map((id) => `<!-- .slide: id="${id}" -->\n## Slide ${id}\n`),
  '<!-- .slide: id="stack-top" -->\n## A stack\n\n--\n\n<!-- .slide: id="stack-child" -->\n## Its child\n',
  '<!-- .slide: id="last" -->\n## Last\n',
].join('\n---\n\n');

test.describe('a ?receiver preview is a native presentation, even in a narrow frame', () => {
  for (const mode of ['', '&mode=read']) {
    test(`a 400px preview${mode ? ' that asks for reading mode' : ''} keeps the scaled canvas and opens a numeric hash`, async ({ page }) => {
      await authorMarkdown(page, receiverDeck);
      await page.setViewportSize({ width: 400, height: 300 });
      await page.goto(`?receiver&progress=false&history=false&transition=none${mode}#/5/0`);
      await expect(page.locator('html')).toHaveAttribute('data-deck-ready', 'true');
      await expect(page.locator('#toolbar')).toBeHidden();
      await expect(page.locator('html')).toHaveAttribute('data-reading', 'false');
      await expect(page.locator('html')).toHaveAttribute('data-compact', 'false');
      const expected = await page.evaluate(() => {
        const horizontal = document.querySelectorAll('.slides > section')[5];
        return (horizontal.matches('.stack') ? horizontal.querySelector('section')! : horizontal).id;
      });
      await expect(page.locator('.slides section.present').last()).toHaveAttribute('id', expected);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const box = await page.locator('.slides section.present').last().boundingBox();
      expect(box!.width).toBeLessThanOrEqual(400);
      expect(box!.height).toBeLessThanOrEqual(300);
    });
  }
});
