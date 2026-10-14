import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { assetRequest, authorMarkdown, captureClipboard, exampleMarkdown, expectCopied, jump, ready, renderedIds } from './helpers';

test('configuration changes intro, metadata, avatar, event, and arbitrary links', async ({ page }) => {
  await page.route(assetRequest('deck.config.json'), (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      title: 'A configurable presentation',
      subtitle: 'A custom subtitle',
      description: 'A custom summary',
      presenter: { name: 'A presenter', role: 'An engineer', organization: 'A community', avatar: { src: 'brand/aspire-icon-256.svg', alt: 'Test image, not a portrait' } },
      event: { name: 'A gathering', date: 'A date', location: 'A place' },
      links: [{ label: 'Not a hardcoded social network', url: 'https://example.com/' }, { label: 'Email me', url: 'mailto:hi@example.com' }],
    }),
  }));
  await ready(page);
  await expect(page.locator('#intro h1')).toHaveText('A configurable presentation');
  await expect(page.locator('.subtitle')).toHaveText('A custom subtitle');
  await expect(page.locator('.presenter-name')).toHaveText('A presenter');
  await expect(page.locator('.presenter-role')).toHaveText('An engineer | A community');
  await expect(page.locator('.event')).toHaveText('A gathering | A date | A place');
  await expect(page.locator('.presenter-links a')).toHaveText(['Not a hardcoded social network', 'Email me']);
  await expect(page.locator('.presenter-avatar')).toHaveAttribute('alt', 'Test image, not a portrait');
  await expect(page).toHaveTitle('A configurable presentation');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', 'A custom summary');
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', 'A custom summary');
  await expect(page.locator('#intro .lede')).toHaveCount(0);
  await expect(page.locator('#intro')).not.toContainText('A custom summary');
  expect(await page.locator('.presenter-avatar').evaluate((image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0)).toBe(true);
  await page.locator('#start-presentation').click();
  await expect(page.locator('#intro')).not.toBeVisible();
});

test('omitted avatar, links, and event produce a text-led intro', async ({ page }) => {
  await page.route(assetRequest('deck.config.json'), (route) => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ title: 'A talk', presenter: { name: 'A presenter' } }),
  }));
  await ready(page);
  await expect(page.locator('.presenter-avatar, .presenter-links, .event, .presenter-role, .subtitle')).toHaveCount(0);
  await expect(page.locator('#intro')).not.toHaveClass(/has-avatar/);
});

test('invalid runtime config shows an actionable failure, never a partial deck', async ({ page }) => {
  await page.route(assetRequest('deck.config.json'), (route) => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ title: 42, presenter: { name: 'A presenter' } }),
  }));
  await page.goto('/');
  await expect(page.locator('#failure')).toBeVisible();
  await expect(page.locator('#failure-detail')).toContainText('deck.config.json: title must be a string');
  await expect(page.locator('#presentation')).not.toBeVisible();
  await expect(page.locator('#toolbar')).not.toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-deck-ready', 'error');
});

test('raw Markdown edits update rendered slides, menu and counters without TS edits', async ({ page }) => {
  let source = '<!-- .slide: id="authored-one" -->\n## Authored one\n\nSome text.\n\n---\n\n## Authored two\n';
  await page.route(assetRequest('slides.md'), (route) => route.fulfill({ contentType: 'text/markdown', body: source }));
  await ready(page);
  expect(await renderedIds(page)).toEqual(['intro', 'authored-one', 'slide-3']);
  await expect(page.locator('#slide-position')).toHaveText('1 / 3');
  await page.locator('#start-presentation').click();
  await expect(page.locator('#slide-position')).toHaveText('2 / 3');
  await expect(page.locator('#authored-one')).toBeVisible();
  source += '\n---\n\n<!-- .slide: id="new-slide" -->\n## A newly added slide\n';
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-deck-ready', 'true');
  await expect(page.locator('#slide-list a')).toHaveCount(4);
  await jump(page, 'new-slide');
  await expect(page.locator('#slide-position')).toHaveText('4 / 4');
});

