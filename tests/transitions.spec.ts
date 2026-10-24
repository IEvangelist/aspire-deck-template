import { expect, test, type Page } from '@playwright/test';
import { parseDeckConfig } from '../src/config';
import { checkSpeed, checkStyle } from '../src/transitions';
import { assetRequest, authorMarkdown, ready, settleMotion } from './helpers';

const minimal = { title: 'A talk', presenter: { name: 'A presenter' } };

test.describe('transition settings in deck.config.json', () => {
  test('are optional: a deck with none has empty defaults and no chapters', () => {
    const config = parseDeckConfig(minimal);
    expect(config.transition).toEqual({});
    expect(config.chapters).toEqual({});
  });

  test('accept every supported style, speed and background, and named chapters with in/out pairs', () => {
    for (const style of ['none', 'fade', 'slide', 'convex', 'concave', 'zoom']) {
      expect(parseDeckConfig({ ...minimal, transition: { style, background: style } }).transition).toEqual({ style, background: style });
    }
    for (const speed of ['default', 'fast', 'slow']) {
      expect(parseDeckConfig({ ...minimal, transition: { speed } }).transition).toEqual({ speed });
    }
    const config = parseDeckConfig({
      ...minimal,
      chapters: {
        plain: {},
        code: { style: 'slide-in fade-out', speed: 'slow', background: 'zoom' },
        'Reverse-order_ok': { style: 'convex-out zoom-in' },
      },
    });
    expect(Object.keys(config.chapters)).toEqual(['plain', 'code', 'Reverse-order_ok']);
    expect(config.chapters.plain).toEqual({});
    expect(config.chapters.code).toEqual({ style: 'slide-in fade-out', speed: 'slow', background: 'zoom' });
    expect(config.chapters['Reverse-order_ok'].style).toBe('convex-out zoom-in');
  });

  const chapter = (settings: unknown) => ({ chapters: { demo: settings } });
  const invalid: [string, Record<string, unknown>, string][] = [
    ['a legacy style', { transition: { style: 'cube' } }, 'transition.style "cube" is not supported. Use none, fade, slide, convex, concave or zoom.'],
    ['an in/out pair as the deck default', { transition: { style: 'slide-in fade-out' } }, 'transition.style "slide-in fade-out" is not supported'],
    ['an unknown speed', { transition: { speed: 'medium' } }, 'transition.speed "medium" is not supported. Use default, fast or slow.'],
    ['a pair as a background', { transition: { background: 'fade-in slide-out' } }, 'transition.background "fade-in slide-out" is not supported'],
    ['a misspelled field', { transition: { styel: 'fade' } }, 'transition.styel is not a supported field'],
    ['a transition that is not an object', { transition: 'fade' }, 'transition must be an object'],
    ['chapters that are a list', { chapters: [] }, 'chapters must be an object that names each chapter'],
    ['a chapter id that cannot be written in a slide', { chapters: { '1st chapter': {} } }, 'chapters.1st chapter is not a valid chapter id'],
    ['a chapter that is not an object', chapter('slide'), 'chapters.demo must be an object'],
    ['a chapter that is null', chapter(null), 'chapters.demo must be an object'],
    ['an unknown chapter field', chapter({ transition: { style: 'fade' } }), 'chapters.demo.transition is not a supported field'],
    ['a chapter style that does not exist', chapter({ style: 'zoomm' }), 'chapters.demo.style "zoomm" is not supported. Use none, fade, slide, convex, concave or zoom, or an in/out pair'],
    ['a pair with only an entering style', chapter({ style: 'slide-in' }), 'chapters.demo.style "slide-in" is not supported'],
    ['a pair with two entering styles', chapter({ style: 'slide-in fade-in' }), 'chapters.demo.style "slide-in fade-in" is not a valid in/out pair'],
    ['a pair that tries to use none', chapter({ style: 'none-in fade-out' }), 'chapters.demo.style "none-in fade-out" is not a valid in/out pair'],
    ['a pair with three parts', chapter({ style: 'slide-in fade-out zoom-out' }), '"slide-in fade-out zoom-out" is not supported'],
    ['a chapter speed that does not exist', chapter({ speed: 'quick' }), 'chapters.demo.speed "quick" is not supported. Use default, fast or slow.'],
    ['a chapter background pair', chapter({ background: 'slide-in fade-out' }), 'chapters.demo.background "slide-in fade-out" is not supported'],
  ];
  for (const [name, patch, message] of invalid) {
    test(`reject ${name}`, () => {
      expect(() => parseDeckConfig({ ...minimal, ...patch })).toThrow(message);
    });
  }

  test('check one value at a time with the same rules the slides use', () => {
    expect(checkStyle(' zoom-in   fade-out ', 'where', true)).toBe('zoom-in fade-out');
    expect(() => checkStyle('zoom-in fade-out', 'where', false)).toThrow('where "zoom-in fade-out" is not supported');
    expect(checkSpeed(' slow ', 'where')).toBe('slow');
  });
});

