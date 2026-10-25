import { expect, test, type Page } from '@playwright/test';
import { authorMarkdown, captureClipboard, expectCopied, jump, ready, renderedIds, settleMotion } from './helpers';
import { starter } from './starter';

const fence = '```';
const steps = (info: string, lines: string[]) => `${fence}${info}\n${lines.join('\n')}\n${fence}\n`;

// Adjacent stepped blocks, a stepped pair, steps with bullets, a terminal then steps, and a vertical stack.
const fixture = `<!-- .slide: id="s1" -->
## Stepped one

${steps('typescript [1|2|3]', ['const one = 1;', 'const two = 2;', 'const three = 3;'])}
---

<!-- .slide: id="s2" -->
## Stepped two directly after

${steps('typescript [1|3|2-3]', ['let a = 1;', 'let b = 2;', 'let c = 3;'])}
---

<!-- .slide: id="pair" class="layout-split" -->
## A stepped pair

<div class="layout-visual">

${steps('typescript [1|2]', ['left.one();', 'left.two();'])}
</div>

<div class="layout-visual">

${steps('typescript [1|2|1-2]', ['right.one();', 'right.two();'])}
</div>

---

<!-- .slide: id="mixed" -->
## Steps then bullets

${steps('typescript [1|2]', ['first();', 'second();'])}
- A bullet <!-- .element: class="fragment" -->
- Another bullet <!-- .element: class="fragment" -->

---

<!-- .slide: id="terminal" -->
## A terminal then steps

${fence}bash
echo hi
${fence}
<!-- .element: data-terminal="Recorded example" data-caption="Terminal" -->

${fence}text
hi
${fence}

${steps('typescript [1|2]', ['after();', 'again();'])}
---

<!-- .slide: id="stack-top" -->
## A vertical stack

${steps('typescript [1|2]', ['top();', 'more();'])}
--

<!-- .slide: id="stack-child" -->
## Its vertical child

${steps('typescript [1|2]', ['child();', 'more();'])}
---

<!-- .slide: id="last" -->
## The last slide

A plain closing slide.
`;

// One state per reachable reveal: the present leaf slide plus exactly which fragments are visible.
const stateKey = (page: Page) => page.evaluate(() => {
  const present = [...document.querySelectorAll('.slides section.present')].pop();
  if (!present) return '';
  const visible = [...present.querySelectorAll('.fragment.visible')].map((node) => node.getAttribute('data-fragment-index')).join('.');
  return `${present.id}|${visible}`;
});

async function advance(page: Page, press: () => Promise<unknown>) {
  const before = await stateKey(page);
  await press();
  // Reveal updates the present slide and fragment classes synchronously, so a real change shows up almost at once.
  const changed = await page.waitForFunction((previous) => {
    const present = [...document.querySelectorAll('.slides section.present')].pop();
    const visible = present ? [...present.querySelectorAll('.fragment.visible')].map((node) => node.getAttribute('data-fragment-index')).join('.') : '';
    return `${present?.id ?? ''}|${visible}` !== previous;
  }, before, { timeout: 700, polling: 40 }).then(() => true, () => false);
  if (changed) await settleMotion(page);
  return changed;
}

// Press forward until the deck stops changing, then backward until it stops. Backward must be the exact reverse.
async function walk(page: Page, forward: () => Promise<unknown>, backward: () => Promise<unknown>) {
  const there = [await stateKey(page)];
  while (await advance(page, forward)) {
    there.push(await stateKey(page));
    if (there.length > 120) throw new Error('The deck never ended.');
  }
  const back = [await stateKey(page)];
  while (await advance(page, backward)) {
    back.push(await stateKey(page));
    if (back.length > 120) throw new Error('The deck never reached its start.');
  }
  return { there, back };
}

const keys = (page: Page, forward: string, backward: string) => ({
  forward: () => page.keyboard.press(forward),
  backward: () => page.keyboard.press(backward),
});