test('vertical slides, fragment advance/rewind, keyboard, overview and named links', async ({ page }) => {
  await authorMarkdown(page);
  await ready(page);
  await page.locator('#start-presentation').click();
  await expect(page.locator('#slide-position')).toHaveText('2 / 4');
  await expect(page.locator('#first-idea .fragment.visible')).toHaveCount(0);
  await page.locator('#next').click();
  await expect(page.locator('#first-idea .fragment.visible')).toHaveCount(1);
  await page.locator('#previous').click();
  await expect(page.locator('#first-idea .fragment.visible')).toHaveCount(0);
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#first-idea .fragment.visible')).toHaveCount(1);
  await page.keyboard.press('Space');
  await expect(page.locator('#first-idea .fragment.visible')).toHaveCount(2);
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#deeper-idea')).toBeVisible();
  await expect(page.locator('#slide-position')).toHaveText('3 / 4');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#code-example')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#presentation')).toHaveClass(/overview/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#presentation')).not.toHaveClass(/overview/);
  await page.goto('?mode=present#/deeper-idea');
  await expect(page.locator('html')).toHaveAttribute('data-deck-ready', 'true');
  await expect(page.locator('#slide-position')).toHaveText('3 / 4');
});

test('speaker notes open the official plugin with the active slide notes', async ({ page }) => {
  await authorMarkdown(page);
  await ready(page);
  await jump(page, 'first-idea');
  await expect(page.locator('#first-idea aside.notes')).not.toBeVisible();
  await page.locator('#menu-toggle').click();
  const popupPromise = page.waitForEvent('popup');
  await page.locator('#notes').click();
  const popup = await popupPromise;
  await expect(popup.locator('body')).toContainText('Presenter notes for the first idea', { timeout: 15_000 });
  await popup.close();
});

test('syntax tokens and clipboard preserve exact source with visual wrapping', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await captureClipboard(page);
  await authorMarkdown(page);
  await ready(page);
  await jump(page, 'code-example');
  const code = page.locator('#code-example pre code');
  const source = await code.textContent();
  await expect(code.locator('.hljs-keyword')).not.toHaveCount(0);
  await expect(code.locator('.hljs-string')).not.toHaveCount(0);
  await expect(page.locator('#code-example figcaption > span')).toHaveText('Example code');
  await page.locator('#code-example .copy-code').click();
  await expectCopied(page, source);
  await expect(page.locator('#deck-status')).toContainText('copied');
  for (const theme of ['light', 'dark']) {
    await page.locator('#presentation').focus();
    if (await page.locator('html').getAttribute('data-theme') !== theme) await page.keyboard.press('t');
    const audit = await new AxeBuilder({ page }).include('#code-example').withRules(['color-contrast']).analyze();
    expect(audit.violations).toEqual([]);
  }
});

test('long code scrolls only its body, keeps caption fixed, and copies verbatim', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await captureClipboard(page);
  const source = Array.from({ length: 40 }, (_, index) => `const line${index} = "${'x'.repeat(120)}";`).join('\n');
  await authorMarkdown(page, `## Long code\n\n\`\`\`javascript\n${source}\n\`\`\`\n<!-- .element: data-caption="Long example" data-wrap="false" -->\n`);
  await ready(page);
  const id = (await renderedIds(page))[1];
  await jump(page, id);
  const pre = page.locator('section.present pre');
  const caption = page.locator('section.present figcaption');
  const before = await caption.boundingBox();
  const text = await pre.locator('code').textContent();
  expect(await pre.evaluate((body) => body.scrollHeight > body.clientHeight && body.scrollWidth > body.clientWidth)).toBe(true);
  await pre.evaluate((body) => { body.scrollTop = body.scrollHeight; body.scrollLeft = body.scrollWidth; });
  expect(await caption.boundingBox()).toEqual(before);
  await page.locator('section.present .copy-code').click();
  await expectCopied(page, text);
  await ready(page, '?print-pdf');
  await page.emulateMedia({ media: 'print' });
  expect(await page.locator('pre').evaluate((body) => body.scrollHeight <= body.clientHeight + 1)).toBe(true);
  const printBounds = await page.locator('pre').evaluate((body) => {
    const page = body.closest('.pdf-page')!.getBoundingClientRect();
    const code = body.getBoundingClientRect();
    return { codeBottom: code.bottom, pageBottom: page.bottom };
  });
  expect(printBounds.codeBottom).toBeLessThanOrEqual(printBounds.pageBottom + 1);
});

for (const [name, markdown, detail] of [
  ['duplicate ID', '<!-- .slide: id="same" -->\n## First\n\n---\n<!-- .slide: id="same" -->\n## Second', 'duplicate or reserved slide id "same"'],
  ['reserved ID', '<!-- .slide: id="intro" -->\n## Another intro', 'duplicate or reserved slide id "intro"'],
  ['invalid ID', '<!-- .slide: id="not valid" -->\n## Bad anchor', 'must start with a letter'],
  ['missing target', '## Broken link\n\n[Jump](#/does-not-exist)', 'has no target'],
  ['unknown language', '## Unknown language\n\n```not-a-language\nhello\n```', 'unsupported code language'],
] as const) {
  test(`${name} fails visibly and identifies slides.md`, async ({ page }) => {
    await authorMarkdown(page, markdown);
    await page.goto('/');
    await expect(page.locator('#failure-detail')).toContainText('slides.md:');
    await expect(page.locator('#failure-detail')).toContainText(detail);
    await expect(page.locator('#failure')).toBeVisible();
  });
}

