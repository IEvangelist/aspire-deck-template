import { expect, type Page } from '@playwright/test';

export const exampleMarkdown = `<!-- .slide: id="first-idea" -->
## First idea

A readable paragraph with \`an_identifier_that_can_wrap_without_changing_its_value\`.

- First point <!-- .element: class="fragment" -->
- Second point <!-- .element: class="fragment" -->

Note:
Presenter notes for the first idea.

--

<!-- .slide: id="deeper-idea" -->
## A deeper idea

An optional vertical slide.

---

<!-- .slide: id="code-example" -->
## A useful example

\`\`\`typescript
const message = "Hello, presentation";
console.log(message);
\`\`\`
<!-- .element: data-caption="Example code" -->

![Official Aspire mark](brand/aspire-icon-256.svg)
<!-- .element: class="slide-image" -->
`;

export function assetRequest(file: string) {
  return (url: URL) => url.pathname.endsWith(`/${file}`) &&
    !url.searchParams.has('import') && !url.searchParams.has('url');
}

export async function authorMarkdown(page: Page, source = exampleMarkdown) {
  await page.route(assetRequest('slides.md'), (route) => route.fulfill({ contentType: 'text/markdown', body: source }));
}

export async function captureClipboard(page: Page) {
  await page.addInitScript(() => {
    const write = navigator.clipboard.writeText.bind(navigator.clipboard);
    navigator.clipboard.writeText = (value) => {
      document.documentElement.dataset.copiedCode = value;
      return write(value);
    };
  });
}

export async function expectCopied(page: Page, source: string | null) {
  expect(await page.locator('html').getAttribute('data-copied-code')).toBe(source);
  // Windows' native clipboard returns CRLF even when writeText received LF.
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard.replace(/\r\n/g, '\n')).toBe(source?.replace(/\r\n/g, '\n'));
}

export async function ready(page: Page, path = '?mode=present') {
  await page.goto(path);
  await expect(page.locator('html')).toHaveAttribute('data-deck-ready', 'true');
  await page.evaluate(() => document.fonts.ready);
}

export async function paintedFonts(page: Page, selector: string) {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('DOM.enable');
    await session.send('CSS.enable');
    const { root } = await session.send('DOM.getDocument');
    const { nodeId } = await session.send('DOM.querySelector', { nodeId: root.nodeId, selector });
    expect(nodeId, `${selector} must exist before measuring painted glyphs`).toBeGreaterThan(0);
    const result: { fonts: { postScriptName: string; isCustomFont: boolean; glyphCount: number }[] } =
      await session.send('CSS.getPlatformFontsForNode', { nodeId });
    const fonts = result.fonts.filter((font) => font.glyphCount > 0);
    expect(fonts.length, `${selector} must have actual painted glyphs, not an inactive measurement`).toBeGreaterThan(0);
    return fonts;
  } finally {
    await session.detach();
  }
}

export async function jump(page: Page, id: string) {
  await page.locator('#menu-toggle').click();
  await page.locator(`#slide-list a[data-slide="${id}"]`).click();
  await expect(page.locator('#deck-menu')).not.toBeVisible();
  await expect(page.locator(`#${id}`)).toBeVisible();
}

export async function renderedIds(page: Page) {
  return page.locator('#slide-list a').evaluateAll((links) => links.map((link) => {
    if (!(link instanceof HTMLAnchorElement) || !link.dataset.slide) throw new Error('Missing slide menu target.');
    return link.dataset.slide;
  }));
}
