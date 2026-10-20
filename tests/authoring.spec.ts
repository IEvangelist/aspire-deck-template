import hljs from 'highlight.js';
import { expect, test, type Page } from '@playwright/test';
import { authorMarkdown, jump, ready, renderedIds } from './helpers';

async function settledHeading(page: Page, id: string, index: number, count: number) {
  await expect(page.locator('#slide-position')).toHaveText(`${index + 1} / ${count}`);
  await expect.poll(() => page.locator(`#${id}`).evaluate((slide) => {
    const viewport = document.getElementById('slide-viewport')!.getBoundingClientRect();
    const heading = slide.querySelector('h1, h2, h3')!.getBoundingClientRect();
    return heading.top >= viewport.top && heading.top <= viewport.top + 100;
  })).toBe(true);
  expect(new URL(page.url()).hash).toBe(`#/${id}`);
}

test('all actual named reading links survive the 1-second Reveal wrapper guard', async ({ page }) => {
  await page.clock.install();
  await ready(page, '?mode=read&theme=dark#/intro');
  const ids = await renderedIds(page);
  for (const [index, id] of ids.entries()) {
    await page.evaluate((target) => { location.hash = `/${target}`; }, id);
    await settledHeading(page, id, index, ids.length);
    // Exercise the library's real 1000ms guard deterministically, not with a sleep workaround.
    await page.clock.runFor(1200);
    await settledHeading(page, id, index, ids.length);
  }
  const vertical = await page.locator('#slide-list .vertical-slide a').last().getAttribute('data-slide');
  if (!vertical) throw new Error('Starter deck must demonstrate a vertical slide.');
  const index = ids.indexOf(vertical);
  await page.goto(`?mode=read&theme=dark#/${vertical}`);
  await expect(page.locator('html')).toHaveAttribute('data-deck-ready', 'true');
  await page.clock.runFor(1200);
  await settledHeading(page, vertical, index, ids.length);
  await page.locator('#previous').click();
  await page.clock.runFor(1200);
  await settledHeading(page, ids[index - 1], index - 1, ids.length);
  await page.locator('#next').click();
  await page.clock.runFor(1200);
  await settledHeading(page, vertical, index, ids.length);
  await jump(page, ids[1]);
  await page.clock.runFor(1200);
  await settledHeading(page, ids[1], 1, ids.length);
});

test('narrow forced presentation is readable and adapts without shrinking desktop type', async ({ page }) => {
  await page.setViewportSize({ width: 617, height: 800 });
  await ready(page);
  await expect(page.locator('html')).toHaveAttribute('data-compact', 'true');
  const measurements = await page.locator('.presenter-role').evaluate((role) => {
    const style = getComputedStyle(role);
    const rect = role.getBoundingClientRect();
    const scale = rect.height / parseFloat(style.lineHeight);
    return { font: parseFloat(style.fontSize) * scale, scale: document.documentElement.style.getPropertyValue('--slide-scale') };
  });
  expect(measurements.font).toBeGreaterThanOrEqual(20);
  expect(measurements.scale).toBe('1');
  const ids = await renderedIds(page);
  await page.locator('#start-presentation').click();
  await expect(page.locator('#slide-position')).toHaveText(`2 / ${ids.length}`);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator('html')).toHaveAttribute('data-compact', 'false');
  await expect(page.locator('section.present h2')).toHaveCSS('font-size', '58px');
});

test('original-style centered content bounds and text-led presenter column', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1000 });
  await ready(page);
  const geometry = await page.locator('#intro').evaluate((slide) => {
    const section = slide.getBoundingClientRect();
    const box = slide.querySelector('.slide-content')!.getBoundingClientRect();
    const title = slide.querySelector('.title-copy')!.getBoundingClientRect();
    const presenter = slide.querySelector('.presenter')!.getBoundingClientRect();
    return {
      centerDelta: Math.abs((section.left + section.right) / 2 - (box.left + box.right) / 2),
      inset: box.left - section.left,
      columns: presenter.left > title.left && presenter.top < title.bottom,
    };
  });
  expect(geometry.centerDelta).toBeLessThan(1);
  expect(geometry.inset).toBeGreaterThanOrEqual(0);
  expect(geometry.columns).toBe(true);
  await expect(page.locator('.presenter-avatar')).toHaveAttribute('src', /avatar-placeholder\.svg$/);
  await expect(page.locator('#previous .octicon, #next .octicon, #menu-toggle .octicon')).toHaveCount(3);
});