test.describe('walking forward through everything and back again is exactly reversible', () => {
  test.setTimeout(150_000);

  test('Space and Shift+Space across the whole starter deck', starter, async ({ page }) => {
    await ready(page);
    const { forward, backward } = keys(page, 'Space', 'Shift+Space');
    const { there, back } = await walk(page, forward, backward);
    expect(there.length).toBeGreaterThan(30);
    expect(back).toEqual([...there].reverse());
  });

  test('Space and Shift+Space across the whole deck, whatever its slides', async ({ page }) => {
    await ready(page);
    const { forward, backward } = keys(page, 'Space', 'Shift+Space');
    const { there, back } = await walk(page, forward, backward);
    expect(there.length).toBeGreaterThan(1);
    expect(back).toEqual([...there].reverse());
  });

  for (const [forward, backward] of [['ArrowRight', 'ArrowLeft'], ['PageDown', 'PageUp'], ['Space', 'Shift+Space']] as const) {
    test(`${forward} and ${backward} through stepped blocks, a pair, bullets, a terminal and a vertical stack`, async ({ page }) => {
      await authorMarkdown(page, fixture);
      await ready(page);
      const pressed = keys(page, forward, backward);
      const { there, back } = await walk(page, pressed.forward, pressed.backward);
      expect(there.map((state) => state.split('|')[0]).filter((id, index, all) => all.indexOf(id) === index))
        .toContain('s2');
      expect(back).toEqual([...there].reverse());
    });
  }
});

// A code window to click in and steps to walk, like the starter's AppHost walkthrough, for a deck the test authors.
const walkthrough = `<!-- .slide: id="walkthrough" -->
## A stepped walkthrough

${steps('typescript [1|3|4-5|6|7]', ['import { run } from "./run";', '', 'const first = 1;', 'const second = 2;', 'const third = 3;', 'run(first);', 'run(second);'])}
---

<!-- .slide: id="after-walkthrough" -->
## After

Next slide.
`;

// The slides these tests walk: the stepped code slide, the slide after it, and the code slide for reading mode.
const scenes: { suffix: string; tags: { tag?: string }; id: string; next: string; reading: string; open: (page: Page) => Promise<void> }[] = [
  { suffix: '', tags: starter, id: 'apphost-example', next: 'apphost-csharp', reading: 'copyable-code', open: async () => {} },
  { suffix: ' in an authored deck', tags: {}, id: 'walkthrough', next: 'after-walkthrough', reading: 'walkthrough', open: (page) => authorMarkdown(page, walkthrough) },
];

for (const { suffix, tags, id, reading, open } of scenes) test.describe(`the keyboard stays with the deck after the presenter touches the code${suffix}`, () => {
  const focused = (page: Page) => page.locator(`#${id} .code-line.is-focused`).evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.line));
  const walkTo = async (page: Page) => {
    await jump(page, id);
    await page.keyboard.press('Space');
    await page.keyboard.press('Space');
    await expect.poll(() => focused(page)).toEqual(['4', '5']);
  };

  test('clicking Copy with the mouse still copies and leaves ArrowLeft, ArrowRight and Space working', tags, async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await captureClipboard(page);
    await open(page);
    await ready(page);
    await walkTo(page);
    const source = await page.locator(`#${id} pre code`).textContent();
    await page.locator(`#${id} .copy-code`).click();
    await expectCopied(page, source);
    await expect(page.locator('#presentation')).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => focused(page)).toEqual(['3']);
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => focused(page)).toEqual(['4', '5']);
    await page.keyboard.press('Space');
    await expect.poll(() => focused(page)).toEqual(['6']);
    await page.keyboard.press('Shift+Space');
    await expect.poll(() => focused(page)).toEqual(['4', '5']);
  });

  test('clicking inside a code body that has nothing to scroll leaves the keys working', tags, async ({ page }) => {
    await open(page);
    await ready(page);
    await walkTo(page);
    expect(await page.locator(`#${id} pre`).evaluate((pre) => pre.scrollHeight <= pre.clientHeight + 1)).toBe(true);
    await page.locator(`#${id} pre`).click({ position: { x: 40, y: 30 } });
    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => focused(page)).toEqual(['3']);
    await page.keyboard.press('Space');
    await expect.poll(() => focused(page)).toEqual(['4', '5']);
    await page.keyboard.press('PageUp');
    await expect.poll(() => focused(page)).toEqual(['3']);
  });

  test('a keyboard user who activates Copy keeps focus on it, and Space there copies instead of advancing', tags, async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await captureClipboard(page);
    await open(page);
    await ready(page);
    await walkTo(page);
    const counter = await page.locator('#slide-position').textContent();
    await page.locator(`#${id} .copy-code`).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator(`#${id} .copy-code`)).toBeFocused();
    await page.keyboard.press('Space');
    await expect(page.locator(`#${id} .copy-code`)).toBeFocused();
    await expectCopied(page, await page.locator(`#${id} pre code`).textContent());
    expect(await page.locator('#slide-position').textContent()).toBe(counter);
    expect(await focused(page)).toEqual(['4', '5']);
  });

  test('clicking Copy in reading mode keeps the reading keys working', tags, async ({ page }) => {
    await open(page);
    await ready(page, '?mode=read');
    const ids = await renderedIds(page);
    await page.evaluate((target) => document.getElementById(target)!.scrollIntoView(), reading);
    await page.locator(`#${reading} .copy-code`).click();
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => page.evaluate(() => document.getElementById('slide-position')!.textContent)).toBe(`${ids.indexOf(reading) + 2} / ${ids.length}`);
    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => page.evaluate(() => document.getElementById('slide-position')!.textContent)).toBe(`${ids.indexOf(reading) + 1} / ${ids.length}`);
  });
});

