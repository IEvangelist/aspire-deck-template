import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { authorMarkdown, captureClipboard, expectCopied, jump, ready, renderedIds, settleMotion } from './helpers';

const fence = '```';
const body = ['const alpha = 1;', '', 'const beta = alpha + 1;', 'const gamma = beta * 2;', 'console.log(gamma);'].join('\n');
const after = '\n---\n<!-- .slide: id="after" -->\n## After\n\nThe next slide.\n';
const listing = [
  'web      http://localhost:8000',
  '',
  'api      http://localhost:8001',
  '',
  'cache    redis://localhost:6379  a-deliberately-long-trailing-value-that-has-to-wrap-inside-the-output-body-without-clipping',
].join('\n');
const longOutput = Array.from({ length: 60 }, (_, index) => `line ${String(index + 1).padStart(2, '0')} of the complete output`).join('\n');

function walk(info: string, code = body) {
  return `<!-- .slide: id="walk" -->\n## Walk the code\n\n${fence}${info}\n${code}\n${fence}\n<!-- .element: data-caption="walk.ts" -->\n${after}`;
}

function run(command: string, output: string, language: string, attributes = 'data-terminal="Recorded example" data-caption="Terminal"') {
  return `<!-- .slide: id="run" -->\n## Run it\n\n${fence}bash\n${command}\n${fence}\n<!-- .element: ${attributes} -->\n\n${fence}${language}\n${output}\n${fence}\n${after}`;
}

async function open(page: Page, markdown: string, id: string, path = '?mode=present') {
  await authorMarkdown(page, markdown);
  await ready(page, path);
  await jump(page, id);
}

type Box = { top: number; bottom: number; left: number; right: number; width: number; height: number };

async function box(page: Page, selector: string): Promise<Box> {
  return page.locator(selector).first().evaluate((node) => {
    const { top, bottom, left, right, width, height } = node.getBoundingClientRect();
    return { top, bottom, left, right, width, height };
  });
}

const focused = (page: Page, id = 'walk') => page.locator(`#${id} .code-line.is-focused`)
  .evaluateAll((nodes) => nodes.map((node) => Number((node as HTMLElement).dataset.line)));

const numbers = (page: Page) => page.locator('#walk .code-line').evaluateAll((nodes) => nodes.map((node) => {
  const content = getComputedStyle(node, '::before').content;
  return /^"(\d+)"/.exec(content)?.[1] ?? content;
}));

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
  // Windows' native clipboard returns CRLF even for LF text.
  return (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n');
}