async function authorDeck(page: Page, config: Record<string, unknown>, markdown: string) {
  await authorMarkdown(page, markdown);
  await page.route(assetRequest('deck.config.json'), (route) => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ title: 'Fixture deck', presenter: { name: 'Presenter' }, ...config }),
  }));
}

const fixture = `<!-- .slide: id="a" -->
## A

---

<!-- .slide: id="b" data-chapter="one" -->
## B

---

<!-- .slide: id="c" data-transition="convex" data-transition-speed="slow" -->
## C

---

<!-- .slide: id="d" -->
## D

--

<!-- .slide: id="e" data-transition="none" -->
## E

---

<!-- .slide: id="f" data-chapter="two" -->
## F

---

<!-- .slide: id="g" data-background-transition="zoom" -->
## G
`;

// The same slides with no chapter markers, for decks whose chapters are defined or marked differently.
const plain = fixture.replace(' data-chapter="one"', '').replace(' data-chapter="two"', '');
const mark = (id: string, chapter: string, source = plain) => source.replace(`id="${id}"`, `id="${id}" data-chapter="${chapter}"`);

const attributes = (page: Page) => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.slides section')].map((section) => [
  section.id || (section.classList.contains('stack') ? 'stack' : '?'),
  [section.getAttribute('data-transition'), section.getAttribute('data-transition-speed'), section.getAttribute('data-background-transition')],
])));