test('native Markdown media alignment works while code stays left-aligned', async ({ page }) => {
  await authorMarkdown(page, `<!-- .slide: id="alignment" class="align-center" -->
## Alignment

![Official mark](brand/aspire-icon-32.svg)
<!-- .element: class="align-right" -->

\`\`\`python
print("still left aligned")
\`\`\`
`);
  await ready(page);
  await jump(page, 'alignment');
  const image = page.locator('#alignment img');
  await expect(image.locator('..')).toHaveClass('align-right');
  const alignment = await image.evaluate((node) => ({
    imageRight: node.getBoundingClientRect().right,
    parentRight: node.parentElement!.getBoundingClientRect().right,
  }));
  expect(Math.abs(alignment.imageRight - alignment.parentRight)).toBeLessThan(1);
  await expect(page.locator('#alignment pre code')).toHaveCSS('text-align', 'left');
  await expect(page.locator('#alignment pre code .hljs-string')).not.toHaveCount(0);
});

test('Python, Rust, SQL, aliases and embedded grammars load real tokens on demand', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  const examples = [
    ['py', 'python', 'def greet(name):\n    return f"Hello, {name}"'],
    ['rs', 'rust', 'fn main() { println!("hello"); }'],
    ['sql', 'sql', "SELECT title FROM talks WHERE published = true;"],
    ['html', 'xml', '<script>const value = "hello";</script>'],
    ['jinja', 'django', '<h1>{{ title }}</h1>'],
  ];
  await authorMarkdown(page, examples.map(([label, , source]) => `## ${label}\n\n\`\`\`${label}\n${source}\n\`\`\``).join('\n\n---\n\n'));
  await ready(page);
  for (const [, language] of examples) {
    await expect(page.locator(`code[data-language="${language}"] span.hljs-keyword, code[data-language="${language}"] span.hljs-name, code[data-language="${language}"] span.hljs-string, code[data-language="${language}"] span.hljs-template-variable`)).not.toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test('every installed supported language can load without a hidden grammar failure', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  const languages = hljs.listLanguages();
  await authorMarkdown(page, languages.map((language) => `## ${language}\n\n\`\`\`${language}\nexample\n\`\`\``).join('\n\n---\n\n'));
  await ready(page);
  await expect(page.locator('pre code.hljs')).toHaveCount(languages.length);
  const loaded = await page.locator('pre code').evaluateAll((codes) => codes.map((code) => {
    if (!(code instanceof HTMLElement)) throw new Error('Expected a code element.');
    return code.dataset.language;
  }));
  expect(new Set(loaded)).toEqual(new Set(languages));
  expect(errors).toEqual([]);
});

test('editable diagrams reveal box-arrow-box and native auto-animate obeys static modes', async ({ page }) => {
  await ready(page);
  await jump(page, 'model-to-observation');
  await expect(page.locator('#model-to-observation .diagram-node h3')).toHaveCount(3);
  await expect(page.locator('#model-to-observation .diagram-connector.visible')).toHaveCount(0);
  await page.locator('#next').click();
  await expect(page.locator('#model-to-observation .diagram-connector.visible')).toHaveCount(1);
  await page.locator('#next').click();
  await expect(page.locator('#model-to-observation .diagram-node.fragment.visible')).toHaveCount(1);
  await expect(page.locator('#model-to-observation .diagram-connector.visible')).toHaveCount(1);
  await page.locator('#next').click();
  await expect(page.locator('#model-to-observation .diagram-connector.visible')).toHaveCount(2);
  await jump(page, 'animate-a-model');
  await page.locator('#next').click();
  await page.locator('#next').click();
  await page.locator('#next').click();
  await expect(page.locator('#animate-add-cache')).toHaveAttribute('data-auto-animate', 'running');
  await expect(page.locator('#animate-add-cache [data-auto-animate-target]')).not.toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await jump(page, 'model-to-observation');
  await expect(page.locator('#model-to-observation .diagram-connector').first()).toHaveCSS('opacity', '1');
  await page.keyboard.press('r');
  await expect(page.locator('html')).toHaveAttribute('data-static', 'true');
  await expect(page.locator('#model-to-observation .diagram-connector').last()).toHaveCSS('opacity', '1');
});