test.describe('highlighted line steps', () => {
  test('Next and Back walk the lines through native fragments, then move on and return', async ({ page }) => {
    await open(page, walk('typescript [1|3|4-5]'), 'walk');
    await expect(page.locator('#walk .code-step')).toHaveCount(2);
    await expect(page.locator('#walk .code-step[aria-hidden="true"]')).toHaveCount(2);
    const total = await page.locator('#slide-list a').count();
    const steps: [number[], string][] = [[[1], '#/walk'], [[3], '#/walk/0'], [[4, 5], '#/walk/1']];
    for (const [index, [lines, hash]] of steps.entries()) {
      if (index) await page.keyboard.press('Space');
      await expect.poll(() => focused(page)).toEqual(lines);
      await expect(page.locator('#walk pre')).toHaveAttribute('data-focus-step', String(index + 1));
      await expect(page.locator('#slide-position')).toHaveText(`2 / ${total}`);
      expect(new URL(page.url()).hash).toBe(hash);
    }
    for (const lines of [[3], [1]]) {
      await page.keyboard.press('ArrowLeft');
      await expect.poll(() => focused(page)).toEqual(lines);
    }
    await expect(page.locator('#slide-position')).toHaveText(`2 / ${total}`);
    await page.keyboard.press('Space');
    await page.keyboard.press('Space');
    await expect.poll(() => focused(page)).toEqual([4, 5]);
    await page.keyboard.press('Space');
    await expect(page.locator('#after')).toHaveClass(/present/);
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#walk')).toHaveClass(/present/);
    await expect.poll(() => focused(page)).toEqual([4, 5]);
  });

  test('numbers and focus never enter the code text, selection or Copy', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await captureClipboard(page);
    const long = 'const veryLongName = await someFunction("a-long-literal-argument-that-wraps-in-a-narrow-panel", 2);';
    const code = ['import { one } from "./one";', '', long, '', '', '/* a block', '', '   comment */', '  indented();'].join('\n');
    await open(page, walk('typescript [1|3]', code), 'walk');
    expect(await page.locator('#walk pre code').textContent()).toBe(code);
    expect(await numbers(page)).toEqual(Array.from({ length: 9 }, (_, index) => String(index + 1)));
    await page.locator('#walk .copy-code').click();
    await expectCopied(page, code);
    expect(await copiedBySelection(page, '#walk pre code')).toBe(code);
    // A blank line stays one full line tall, and a wrapped line is taller than its neighbours.
    const heights = await page.locator('#walk .code-line').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
    expect(heights[1]).toBeCloseTo(heights[0], 0);
    expect(heights[2]).toBeGreaterThan(heights[0] * 1.5);
  });

  test('an empty list is numbers only, an offset renumbers, and one step is permanent emphasis', async ({ page }) => {
    await open(page, walk('typescript []'), 'walk');
    expect(await numbers(page)).toEqual(['1', '2', '3', '4', '5']);
    expect(await focused(page)).toEqual([]);
    await expect(page.locator('#walk .code-step')).toHaveCount(0);

    await authorMarkdown(page, walk('typescript [40: 1-2|3]'));
    await ready(page);
    await jump(page, 'walk');
    expect(await numbers(page)).toEqual(['40', '41', '42', '43', '44']);
    await expect.poll(() => focused(page)).toEqual([40, 41]);
    await page.keyboard.press('Space');
    await expect.poll(() => focused(page)).toEqual([42]);

    await authorMarkdown(page, walk('typescript [2]'));
    await ready(page);
    await jump(page, 'walk');
    await expect(page.locator('#walk .code-step')).toHaveCount(0);
    expect(await focused(page)).toEqual([2]);
    await page.keyboard.press('r');
    await expect(page.locator('html')).toHaveAttribute('data-reading', 'true');
    expect(await focused(page)).toEqual([2]);
  });

  test('a bracket-only fence is plaintext with numbers, and aliases with steps still highlight', async ({ page }) => {
    await open(page, `<!-- .slide: id="walk" -->\n## Plain and aliased\n\n${fence} [1]\nnot a language\n${fence}\n\n${fence}py [1|2]\ndef greet(name):\n    return f"Hello {name}"\n${fence}\n\n${fence}sql [1]\nSELECT id FROM resources;\n${fence}\n`, 'walk');
    await expect(page.locator('#walk code').first()).toHaveAttribute('data-language', 'plaintext');
    await expect(page.locator('#walk code').first().locator('span:not(.code-line)')).toHaveCount(0);
    await expect(page.locator('#walk code[data-language="python"] .hljs-keyword').first()).toBeVisible();
    await expect(page.locator('#walk code[data-language="sql"] .hljs-keyword').first()).toBeVisible();
    await expect(page.locator('#walk .code-step')).toHaveCount(1);
  });

  for (const [spec, message] of [
    ['[1-9]', 'lines 1-9 are outside this 5-line code block'],
    ['[0]', 'lines 0 are outside this 5-line code block'],
    ['[2-1]', 'lines 2-1 are outside this 5-line code block'],
    ['[1--2]', '"1--2" is not a line number or a range'],
    ['[1,x]', '"[1,x]" after the code language is not a line-step list'],
  ] as const) {
    test(`the line list ${spec} fails visibly and names its slide`, async ({ page }) => {
      await authorMarkdown(page, walk(`typescript ${spec}`));
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('data-deck-ready', 'error');
      await expect(page.locator('#failure-detail')).toContainText('slide "walk"');
      await expect(page.locator('#failure-detail')).toContainText(message);
    });
  }

  test('deep links, reload and history restore the exact step', async ({ page }) => {
    await authorMarkdown(page, walk('typescript [1|3|4-5]'));
    await ready(page, '?mode=present#/walk/1');
    await expect.poll(() => focused(page)).toEqual([4, 5]);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-deck-ready', 'true');
    await expect.poll(() => focused(page)).toEqual([4, 5]);
    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => focused(page)).toEqual([3]);
    // A different query forces a full navigation, so the Markdown is rendered again from the plain slide link.
    await ready(page, '?mode=present&fresh=1#/walk');
    await expect.poll(() => focused(page)).toEqual([1]);
  });

  test('reading mode shows neutral complete code and presentation mode restores a consistent step', async ({ page }) => {
    await open(page, walk('typescript [1|3|4-5]'), 'walk');
    await page.keyboard.press('Space');
    await expect.poll(() => focused(page)).toEqual([3]);
    await page.keyboard.press('r');
    await expect(page.locator('html')).toHaveAttribute('data-reading', 'true');
    expect(await focused(page)).toEqual([]);
    await expect(page.locator('#walk .code-line')).toHaveCount(5);
    await page.keyboard.press('r');
    await expect(page.locator('html')).toHaveAttribute('data-reading', 'false');
    const visible = await page.locator('#walk .code-step.visible').count();
    await expect.poll(() => focused(page)).toEqual([[1], [3], [4, 5]][visible]);
  });

  test('reduced motion and print show complete neutral code', async ({ page }) => {
    await authorMarkdown(page, walk('typescript [1|3|4-5]'));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await ready(page);
    await jump(page, 'walk');
    await expect(page.locator('html')).toHaveAttribute('data-static', 'true');
    expect(await focused(page)).toEqual([]);
    expect(await page.locator('#walk pre code').textContent()).toBe(body);

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await ready(page, '?print-pdf&theme=light');
    await page.locator('.pdf-page').first().waitFor({ state: 'attached' });
    expect(await focused(page)).toEqual([]);
    expect(await page.locator('#walk pre code').textContent()).toBe(body);
  });

  test('stepping a long block scrolls only its body to the focused lines', async ({ page }) => {
    const forty = Array.from({ length: 40 }, (_, index) => `const value${index + 1} = ${index + 1};`).join('\n');
    await open(page, walk('typescript [1|30-32|38]', forty), 'walk');
    const scroller = page.locator('#walk pre');
    const inView = () => scroller.evaluate((pre) => {
      const lines = [...pre.querySelectorAll<HTMLElement>('.code-line.is-focused')];
      const top = lines[0].offsetTop;
      const bottom = lines.at(-1)!.offsetTop + lines.at(-1)!.offsetHeight;
      return top >= pre.scrollTop && bottom <= pre.scrollTop + pre.clientHeight;
    });
    expect(await scroller.evaluate((pre) => pre.scrollHeight - pre.clientHeight)).toBeGreaterThan(500);
    const header = await box(page, '#walk .code-panel figcaption');
    await page.keyboard.press('Space');
    await expect.poll(() => focused(page)).toEqual([30, 31, 32]);
    await expect.poll(inView).toBe(true);
    expect(await scroller.evaluate((pre) => pre.scrollTop)).toBeGreaterThan(900);
    await page.keyboard.press('Space');
    await expect.poll(() => focused(page)).toEqual([38]);
    await expect.poll(inView).toBe(true);
    for (let index = 0; index < 2; index++) await page.keyboard.press('ArrowLeft');
    await expect.poll(() => focused(page)).toEqual([1]);
    await expect.poll(() => scroller.evaluate((pre) => pre.scrollTop)).toBe(0);
    const settled = await box(page, '#walk .code-panel figcaption');
    expect(Math.abs(settled.top - header.top)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(settled.bottom - header.bottom)).toBeLessThanOrEqual(0.5);
    expect(await page.evaluate(() => document.getElementById('slide-viewport')!.scrollTop + document.scrollingElement!.scrollTop)).toBe(0);
  });

  test('line steps take their place in document order among bullet fragments and survive overview', async ({ page }) => {
    const bullets = () => page.locator('#walk li.fragment.visible').count();
    const bulletList = '- First bullet <!-- .element: class="fragment" -->\n- Second bullet <!-- .element: class="fragment" -->';
    await open(page, `<!-- .slide: id="walk" -->\n## Steps then bullets\n\n${fence}typescript [1|3]\n${body}\n${fence}\n\n${bulletList}\n${after}`, 'walk');
    expect(await focused(page)).toEqual([1]);
    await page.keyboard.press('Space');
    await expect.poll(() => focused(page)).toEqual([3]);
    expect(await bullets()).toBe(0);
    await page.keyboard.press('Escape');
    await expect(page.locator('#presentation')).toHaveClass(/overview/);
    expect(await focused(page)).toEqual([3]);
    await page.keyboard.press('Escape');
    await expect(page.locator('#presentation')).not.toHaveClass(/overview/);
    expect(await focused(page)).toEqual([3]);
    await page.keyboard.press('Space');
    await expect.poll(bullets).toBe(1);
    expect(await focused(page)).toEqual([3]);
    await page.keyboard.press('ArrowLeft');
    await expect.poll(bullets).toBe(0);
    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => focused(page)).toEqual([1]);

    // The same slide with the bullets first: both bullets reveal before the code advances.
    await authorMarkdown(page, `<!-- .slide: id="walk" -->\n## Bullets then steps\n\n${bulletList}\n\n${fence}typescript [1|3]\n${body}\n${fence}\n${after}`);
    await ready(page);
    await jump(page, 'walk');
    for (const [visible, lines] of [[1, [1]], [2, [1]], [2, [3]]] as const) {
      await page.keyboard.press('Space');
      await expect.poll(bullets).toBe(visible);
      await expect.poll(() => focused(page)).toEqual(lines);
    }
    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => focused(page)).toEqual([1]);
    await expect.poll(bullets).toBe(2);
  });

  for (const theme of ['light', 'dark']) {
    test(`the focused band keeps real contrast at every step in ${theme}`, async ({ page }) => {
      await authorMarkdown(page, walk('typescript [1|3|4-5]'));
      await ready(page, `?mode=present&theme=${theme}`);
      await jump(page, 'walk');
      for (const lines of [[1], [3], [4, 5]]) {
        await expect.poll(() => focused(page)).toEqual(lines);
        await settleMotion(page);
        await accessible(page);
        await page.keyboard.press('Space');
      }
    });
  }
});