test.describe('deck, chapter and slide transition precedence', () => {
  const config = {
    transition: { style: 'convex', speed: 'slow', background: 'fade' },
    chapters: {
      one: { style: 'slide', speed: 'fast', background: 'slide' },
      two: { style: 'zoom-in fade-out', background: 'concave' },
    },
  };

  test('the deck default is Reveal\'s own setting, a chapter fills each slide that has not set the value, and the slide wins', async ({ page }) => {
    await authorDeck(page, config, fixture);
    await ready(page);
    const root = page.locator('#presentation');
    await expect(root).toHaveClass(/\bconvex\b/);
    await expect(root).toHaveAttribute('data-transition-speed', 'slow');
    await expect(root).toHaveAttribute('data-background-transition', 'fade');
    const found = await attributes(page);
    expect(found).toEqual({
      intro: [null, null, null],
      a: [null, null, null],
      b: ['slide', 'fast', 'slide'],
      c: ['convex', 'slow', 'slide'],
      stack: [null, null, null],
      d: ['slide', 'fast', 'slide'],
      e: ['none', 'fast', 'slide'],
      f: ['zoom-in fade-out', null, 'concave'],
      g: ['zoom-in fade-out', null, 'zoom'],
    });
  });

  test('chapters never change the slide text, ids or order', async ({ page }) => {
    await authorDeck(page, config, fixture);
    await ready(page);
    expect(await page.locator('#slide-list a').evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).dataset.slide))).toEqual(['intro', 'a', 'b', 'c', 'd', 'e', 'f', 'g']);
    expect(await page.locator('.slides section[id] h2').allTextContents()).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    await expect(page.locator('#slide-position')).toHaveText('1 / 8');
  });

  test('a chapter can begin again later, and the deck default returns when no chapter is marked', async ({ page }) => {
    await authorDeck(page, { chapters: { one: { style: 'zoom' }, rest: {} } }, mark('f', 'one', mark('d', 'rest', mark('b', 'one'))));
    await ready(page);
    expect(await attributes(page)).toEqual({
      intro: [null, null, null], a: [null, null, null],
      b: ['zoom', null, null], c: ['convex', 'slow', null],
      stack: [null, null, null], d: [null, null, null], e: ['none', null, null],
      f: ['zoom', null, null], g: ['zoom', null, 'zoom'],
    });
  });

  test('a deck with no transition settings keeps the quiet fade', async ({ page }) => {
    await authorDeck(page, {}, plain);
    await ready(page);
    await expect(page.locator('#presentation')).toHaveClass(/\bfade\b/);
    await expect(page.locator('#presentation')).toHaveAttribute('data-transition-speed', 'fast');
    await expect(page.locator('#presentation')).toHaveAttribute('data-background-transition', 'none');
    expect(await attributes(page), 'with no chapters only the authored attributes exist').toEqual({
      intro: [null, null, null], a: [null, null, null], b: [null, null, null], c: ['convex', 'slow', null], stack: [null, null, null],
      d: [null, null, null], e: ['none', null, null], f: [null, null, null], g: [null, null, 'zoom'],
    });
  });

  test('replacing the starter slides never breaks the deck: chapters that no slide uses are inert', async ({ page }) => {
    await authorMarkdown(page);
    await ready(page);
    await expect(page.locator('#presentation')).toHaveClass(/\bfade\b/);
    expect(Object.values(await attributes(page)).flat().every((value) => value === null)).toBe(true);
  });

  test('the starter shows the deck default, a Code chapter override and one explicit in/out slide', async ({ page }) => {
    await ready(page);
    await expect(page.locator('#presentation')).toHaveClass(/\bfade\b/);
    const found = await attributes(page);
    const code = ['copyable-code', 'apphost-example', 'apphost-csharp', 'go-workload', 'compare-code', 'run-and-reveal'];
    for (const id of code) expect(found[id], id).toEqual(['slide', null, null]);
    const own = Object.entries(found).filter(([, value]) => value.some(Boolean)).map(([id]) => id);
    expect(own).toEqual([...code, 'transitions']);
    expect(found.transitions).toEqual(['slide-in fade-out', null, null]);
    expect(found.stack).toEqual([null, null, null]);
    await expect(page.locator('#transitions aside.notes')).toContainText('Cue: the deck fades by default');
  });

  test('a stack\'s grouping section is never a transition target', async ({ page }) => {
    await authorDeck(page, { chapters: { all: { style: 'zoom', speed: 'fast', background: 'fade' } } }, mark('a', 'all'));
    await ready(page);
    const found = await attributes(page);
    expect(found.stack).toEqual([null, null, null]);
    expect(found.d).toEqual(['zoom', 'fast', 'fade']);
    expect(found.e).toEqual(['none', 'fast', 'fade']);
  });
});