test.describe('the keyboard stays with the deck after the presenter touches the code', () => {
  test('a code body that does scroll keeps the arrow keys for scrolling and does not move the deck', async ({ page }) => {
    const forty = Array.from({ length: 40 }, (_, index) => `const value${index + 1} = ${index + 1};`);
    await authorMarkdown(page, `<!-- .slide: id="long" -->\n## A long listing\n\n${steps('typescript', forty)}\n---\n\n<!-- .slide: id="after" -->\n## After\n\nNext slide.\n`);
    await ready(page);
    await jump(page, 'long');
    const body = page.locator('#long pre');
    expect(await body.evaluate((pre) => pre.scrollHeight - pre.clientHeight)).toBeGreaterThan(300);
    await body.click({ position: { x: 40, y: 30 } });
    const counter = await page.locator('#slide-position').textContent();
    await page.keyboard.press('PageDown');
    await expect.poll(() => body.evaluate((pre) => pre.scrollTop)).toBeGreaterThan(100);
    await page.keyboard.press('ArrowDown');
    expect(await page.locator('#slide-position').textContent()).toBe(counter);
    await expect(page.locator('#long')).toHaveClass(/present/);
  });
});

for (const { suffix, tags, id, next, open } of scenes) test.describe(`browser history follows every state with no trap${suffix}`, () => {
  const focused = (page: Page) => page.locator(`#${id} .code-line.is-focused`).evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.line));

  test('browser Back and Forward walk each step, then the plain slide link restores the first state', tags, async ({ page }) => {
    await open(page);
    await ready(page, `?mode=present#/${id}`);
    const total = await page.locator('#slide-list a').count();
    const entries = [{ hash: `#/${id}`, lines: ['1'] }];
    for (const lines of [['3'], ['4', '5'], ['6'], ['7']]) {
      await page.keyboard.press('Space');
      await expect.poll(() => focused(page)).toEqual(lines);
      entries.push({ hash: `#/${id}/${entries.length - 1}`, lines });
    }
    await page.keyboard.press('Space');
    await expect(page.locator(`#${next}`)).toHaveClass(/present/);
    for (const entry of [...entries].reverse()) {
      await page.goBack();
      await expect.poll(() => new URL(page.url()).hash).toBe(entry.hash);
      await expect.poll(() => focused(page)).toEqual(entry.lines);
      await expect(page.locator('#slide-position')).toHaveText(`${(await renderedIds(page)).indexOf(id) + 1} / ${total}`);
    }
    // The first fragment's Back must land on the plain slide URL and stay there, not be rewritten to /0 (a history trap).
    await page.waitForTimeout(400);
    expect(new URL(page.url()).hash).toBe(`#/${id}`);
    expect(await focused(page)).toEqual(['1']);
    for (const entry of entries.slice(1)) {
      await page.goForward();
      await expect.poll(() => new URL(page.url()).hash).toBe(entry.hash);
      await expect.poll(() => focused(page)).toEqual(entry.lines);
    }
  });

  test('a fresh load of the plain slide link starts at the first step even after a fragment link', tags, async ({ page }) => {
    await open(page);
    await ready(page, `?mode=present#/${id}/2`);
    await expect.poll(() => focused(page)).toEqual(['6']);
    await page.evaluate((target) => { location.hash = `#/${target}`; }, id);
    await expect.poll(() => focused(page)).toEqual(['1']);
    await page.waitForTimeout(400);
    expect(new URL(page.url()).hash).toBe(`#/${id}`);
  });
});