test.describe('reveal-on-click terminal', () => {
  const command = 'tool list --verbose';

  test('the command shows alone, one Next reveals the complete output, then Next moves on', async ({ page }) => {
    await open(page, run(command, listing, 'text'), 'run');
    const panel = '#run .terminal-panel';
    const total = await page.locator('#slide-list a').count();
    const shapes = await page.locator(`${panel} > *`).evaluateAll((nodes) => nodes.map((node) => node.localName === 'figcaption' ? 'figcaption' : node.classList[0]));
    expect(shapes).toEqual(['figcaption', 'terminal-command-line', 'terminal-response']);
    await expect(page.locator(`${panel} [role="status"], ${panel} [aria-live]`)).toHaveCount(0);
    await expect(page.locator('#run .terminal-label')).toHaveText('Recorded example');
    await expect(page.locator('#run .terminal-response')).not.toHaveClass(/visible/);
    await expect(page.locator('#run .terminal-output')).toBeHidden();
    const line = await box(page, '#run .terminal-command-line');
    const closed = await box(page, panel);
    expect(Math.abs(closed.bottom - line.bottom)).toBeLessThanOrEqual(2);
    expect((await box(page, '#run .terminal-response')).height).toBe(0);

    await page.keyboard.press('Space');
    await expect(page.locator('#run .terminal-response')).toHaveClass(/visible/);
    await settleMotion(page);
    expect(await page.locator('#run .terminal-output code').textContent()).toBe(listing);
    const expanded = await box(page, panel);
    const output = await box(page, '#run .terminal-output');
    const anchored = await box(page, '#run .terminal-command-line');
    expect(Math.abs(anchored.top - line.top)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(anchored.bottom - line.bottom)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(expanded.bottom - output.bottom)).toBeLessThanOrEqual(2);
    expect(output.height).toBeGreaterThan(100);
    await expect(page.locator('#slide-position')).toHaveText(`2 / ${total}`);
    expect(new URL(page.url()).hash).toBe('#/run/0');

    await page.keyboard.press('Space');
    await expect(page.locator('#after')).toHaveClass(/present/);
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#run')).toHaveClass(/present/);
    await expect(page.locator('#run .terminal-response')).toHaveClass(/visible/);
    await settleMotion(page);
    expect(await page.locator('#run .terminal-output code').textContent()).toBe(listing);
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#run .terminal-response')).not.toHaveClass(/visible/);
    await settleMotion(page);
    const rewound = await box(page, '#run .terminal-command-line');
    expect(Math.abs(rewound.top - line.top)).toBeLessThanOrEqual(0.5);
    expect((await box(page, '#run .terminal-response')).height).toBe(0);
  });

  test('the output expands with a real bounded transition and never overshoots', async ({ page }) => {
    await open(page, run(command, listing, 'text'), 'run');
    await page.keyboard.press('Space');
    const sample = await page.locator('#run .terminal-response').evaluate(async (response) => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const transition = response.getAnimations().find((animation) => animation instanceof CSSTransition && animation.transitionProperty === 'grid-template-rows');
      if (!transition) throw new Error('Expected a real grid-template-rows transition, not only a fragment class.');
      const duration = Number(transition.effect!.getComputedTiming().duration);
      transition.pause();
      const heights: number[] = [];
      for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
        transition.currentTime = duration * progress;
        heights.push(response.getBoundingClientRect().height);
      }
      return { duration, heights };
    });
    expect(sample.duration).toBeGreaterThanOrEqual(100);
    expect(sample.duration).toBeLessThanOrEqual(400);
    const final = sample.heights.at(-1)!;
    expect(sample.heights[0]).toBe(0);
    expect(final).toBeGreaterThan(100);
    expect(sample.heights[2]).toBeGreaterThan(0);
    expect(sample.heights[2]).toBeLessThan(final);
    expect(sample.heights.every((height, index) => index === 0 || height >= sample.heights[index - 1])).toBe(true);
    expect(Math.max(...sample.heights)).toBeLessThanOrEqual(final);
  });

  test('Copy takes the prompt-free command and the output is exact selectable text', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await captureClipboard(page);
    await open(page, run(command, listing, 'text'), 'run');
    await expect(page.locator('#run .terminal-prompt')).toHaveAttribute('aria-hidden', 'true');
    expect(await page.locator('#run .terminal-command').textContent()).toBe(command);
    await expect(page.locator('#run .copy-code')).toHaveAttribute('aria-label', 'Copy Terminal command');
    await page.locator('#run .copy-code').click();
    await expectCopied(page, command);
    await page.locator('#next').click();
    await expect(page.locator('#run .terminal-response')).toHaveClass(/visible/);
    await settleMotion(page);
    expect(await copiedBySelection(page, '#run .terminal-output code')).toBe(listing);
  });

  test('the output takes its place in document order among other fragments', async ({ page }) => {
    await open(page, `${run(command, listing, 'text').split('\n---\n')[0]}\n- A later bullet <!-- .element: class="fragment" -->\n${after}`, 'run');
    const bullets = () => page.locator('#run li.fragment.visible').count();
    await page.keyboard.press('Space');
    await expect(page.locator('#run .terminal-response')).toHaveClass(/visible/);
    expect(await bullets()).toBe(0);
    await page.keyboard.press('Space');
    await expect.poll(bullets).toBe(1);
    await expect(page.locator('#run .terminal-response')).toHaveClass(/visible/);
    await page.keyboard.press('ArrowLeft');
    await expect.poll(bullets).toBe(0);
    await expect(page.locator('#run .terminal-response')).toHaveClass(/visible/);
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#run .terminal-response')).not.toHaveClass(/visible/);
  });

  test('a command that claims JSON reveals, selects and copies complete valid JSON', async ({ page }) => {
    const json = JSON.stringify({ web: { port: 8000 }, api: { port: 8001 } }, null, 2);
    await open(page, run('tool status --json', json, 'json'), 'run');
    await page.keyboard.press('Space');
    await settleMotion(page);
    const text = await page.locator('#run .terminal-output code').textContent();
    expect(text).toBe(json);
    expect(JSON.parse(text!)).toEqual({ web: { port: 8000 }, api: { port: 8001 } });
    await expect(page.locator('#run .terminal-output code[data-language="json"] .hljs-attr').first()).toBeVisible();
  });

  test('only the output scrolls while the header and command stay fixed', async ({ page }) => {
    await open(page, run(command, longOutput, 'text'), 'run');
    await page.keyboard.press('Space');
    await settleMotion(page);
    const output = page.locator('#run .terminal-output');
    const shell = async () => ({ header: await box(page, '#run .terminal-panel figcaption'), line: await box(page, '#run .terminal-command-line') });
    const fixed = await shell();
    expect(await output.evaluate((pre) => pre.clientHeight)).toBeLessThanOrEqual(300);
    expect(await output.evaluate((pre) => pre.scrollHeight - pre.clientHeight)).toBeGreaterThan(500);
    await expect(output).toHaveAttribute('role', 'region');
    await output.hover();
    await page.mouse.wheel(0, 240);
    await expect.poll(() => output.evaluate((pre) => pre.scrollTop)).toBeGreaterThan(100);
    await output.focus();
    const before = await output.evaluate((pre) => pre.scrollTop);
    await page.keyboard.press('PageDown');
    await expect.poll(() => output.evaluate((pre) => pre.scrollTop)).toBeGreaterThan(before);
    await expect(page.locator('#run')).toHaveClass(/present/);
    await output.evaluate((pre) => { pre.scrollTop = pre.scrollHeight; });
    const last = await output.evaluate((pre) => {
      const lines = pre.querySelectorAll<HTMLElement>('.code-line');
      const end = lines[lines.length - 1];
      return end.offsetTop + end.offsetHeight <= pre.scrollTop + pre.clientHeight && end.textContent;
    });
    expect(last).toBe('line 60 of the complete output');
    expect(await shell()).toEqual(fixed);
    expect(await page.evaluate(() => document.getElementById('slide-viewport')!.scrollTop + document.scrollingElement!.scrollTop)).toBe(0);

    // In a narrow presentation the output still scrolls inside its own capped body.
    await page.setViewportSize({ width: 617, height: 800 });
    await expect(page.locator('html')).toHaveAttribute('data-compact', 'true');
    expect(await output.evaluate((pre) => pre.clientHeight)).toBeLessThanOrEqual(300);
    expect(await output.evaluate((pre) => pre.scrollHeight - pre.clientHeight)).toBeGreaterThan(500);
  });

  test('rapid Next then Back, theme, resize and jumps always settle to the fragment state', async ({ page }) => {
    await open(page, run(command, listing, 'text'), 'run');
    const response = '#run .terminal-response';
    const settled = async (revealed: boolean) => {
      await settleMotion(page);
      const running = await page.evaluate(() => document.getAnimations().filter((animation) => animation.playState === 'running'
        && Number.isFinite(animation.effect?.getComputedTiming().endTime)).length);
      expect(running).toBe(0);
      const height = (await box(page, response)).height;
      if (revealed) {
        await expect(page.locator(response)).toHaveClass(/visible/);
        expect(height).toBeGreaterThan(100);
        expect(Math.abs(height - (await box(page, '#run .terminal-output')).height)).toBeLessThanOrEqual(2);
      } else {
        await expect(page.locator(response)).not.toHaveClass(/visible/);
        expect(height).toBe(0);
      }
      return height;
    };
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowLeft');
    await settled(false);
    await page.keyboard.press('Space');
    const full = await settled(true);
    await page.keyboard.press('t');
    expect(await settled(true)).toBe(full);
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await settled(false);
    await page.keyboard.press('Space');
    await page.setViewportSize({ width: 617, height: 800 });
    await settled(true);
    await page.setViewportSize({ width: 1280, height: 720 });
    await settled(true);
    await jump(page, 'after');
    await jump(page, 'run');
    const revealed = await page.locator(`${response}.visible`).count();
    await settled(revealed === 1);
    expect(await page.locator('#run .terminal-output code').textContent()).toBe(listing);
  });

  test('read mode and reduced motion show the complete pair at once, with no running animation', async ({ page }) => {
    await authorMarkdown(page, run(command, listing, 'text'));
    await ready(page, '?mode=read');
    await expect(page.locator('#run .terminal-response')).toBeVisible();
    const out = await box(page, '#run .terminal-output');
    const clip = await box(page, '#run .terminal-clip');
    expect(Math.abs(out.height - clip.height)).toBeLessThanOrEqual(1);
    expect(await page.locator('#run .terminal-output').evaluate((pre) => pre.scrollHeight <= pre.clientHeight + 1)).toBe(true);
    expect(await page.locator('#run .terminal-output code').textContent()).toBe(listing);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await ready(page);
    await jump(page, 'run');
    await expect(page.locator('html')).toHaveAttribute('data-static', 'true');
    await expect(page.locator('#run .terminal-output')).toBeVisible();
    expect((await box(page, '#run .terminal-response')).height).toBeGreaterThan(100);
    expect(await page.evaluate(() => document.querySelector('#run .terminal-panel')!.getAnimations({ subtree: true }).length)).toBe(0);
  });

  test('a long output is shown in full in read mode and in print', async ({ page }) => {
    await authorMarkdown(page, run(command, longOutput, 'text'));
    await ready(page, '?mode=read');
    const output = page.locator('#run .terminal-output');
    await expect(output).toHaveCSS('max-height', 'none');
    await expect(output.locator('.code-line')).toHaveCount(60);
    expect(await output.evaluate((pre) => pre.scrollHeight <= pre.clientHeight + 1)).toBe(true);
    expect(await output.evaluate((pre) => pre.getBoundingClientRect().height)).toBeGreaterThan(1500);
    expect(await output.locator('code').textContent()).toBe(longOutput);

    await ready(page, '?print-pdf&theme=light');
    await page.locator('.pdf-page').first().waitFor({ state: 'attached' });
    await page.emulateMedia({ media: 'print' });
    await expect(output).toHaveCSS('max-height', 'none');
    expect(await output.evaluate((pre) => pre.scrollHeight <= pre.clientHeight + 1)).toBe(true);
    const response = await box(page, '#run .terminal-response');
    expect(Math.abs(response.height - (await box(page, '#run .terminal-output')).height)).toBeLessThanOrEqual(2);
  });

  test('deep links reveal or collapse the output', async ({ page }) => {
    await authorMarkdown(page, run(command, listing, 'text'));
    await ready(page, '?mode=present#/run/0');
    await expect(page.locator('#run .terminal-response')).toHaveClass(/visible/);
    await expect(page.locator('#run .terminal-output')).toBeVisible();
    await ready(page, '?mode=present&fresh=1#/run');
    await expect(page.locator('#run .terminal-response')).not.toHaveClass(/visible/);
    await expect(page.locator('#run .terminal-output')).toBeHidden();
  });

  for (const [name, markdown, message] of [
    ['has no output block', `<!-- .slide: id="run" -->\n## Run it\n\n${fence}bash\nnode -v\n${fence}\n<!-- .element: data-terminal="Recorded example" -->\n\nJust a paragraph.\n`, 'needs its output in a code block right after it'],
    ['claims JSON with text output', run('tool status --json', 'status: ok', 'text'), 'the terminal command asks for JSON'],
    ['claims JSON in capitals with text output', run('tool status --FORMAT JSON', 'status: ok', 'text'), 'the terminal command asks for JSON'],
    ['labels incomplete JSON', run('tool status', '{"status":', 'json'), 'not complete, valid JSON'],
    ['has an empty output', run(command, '', 'text'), 'the terminal output is empty'],
  ] as const) {
    test(`a terminal that ${name} fails visibly and names its slide`, async ({ page }) => {
      await authorMarkdown(page, markdown);
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('data-deck-ready', 'error');
      await expect(page.locator('#failure-detail')).toContainText('slide "run"');
      await expect(page.locator('#failure-detail')).toContainText(message);
    });
  }

  test('every JSON-claiming spelling, in any letter case, passes with complete JSON', async ({ page }) => {
    const json = '{"ok": true}';
    for (const [claim, language] of [['tool --json', 'json'], ['tool --format json', 'json'], ['tool --output=json', 'json'], ['tool -o json', 'json'],
      ['tool --JSON', 'JSON'], ['tool --Format Json', 'Json'], ['tool -O JSON', 'JSON']]) {
      await authorMarkdown(page, run(claim, json, language));
      await ready(page);
      await jump(page, 'run');
      await expect(page.locator('#run .terminal-panel'), claim).toHaveCount(1);
      await page.locator('#next').click();
      expect(await page.locator('#run .terminal-output code').textContent(), claim).toBe(json);
    }
  });

  for (const theme of ['light', 'dark']) {
    test(`the revealed terminal keeps real contrast in ${theme}`, async ({ page }) => {
      await authorMarkdown(page, run(command, listing, 'text'));
      await ready(page, `?mode=present&theme=${theme}`);
      await jump(page, 'run');
      await accessible(page);
      await page.keyboard.press('Space');
      await settleMotion(page);
      await accessible(page);
    });
  }

  for (const width of [390, 360, 320]) {
    test(`the terminal header keeps its label clear of Copy at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await authorMarkdown(page, run(command, listing, 'text'));
      await ready(page, '?mode=read');
      const header = await page.locator('#run .terminal-panel figcaption').evaluate((node) => {
        const bounds = node.getBoundingClientRect();
        const rect = (selector: string) => node.querySelector(selector)!.getBoundingClientRect();
        const label = rect('.terminal-label');
        const copy = rect('.copy-code');
        const inside = (item: DOMRect) => item.left >= bounds.left - 0.5 && item.right <= bounds.right + 0.5
          && item.top >= bounds.top - 0.5 && item.bottom <= bounds.bottom + 0.5;
        return {
          clear: label.right <= copy.left + 0.5 || copy.right <= label.left + 0.5 || label.bottom <= copy.top + 0.5 || copy.bottom <= label.top + 0.5,
          inside: inside(label) && inside(copy),
          copyHeight: copy.height,
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      expect(header.clear).toBe(true);
      expect(header.inside).toBe(true);
      expect(header.copyHeight).toBeGreaterThanOrEqual(43.5);
      expect(header.overflow).toBe(false);
    });
  }

  test('a terminal beside a code file reveals in its own column without moving the other', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await open(page, `<!-- .slide: id="beside" class="layout-split" -->\n## A file and its run\n\n<div class="layout-visual">\n\n${fence}typescript\nconst port = env.PORT;\n${fence}\n<!-- .element: data-caption="server.ts" -->\n\n</div>\n\n<div class="layout-visual">\n\n${fence}bash\n${command}\n${fence}\n<!-- .element: data-terminal="Recorded example" data-caption="Terminal" -->\n\n${fence}text\n${listing}\n${fence}\n\n</div>\n${after}`, 'beside');
    const file = await box(page, '#beside .layout-visual:first-of-type .code-panel');
    const terminal = await box(page, '#beside .terminal-panel');
    expect(Math.abs(terminal.width - file.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(terminal.top - file.top)).toBeLessThanOrEqual(1);
    const header = await page.locator('#beside .terminal-panel figcaption').evaluate((node) => {
      const label = node.querySelector('.terminal-label')!.getBoundingClientRect();
      const copy = node.querySelector('.copy-code')!.getBoundingClientRect();
      return label.right <= copy.left + 0.5 || copy.right <= label.left + 0.5 || label.bottom <= copy.top + 0.5 || copy.bottom <= label.top + 0.5;
    });
    expect(header).toBe(true);
    await page.keyboard.press('Space');
    await expect(page.locator('#beside .terminal-response')).toHaveClass(/visible/);
    await settleMotion(page);
    const grown = await box(page, '#beside .terminal-panel');
    const still = await box(page, '#beside .layout-visual:first-of-type .code-panel');
    expect(grown.height).toBeGreaterThan(terminal.height + 100);
    expect(still.top).toBe(file.top);
    expect(still.height).toBe(file.height);
    expect(await page.locator('#beside .terminal-output code').textContent()).toBe(listing);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test('the starter ships a real recorded Node capture that is labeled and parseable', async ({ page }) => {
    await ready(page);
    await jump(page, 'run-and-reveal');
    await expect(page.locator('#run-and-reveal .terminal-label')).toHaveText('Recorded example');
    expect(await page.locator('#run-and-reveal .terminal-command').textContent()).toBe('node -p "JSON.stringify({ web: 8000, api: 8001, cache: 8002 }, null, 2)"');
    await page.keyboard.press('Space');
    await settleMotion(page);
    const output = await page.locator('#run-and-reveal .terminal-output code').textContent();
    expect(JSON.parse(output!)).toEqual({ web: 8000, api: 8001, cache: 8002 });
  });
});

test.describe('side-by-side code and explanation', () => {
  for (const [width, height] of [[1280, 720], [1440, 900], [1920, 1080]]) {
    test(`the starter code pair shares equal aligned columns at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await ready(page);
      await jump(page, 'compare-code');
      const metrics = await page.locator('#compare-code').evaluate((slide) => {
        const panels = [...slide.querySelectorAll<HTMLElement>('.layout-visual .code-panel')];
        const rects = panels.map((panel) => panel.getBoundingClientRect());
        const frame = slide.getBoundingClientRect();
        const scale = parseFloat(document.documentElement.style.getPropertyValue('--slide-scale')) || 1;
        return {
          count: panels.length,
          widthDelta: Math.abs(rects[0].width - rects[1].width),
          topDelta: Math.abs(rects[0].top - rects[1].top),
          sideBySide: rects[0].right < rects[1].left,
          inside: rects.every((rect) => rect.left >= frame.left - 1 && rect.right <= frame.right + 1),
          titles: panels.map((panel) => panel.querySelector('figcaption span')!.textContent),
          fonts: panels.map((panel) => parseFloat(getComputedStyle(panel.querySelector('pre')!).fontSize) * scale),
          copy: [...slide.querySelectorAll('.copy-code')].map((button) => button.getBoundingClientRect().height),
          clipped: panels.map((panel) => {
            const pre = panel.querySelector('pre')!;
            return pre.scrollWidth > pre.clientWidth + 1 || pre.scrollHeight > pre.clientHeight + 1;
          }),
        };
      });
      expect(metrics.count).toBe(2);
      expect(metrics.widthDelta).toBeLessThanOrEqual(1);
      expect(metrics.topDelta).toBeLessThanOrEqual(1);
      expect(metrics.sideBySide).toBe(true);
      expect(metrics.inside).toBe(true);
      expect(metrics.titles).toEqual(['before.ts', 'after.ts']);
      expect(metrics.fonts.every((font) => font >= 16)).toBe(true);
      expect(metrics.copy.every((size) => size >= 43.5)).toBe(true);
      expect(metrics.clipped).toEqual([false, false]);
    });
  }

  for (const scene of [{ name: '390px presentation', path: '?mode=present', width: 390, height: 844 }, { name: 'reading mode', path: '?mode=read', width: 1280, height: 900 }]) {
    test(`the code pair stacks in reading order with every field reachable in ${scene.name}`, async ({ page }) => {
      await page.setViewportSize({ width: scene.width, height: scene.height });
      await ready(page, scene.path);
      await jump(page, 'compare-code');
      const stacked = await page.locator('#compare-code').evaluate((slide) => {
        const panels = [...slide.querySelectorAll<HTMLElement>('.layout-visual .code-panel')];
        const [first, second] = panels.map((panel) => panel.getBoundingClientRect());
        return {
          below: second.top >= first.bottom - 1,
          sameColumn: Math.abs(second.left - first.left) <= 1 && Math.abs(second.width - first.width) <= 1,
          titles: panels.map((panel) => panel.querySelector('figcaption span')!.textContent),
          clipped: panels.map((panel) => {
            const pre = panel.querySelector('pre')!;
            return pre.scrollWidth > pre.clientWidth + 1;
          }),
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      expect(stacked).toEqual({ below: true, sameColumn: true, titles: ['before.ts', 'after.ts'], clipped: [false, false], overflow: false });
    });
  }

  for (const kicker of [true, false]) {
    for (const copyFirst of [true, false]) {
      test(`explanation and code share one row ${kicker ? 'with' : 'without'} a kicker, ${copyFirst ? 'copy' : 'code'} first`, async ({ page }) => {
        const copy = '<div class="layout-copy">\n\n### What it does\n\nThe first line reads the port from the environment, so the same code runs anywhere.\n\n</div>';
        const code = `<div class="layout-visual">\n\n${fence}typescript\nconst port = env.PORT;\napp.listen(port);\n${fence}\n<!-- .element: data-caption="server.ts" -->\n\n</div>`;
        await authorMarkdown(page, `<!-- .slide: id="explain" class="layout-split"${kicker ? ' data-kicker="Explain"' : ''} -->\n## Code and explanation\n\n${copyFirst ? `${copy}\n\n${code}` : `${code}\n\n${copy}`}\n\nA closing line that spans the whole width.\n`);
        await page.setViewportSize({ width: 1280, height: 720 });
        await ready(page);
        await jump(page, 'explain');
        const layout = await page.locator('#explain').evaluate((slide) => {
          const rect = (selector: string) => slide.querySelector(selector)!.getBoundingClientRect();
          const text = rect('.layout-copy');
          const visual = rect('.layout-visual');
          const heading = rect('h2');
          const closing = [...slide.querySelectorAll('p')].find((node) => node.textContent?.startsWith('A closing line'))!.getBoundingClientRect();
          return {
            order: text.left < visual.left,
            apart: Math.abs(text.left - visual.left) > 100 && (text.right <= visual.left + 1 || visual.right <= text.left + 1),
            centered: Math.abs((text.top + text.bottom) / 2 - (visual.top + visual.bottom) / 2) <= 2,
            headingAbove: heading.bottom <= Math.min(text.top, visual.top) + 1,
            closingBelow: closing.top >= Math.max(text.bottom, visual.bottom) - 1,
          };
        });
        expect(layout.order).toBe(copyFirst);
        expect(layout).toMatchObject({ apart: true, centered: true, headingAbove: true, closingBelow: true });
      });
    }
  }
});

test('the starter keeps every earlier slide id and adds the new patterns in order', async ({ page }) => {
  await ready(page);
  const ids = await renderedIds(page);
  for (const id of ['intro', 'make-it-yours', 'write-in-markdown', 'copyable-code', 'apphost-example', 'rich-architecture', 'model-to-observation',
    'animate-a-model', 'animate-add-cache', 'add-media', 'reveal-the-story', 'a-little-deeper', 'statement-layout', 'split-layout', 'comparison-layout', 'publish-on-push']) {
    expect(ids).toContain(id);
  }
  const first = ids.indexOf('apphost-example');
  expect(ids.slice(first, first + 6)).toEqual(['apphost-example', 'apphost-csharp', 'go-workload', 'compare-code', 'run-and-reveal', 'rich-architecture']);
  expect(ids.slice(ids.indexOf('comparison-layout')).join()).toBe('comparison-layout,transitions,publish-on-push');
  expect(new Set(ids).size).toBe(ids.length);
});