test.describe('invalid transition settings fail where they can be fixed', () => {
  const cases: [string, Record<string, unknown>, string, string][] = [
    ['an explicit slide style that does not exist', {}, plain.replace('id="b"', 'id="b" data-transition="zoomm"'), 'slides.md: slide "b" data-transition "zoomm" is not supported. Use none, fade, slide, convex, concave or zoom, or an in/out pair'],
    ['an explicit slide speed that does not exist', {}, plain.replace('id="b"', 'id="b" data-transition-speed="turbo"'), 'slide "b" data-transition-speed "turbo" is not supported. Use default, fast or slow.'],
    ['an explicit background that is an in/out pair', {}, plain.replace('id="b"', 'id="b" data-background-transition="fade-in slide-out"'), 'slide "b" data-background-transition "fade-in slide-out" is not supported'],
    ['an explicit pair with only one side', {}, plain.replace('id="d"', 'id="d" data-transition="fade-out slide"'), 'slide "d" data-transition "fade-out slide" is not a valid in/out pair'],
    ['a slide that starts a chapter nobody defined', { chapters: { one: {}, two: {} } }, mark('b', 'oen'), 'slides.md: slide "b" data-chapter "oen" is not defined in deck.config.json. Defined chapters: one, two.'],
    ['a chapter marker when the config defines no chapters', {}, mark('b', 'one'), 'slide "b" data-chapter "one" is not defined in deck.config.json. Add it under "chapters".'],
    ['a chapter style that does not exist', { chapters: { one: { style: 'zoomm' } } }, plain, 'deck.config.json: chapters.one.style "zoomm" is not supported'],
  ];
  for (const [name, config, markdown, message] of cases) {
    test(`${name} names the slide or chapter`, async ({ page }) => {
      await authorDeck(page, config, markdown);
      await page.goto('?mode=present');
      await expect(page.locator('html')).toHaveAttribute('data-deck-ready', 'error');
      await expect(page.locator('#failure-detail')).toContainText(message);
    });
  }
});

// Reveal animates with CSS, so the proof of a real transition is the browser's own transition events on the slides.
async function watchMotion(page: Page) {
  await page.evaluate(() => {
    const log: string[] = ((window as unknown as { __motion: string[] }).__motion = []);
    document.addEventListener('transitionrun', (event) => {
      const target = event.target as HTMLElement;
      if (target.matches('.slides section, .backgrounds .slide-background')) log.push(`${target.id || 'background'}:${(event as TransitionEvent).propertyName}`);
    }, true);
  });
}

const motion = (page: Page) => page.evaluate(() => (window as unknown as { __motion: string[] }).__motion.slice());

test.describe('slides really animate while presenting', () => {
  test('the deck fade leaves, the Code chapter slides in, and the explicit slide enters and leaves differently', async ({ page }) => {
    await ready(page, '?mode=present#/write-in-markdown');
    await watchMotion(page);
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => motion(page)).toContain('copyable-code:transform');
    await settleMotion(page);
    let log = await motion(page);
    expect(log).toContain('write-in-markdown:opacity');
    expect(log, 'the deck default fade never moves the slide that leaves').not.toContain('write-in-markdown:transform');
    const durations = await page.locator('#copyable-code').evaluate((slide) => getComputedStyle(slide).transitionDuration.split(',').map((value) => value.trim()));
    expect(new Set(durations), 'fast is 0.4 seconds').toEqual(new Set(['0.4s']));

    await ready(page, '?mode=present#/comparison-layout');
    await watchMotion(page);
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => motion(page)).toContain('transitions:transform');
    await settleMotion(page);
    log = await motion(page);
    expect(log, 'the slide-in half moves the explicit slide').toContain('transitions:transform');
    expect(log, 'the deck default fade fades the slide before it').toContain('comparison-layout:opacity');

    await page.evaluate(() => { (window as unknown as { __motion: string[] }).__motion.length = 0; });
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => motion(page)).toContain('transitions:opacity');
    await settleMotion(page);
    log = await motion(page);
    expect(log, 'the fade-out half only fades the explicit slide').not.toContain('transitions:transform');
    expect(await page.locator('#transitions').evaluate((slide) => getComputedStyle(slide).visibility)).toBe('hidden');
  });

  test('the slide that is not showing cannot be reached, even though it stays rendered to animate', async ({ page }) => {
    await ready(page, '?mode=present#/copyable-code');
    await settleMotion(page);
    const neighbour = page.locator('#apphost-example');
    await expect(neighbour).toBeHidden();
    expect(await neighbour.evaluate((slide) => [slide.hasAttribute('hidden'), slide.getAttribute('aria-hidden'), getComputedStyle(slide).visibility, getComputedStyle(slide).pointerEvents])).toEqual([true, 'true', 'hidden', 'none']);
    for (let press = 0; press < 12; press++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => document.activeElement?.closest('section[hidden]')?.id ?? ''), `Tab stop ${press + 1}`).toBe('');
    }
  });
});