test('reading mode keeps all vertical slides, hashes and menu jumps navigable', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await captureClipboard(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await authorMarkdown(page);
  await ready(page, '?theme=dark#/deeper-idea');
  await expect(page.locator('html')).toHaveAttribute('data-reading', 'true');
  await expect(page.locator('#slide-position')).toHaveText('3 / 4');
  await jump(page, 'code-example');
  const source = await page.locator('#code-example pre code').textContent();
  await page.locator('#code-example .copy-code').click();
  await expectCopied(page, source);
  await expect(page.locator('#first-idea .fragment').first()).toHaveCSS('opacity', '1');
  await jump(page, 'code-example');
  await expect(page.locator('#slide-position')).toHaveText('4 / 4');
  await page.locator('#previous').click();
  await expect(page.locator('#slide-position')).toHaveText('3 / 4');
  await page.locator('#menu-toggle').click();
  await page.locator('#read-mode').click();
  await expect(page.locator('html')).toHaveAttribute('data-reading', 'false');
  await expect(page.locator('#deeper-idea')).toBeVisible();
  await page.keyboard.press('r');
  await expect(page.locator('html')).toHaveAttribute('data-reading', 'true');
  await expect(page.locator('#slide-position')).toHaveText('3 / 4');
  await jump(page, 'code-example');
  await page.locator('#code-example .copy-code').click();
  await expectCopied(page, source);
});

test('reduced motion and print show all fragments and full code', async ({ page }) => {
  await authorMarkdown(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await jump(page, 'first-idea');
  await expect(page.locator('#first-idea .fragment').first()).toHaveCSS('opacity', '1');
  await expect(page.locator('html')).toHaveAttribute('data-static', 'true');
  await page.goto('?print-pdf&theme=dark');
  await expect(page.locator('html')).toHaveAttribute('data-deck-ready', 'true');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.pdf-page')).toHaveCount(4);
  await expect(page.locator('#first-idea .fragment').first()).toHaveCSS('opacity', '1');
  await expect(page.locator('#toolbar')).not.toBeVisible();
  await expect(page.locator('pre').first()).toHaveCSS('max-height', 'none');
  await expect(page.locator('pre').first()).toHaveCSS('overflow', 'visible');
  const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true });
  expect(pdf.byteLength).toBeGreaterThan(10_000);
});

test('keyboard menu, theme switch and accessibility in both themes', async ({ page }) => {
  await authorMarkdown(page);
  await ready(page);
  for (const theme of ['light', 'dark'] as const) {
    await page.locator('#presentation').focus();
    if ((await page.locator('html').getAttribute('data-theme')) !== theme) await page.keyboard.press('t');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const audience = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(audience.violations).toEqual([]);
    await page.locator('#menu-toggle').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#deck-menu')).toBeVisible();
    const settings = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(settings.violations).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(page.locator('#deck-menu')).not.toBeVisible();
    await expect(page.locator('#menu-toggle')).toBeFocused();
  }
});

test('a failed Markdown request is a real error', async ({ page }) => {
  await page.route(assetRequest('slides.md'), (route) => route.fulfill({ status: 404, body: 'not found' }));
  await page.goto('/');
  await expect(page.locator('#failure-detail')).toContainText('slides.md: could not load (HTTP 404)');
});

test('native Markdown image and fragment attributes are preserved', async ({ page }) => {
  await authorMarkdown(page, exampleMarkdown);
  await ready(page);
  expect(await renderedIds(page)).toEqual(['intro', 'first-idea', 'deeper-idea', 'code-example']);
  await expect(page.locator('#first-idea .fragment')).toHaveCount(2);
  await jump(page, 'code-example');
  const image = page.locator('#code-example img');
  await expect(image).toHaveAttribute('alt', 'Official Aspire mark');
  await expect(image.locator('..')).toHaveClass('slide-image');
  expect(await image.evaluate((node) => node instanceof HTMLImageElement && node.naturalWidth === 256)).toBe(true);
});

test('unlabeled fences remain honest plaintext', async ({ page }) => {
  await authorMarkdown(page, '## Plain text\n\n```\nnot a programming language\n```\n');
  await ready(page);
  await page.locator('#start-presentation').click();
  await expect(page.locator('section.present pre code')).toHaveText('not a programming language');
  await expect(page.locator('section.present pre code span')).toHaveCount(0);
});