test.describe('every static context switches slide motion off at the element', () => {
  const idle = async (page: Page) => page.evaluate(() => {
    const properties = [...new Set([...document.querySelectorAll('.slides section, .backgrounds .slide-background')].map((node) => getComputedStyle(node).transitionProperty))];
    return { root: document.getElementById('presentation')!.className, properties, explicit: document.getElementById('transitions')!.getAttribute('data-transition') };
  });

  for (const [name, query] of [['reading mode', '?mode=read'], ['print', '?print-pdf'], ['speaker-view previews', '?mode=present&receiver&history=false&transition=none&backgroundTransition=none']] as const) {
    test(`${name} keeps the authored attributes but runs no transition`, async ({ page }) => {
      await ready(page, query);
      expect(await idle(page)).toMatchObject({ properties: ['none'], explicit: 'slide-in fade-out' });
      expect((await idle(page)).root).toMatch(/\bnone\b/);
    });
  }

  test('reduced motion moves between slides, including the explicit in/out slide, with no transition and no delay', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await ready(page, '?mode=present#/comparison-layout');
    await watchMotion(page);
    expect(await idle(page)).toMatchObject({ properties: ['none'], explicit: 'slide-in fade-out' });
    await page.keyboard.press('ArrowRight');
    const arrived = await page.evaluate(() => {
      const incoming = document.getElementById('transitions')!;
      const leaving = document.getElementById('comparison-layout')!;
      return [getComputedStyle(incoming).opacity, getComputedStyle(incoming).visibility, getComputedStyle(incoming).transform, getComputedStyle(leaving).visibility];
    });
    expect(arrived, 'the new slide is whole and the old one gone on the very next frame').toEqual(['1', 'visible', 'none', 'hidden']);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    expect(await motion(page)).toEqual([]);
  });

  test('switching modes without a reload restores the authored attributes and the motion', async ({ page }) => {
    await ready(page, '?mode=present#/write-in-markdown');
    const authored = await attributes(page);
    const properties = () => page.locator('#copyable-code').evaluate((slide) => getComputedStyle(slide).transitionProperty);
    await expect(page.locator('#presentation')).toHaveClass(/\bfade\b/);
    expect(await properties()).toContain('transform');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('#presentation')).toHaveClass(/\bnone\b/);
    expect(await properties()).toBe('none');
    expect(await attributes(page)).toEqual(authored);

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(page.locator('#presentation')).toHaveClass(/\bfade\b/);
    expect(await properties()).toContain('transform');
    expect(await attributes(page)).toEqual(authored);

    await page.keyboard.press('r');
    await expect(page.locator('html')).toHaveAttribute('data-reading', 'true');
    await expect(page.locator('#presentation')).toHaveClass(/\bnone\b/);
    expect(await properties()).toBe('none');
    expect(await attributes(page)).toEqual(authored);

    await page.keyboard.press('r');
    await expect(page.locator('html')).toHaveAttribute('data-reading', 'false');
    await expect(page.locator('#presentation')).toHaveClass(/\bfade\b/);
    expect(await properties()).toContain('transform');
    expect(await attributes(page)).toEqual(authored);
    await watchMotion(page);
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => motion(page)).toContain('copyable-code:transform');
  });
});
